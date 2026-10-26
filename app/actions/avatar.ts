"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/supabase-server";
import { createAdminClient, isProvisioningConfigured } from "@/lib/supabase-admin";
import { writeAudit } from "./audit";

const BUCKET = "avatars";
const MAX_BYTES = 1024 * 1024;

type AvatarResult = { ok: true; avatarUrl: string | null } | { ok: false; error: string };

// Returned rather than thrown: production builds replace a thrown server-action
// message with a generic one, and these are worth showing to the person.
function fail(error: string): AvatarResult {
  return { ok: false, error };
}

/** The object path inside the bucket, from a public URL this module wrote. */
function objectPathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  return at === -1 ? null : decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
}

async function currentAccount() {
  const user = await getSessionUser();
  if (!user?.allowed?.id) return null;
  return user.allowed;
}

/**
 * Sets the caller's OWN profile photo. The client has already cropped and
 * re-encoded it to a small square JPEG; the server only accepts that shape.
 * Uses the service-role client because allowed_users writes are admin-only
 * under RLS and the bucket has no write policies — scoped to the caller's row.
 */
export async function uploadOwnAvatar(formData: FormData): Promise<AvatarResult> {
  const account = await currentAccount();
  if (!account) return fail("You're signed out. Sign in and try again.");
  if (!isProvisioningConfigured()) return fail("Photo uploads aren't set up on this server.");

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a photo first.");
  if (file.size > MAX_BYTES) return fail("That photo is too large. Try another one.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isJpeg) return fail("That file isn't a photo we can use.");

  const admin = createAdminClient();
  const path = `${account.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (uploadError) {
    console.error("[avatar] upload failed:", uploadError.message);
    return fail("Couldn't upload your photo. Check your connection and try again.");
  }

  const avatarUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const { data: before } = await admin
    .from("allowed_users")
    .select("avatar_url")
    .eq("id", account.id)
    .maybeSingle();

  const { error: updateError } = await admin
    .from("allowed_users")
    .update({ avatar_url: avatarUrl })
    .eq("id", account.id);
  if (updateError) {
    await admin.storage.from(BUCKET).remove([path]);
    console.error("[avatar] profile update failed:", updateError.message);
    return fail("Couldn't save your photo. Try again.");
  }

  const oldPath = objectPathOf(before?.avatar_url);
  if (oldPath) await admin.storage.from(BUCKET).remove([oldPath]);

  await writeAudit({ action: "update_own_avatar", entity: "allowed_user", entity_id: account.id });
  revalidatePath("/", "layout");
  return { ok: true, avatarUrl };
}

/** Removes the caller's OWN profile photo; the header falls back to initials. */
export async function removeOwnAvatar(): Promise<AvatarResult> {
  const account = await currentAccount();
  if (!account) return fail("You're signed out. Sign in and try again.");
  if (!isProvisioningConfigured()) return fail("Photo uploads aren't set up on this server.");

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("allowed_users")
    .select("avatar_url")
    .eq("id", account.id)
    .maybeSingle();

  const { error } = await admin
    .from("allowed_users")
    .update({ avatar_url: null })
    .eq("id", account.id);
  if (error) {
    console.error("[avatar] remove failed:", error.message);
    return fail("Couldn't remove your photo. Try again.");
  }

  const oldPath = objectPathOf(before?.avatar_url);
  if (oldPath) await admin.storage.from(BUCKET).remove([oldPath]);

  await writeAudit({ action: "remove_own_avatar", entity: "allowed_user", entity_id: account.id });
  revalidatePath("/", "layout");
  return { ok: true, avatarUrl: null };
}
