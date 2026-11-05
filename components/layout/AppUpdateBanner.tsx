"use client";

import * as React from "react";
import { MIN_PECKERS_APP_VERSION, peckersAppVersion } from "@/lib/is-native-app";

const DISMISS_KEY = "peckers.appUpdateDismissed";

/**
 * Tells someone on an outdated Peckers app to update it. Web changes reach the
 * app on their own, but native fixes only arrive with a new install, and
 * without this a phone could run an old shell indefinitely. Dismissed until
 * the app is next opened. Renders nothing in a browser.
 */
export function AppUpdateBanner() {
  const [show, setShow] = React.useState(false);

  // After mount: the server render cannot know the app version, and reading the
  // UA during render would mismatch on hydration.
  React.useEffect(() => {
    const version = peckersAppVersion();
    if (version == null || version >= MIN_PECKERS_APP_VERSION) return;
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // Storage blocked: show it; dismissing then lasts until the next render.
    }
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Nothing to persist; it simply shows again next time.
    }
  }

  return (
    <div role="status" className="mx-2 mb-2 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-text-primary">
      <p className="flex-1">
        A newer version of the Peckers app is available. Ask your manager to update it on this phone.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-mr-1 h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-full text-text-muted active:bg-surface-hover"
      >
        ×
      </button>
    </div>
  );
}
