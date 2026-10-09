"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  nativePlatform,
  notificationUrl,
  onNativeNotificationReceived,
  onNativeNotificationTap,
} from "@/lib/native-push";

/**
 * Makes a shift reminder usable inside the Android app. Renders nothing, and
 * does nothing at all in a browser — `nativePlatform()` is null there.
 *
 * Two cases the tray handles for free on the web but not here:
 *
 *  • A TAP on a tray notification reaches the WebView as a plugin event, not as
 *    a navigation, so the reminder's target path has to be applied by hand.
 *  • A push arriving while the app is OPEN draws no tray notification on
 *    Android, so without a toast the reminder would be silently dropped for
 *    exactly the people already looking at the app.
 *
 * Mounted in the employee and manager layouts, so a tap is handled from any
 * screen in the portal rather than only the clock screen.
 */
export function NativePushHandler({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  const toast = useToast();
  // The toast context value is a fresh object each render; in the dep array it
  // would detach and reattach the plugin listeners on every one.
  const notify = React.useRef(toast.notify);
  notify.current = toast.notify;

  React.useEffect(() => {
    if (!nativePlatform()) return;

    const offTap = onNativeNotificationTap((notification) => {
      // middleware.ts will bounce this to the portal login if the session has
      // expired — and then straight back here, because both reminder targets
      // (/employee/attendance, /manager/live) ARE the portal home it lands on
      // after signing in. So the deep link survives the auth redirect without
      // needing a return-path parameter.
      router.push(notificationUrl(notification) ?? fallbackHref);
    });

    const offReceived = onNativeNotificationReceived((notification) => {
      notify.current(
        [notification.title, notification.body].filter(Boolean).join(" — ") ||
          "You have a shift reminder.",
        "info",
      );
    });

    return () => {
      offTap();
      offReceived();
    };
  }, [router, fallbackHref]);

  return null;
}
