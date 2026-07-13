"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import {
  savePushSubscription,
  deletePushSubscription,
  sendTestPush,
} from "@/app/actions/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Decode a base64url VAPID key into the Uint8Array the Push API expects.
 *  Backed by an explicit ArrayBuffer so the result is a valid BufferSource. */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent);
}

/** True when running as an installed PWA (required for Web Push on iOS). */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag on navigator.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function BellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

type Status =
  | "checking"
  | "unsupported" // browser can't do Web Push at all
  | "needs-install" // iOS, but not added to Home Screen yet
  | "off" // supported, not subscribed
  | "denied" // permission was blocked
  | "on"; // subscribed and permission granted

/**
 * Lets an employee turn on browser reminders so they get a push when it's time
 * to clock in (at their shift start) and clock out (at their shift end) — even
 * when the app is closed. Registers the service worker, subscribes to Web Push,
 * and stores the subscription server-side.
 */
export function ClockReminderOptIn() {
  const toast = useToast();
  const [status, setStatus] = React.useState<Status>("checking");
  const [busy, setBusy] = React.useState(false);
  const regRef = React.useRef<ServiceWorkerRegistration | null>(null);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // Register the SW once and derive the current opt-in state.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supported || !VAPID_PUBLIC_KEY) {
        setStatus(supported ? "off" : "unsupported");
        return;
      }
      if (isIOS() && !isStandalone()) {
        setStatus("needs-install");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (cancelled) return;
        regRef.current = reg;
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (Notification.permission === "denied") setStatus("denied");
        else if (existing && Notification.permission === "granted") setStatus("on");
        else setStatus("off");
      } catch (err) {
        console.error("[push] service worker registration failed:", err);
        if (!cancelled) setStatus("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enable() {
    if (!VAPID_PUBLIC_KEY) {
      toast.error("Reminders aren't set up on the server yet.");
      return;
    }
    setBusy(true);
    try {
      const reg = regRef.current ?? (await navigator.serviceWorker.register("/sw.js"));
      regRef.current = reg;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        toast.error("Notifications weren't allowed. You can enable them in browser settings.");
        return;
      }

      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        toast.error("Couldn't set up reminders on this device.");
        return;
      }

      const res = await savePushSubscription(
        { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
        typeof navigator !== "undefined" ? navigator.userAgent : null,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStatus("on");
      toast.success("Reminders on — we'll nudge you at shift start and end.");
    } catch (err) {
      console.error("[push] enable failed:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't turn on reminders.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = regRef.current;
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      toast.success("Reminders turned off on this device.");
    } catch (err) {
      console.error("[push] disable failed:", err);
      toast.error("Couldn't turn reminders off.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const res = await sendTestPush();
      if (!res.ok) toast.error(res.error);
      else toast.success("Test sent — check your notifications.");
    } finally {
      setBusy(false);
    }
  }

  // Nothing useful to show while we work out capabilities.
  if (status === "checking") return null;
  // Don't clutter the screen on browsers that simply can't do this.
  if (status === "unsupported") return null;

  return (
    <Card className="border-border">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 text-gold shrink-0">
            <BellIcon />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium flex items-center gap-2">
              Clock-in reminders
              {status === "on" && <Badge variant="success">On</Badge>}
              {status === "denied" && <Badge variant="danger">Blocked</Badge>}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {status === "on"
                ? "We'll send this phone a reminder when your shift starts and ends — even if the app is closed."
                : status === "needs-install"
                  ? "On iPhone/iPad, tap the Share button and “Add to Home Screen”, then open Peckers from your home screen to turn on reminders."
                  : status === "denied"
                    ? "Notifications are blocked for this site. Allow them in your browser settings, then reload to turn reminders on."
                    : "Get a nudge to clock in when your shift starts (and to clock out when it ends). Never miss it again."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status === "on" ? (
            <>
              <Button size="sm" variant="outline" onClick={test} loading={busy} disabled={busy}>
                Send test
              </Button>
              <Button size="sm" variant="outline" onClick={disable} disabled={busy}>
                Turn off
              </Button>
            </>
          ) : status === "off" ? (
            <Button
              size="sm"
              onClick={enable}
              loading={busy}
              disabled={busy}
              iconLeft={<BellIcon size={15} />}
            >
              Turn on
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
