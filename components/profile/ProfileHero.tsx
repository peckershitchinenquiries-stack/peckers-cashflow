"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { CameraIcon } from "@/components/ui/icons";
import { Avatar } from "./Avatar";
import { ProfilePhotoSheet } from "./ProfilePhotoSheet";

/** App-only header card for the employee Profile tab: photo, role, store, start date. */
export function ProfileHero({
  name,
  avatarUrl,
  position,
  storeName,
  username,
  startedOn,
}: {
  name: string;
  avatarUrl: string | null;
  position: string | null;
  storeName: string | null;
  username: string | null;
  /** Already formatted, e.g. 03/2025. */
  startedOn: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [photo, setPhoto] = React.useState(avatarUrl);
  React.useEffect(() => setPhoto(avatarUrl), [avatarUrl]);
  const close = React.useCallback(() => setOpen(false), []);

  const facts = [
    { label: "Username", value: username },
    { label: "Store", value: storeName?.replace(/\s+Peckers$/i, "") ?? null },
    { label: "Started", value: startedOn },
  ];

  return (
    <Card className="flex flex-col items-center text-center pt-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={photo ? "Change photo" : "Add photo"}
        className="relative rounded-full active:scale-[.97] transition-transform"
      >
        <Avatar url={photo} name={name} className="h-24 w-24 border-2 border-gold/50" textClassName="text-2xl" />
        <span className="absolute right-0 bottom-0.5 h-8 w-8 rounded-full bg-gold text-black border-[3px] border-surface flex items-center justify-center">
          <CameraIcon size={15} />
        </span>
      </button>
      {!photo && (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs font-medium text-gold">
          Add a photo
        </button>
      )}

      <h2 className="mt-3 text-xl font-semibold tracking-tight text-text-primary">{name}</h2>
      {position && (
        <span className="mt-1.5 inline-flex rounded-full bg-gold/15 text-gold border border-gold/30 px-2.5 py-0.5 text-xs font-medium">
          {position}
        </span>
      )}
      {(storeName || startedOn) && (
        <p className="mt-1.5 text-sm text-text-muted">
          {[storeName, startedOn && `since ${startedOn}`].filter(Boolean).join(" · ")}
        </p>
      )}

      <dl className="mt-5 w-full grid grid-cols-3 border-t border-border pt-4">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0 px-1">
            <dt className="text-[11px] uppercase tracking-wider text-text-muted">{f.label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-text-primary truncate">{f.value || "—"}</dd>
          </div>
        ))}
      </dl>

      <ProfilePhotoSheet open={open} onClose={close} hasPhoto={!!photo} onChanged={setPhoto} />
    </Card>
  );
}
