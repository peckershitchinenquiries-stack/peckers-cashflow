"use client";

import * as React from "react";
import { rememberNativeToken, rememberedNativeToken } from "@/lib/native-push";
import type { Portal } from "@/lib/types";

/**
 * Put inside a sign-out form. In the app, it sends this phone's reminder token
 * with the sign-out so the server can stop reminders reaching a phone the
 * person has signed out of, and forgets the token locally. Renders nothing in
 * a browser (no token is ever remembered there) and for portals without
 * reminders.
 */
export function NativeSignOutToken({ portal }: { portal: Portal }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const audience = portal === "employee" || portal === "manager" ? portal : null;

  React.useEffect(() => {
    const input = ref.current;
    const form = input?.form;
    if (!input || !form || !audience) return;

    // Read at submit, not mount: reminders may have been turned on since.
    // A listener on the form itself runs before React's root-level handler
    // builds the FormData, so the value is in what the action receives.
    const onSubmit = () => {
      input.value = rememberedNativeToken(audience)?.token ?? "";
      rememberNativeToken(audience, null);
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [audience]);

  if (!audience) return null;
  return <input ref={ref} type="hidden" name="native_token" defaultValue="" />;
}
