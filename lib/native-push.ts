"use client";

// =============================================================
// Native push bridge — Android app only.
//
// An Android System WebView implements no Push API, so public/sw.js and
// PushManager cannot deliver a shift reminder inside the pms-mobile app. The
// shell carries @capacitor/push-notifications, and Capacitor injects its JS
// bridge into THIS page even though the page is served from Vercel: it
// registers the remote origin as an allowed origin for
// WebViewCompat.addDocumentStartJavaScript. So window.Capacitor.Plugins is
// reachable from here, and an FCM token can be obtained without the web app
// bundling any Capacitor dependency.
//
// Everything here returns null / throws cleanly in an ordinary browser, where
// window.Capacitor does not exist. No @capacitor/* package is imported — the
// plugin surface is typed locally, so the browser bundle is unchanged.
// =============================================================

/** Matches migration 067's platform CHECK. */
export type NativePlatform = "android" | "ios";

type PermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied";

type ListenerHandle = { remove: () => Promise<void> };

/** What the plugin hands over for a delivered or tapped notification. */
export type NativeNotification = {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

type PushNotificationsPlugin = {
  checkPermissions: () => Promise<{ receive: PermissionState }>;
  requestPermissions: () => Promise<{ receive: PermissionState }>;
  register: () => Promise<void>;
  // Method syntax, not a property: these are overloads, and a type literal only
  // allows overloads this way.
  addListener(
    event: "registration" | "registrationError",
    handler: (data: { value?: string; error?: string }) => void,
  ): Promise<ListenerHandle>;
  addListener(
    event: "pushNotificationReceived",
    handler: (notification: NativeNotification) => void,
  ): Promise<ListenerHandle>;
  addListener(
    event: "pushNotificationActionPerformed",
    handler: (action: { actionId?: string; notification: NativeNotification }) => void,
  ): Promise<ListenerHandle>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { PushNotifications?: PushNotificationsPlugin };
};

function capacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/**
 * Which native app this is running inside, or null in a browser or PWA.
 *
 * Both checks matter: `isNativePlatform` is false on Capacitor's own web
 * target, and the plugin is absent if the shell was built without it — an
 * older APK already on a phone, for instance.
 */
export function nativePlatform(): NativePlatform | null {
  const cap = capacitor();
  if (!cap?.isNativePlatform?.()) return null;
  if (!cap.Plugins?.PushNotifications) return null;
  const platform = cap.getPlatform?.();
  return platform === "android" || platform === "ios" ? platform : null;
}

function plugin(): PushNotificationsPlugin {
  const push = capacitor()?.Plugins?.PushNotifications;
  if (!push) throw new Error("Push notifications aren't available in this app build.");
  return push;
}

export async function checkNativePermission(): Promise<PermissionState> {
  return (await plugin().checkPermissions()).receive;
}

/** Shows the OS notification prompt. On Android 13+ this is a one-shot dialog. */
export async function requestNativePermission(): Promise<PermissionState> {
  return (await plugin().requestPermissions()).receive;
}

const TOKEN_TIMEOUT_MS = 15000;

/**
 * Ask FCM for this device's registration token.
 *
 * `register()` resolves as soon as the native call is made, not when the token
 * arrives — the token comes back on the `registration` event. So both
 * listeners are attached first and the promise settles on whichever fires.
 * The timeout is the case that matters in practice: with no
 * google-services.json in the shell, Firebase never initialises and NEITHER
 * event fires, so without it this would hang for ever.
 */
export async function getNativePushToken(): Promise<string> {
  const push = plugin();
  const handles: ListenerHandle[] = [];

  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("The device didn't return a notification token.")),
        TOKEN_TIMEOUT_MS,
      );
      const settle = (fn: () => void) => {
        clearTimeout(timer);
        fn();
      };

      Promise.all([
        push.addListener("registration", (data) => {
          if (data?.value) settle(() => resolve(data.value as string));
        }),
        push.addListener("registrationError", (data) => {
          settle(() => reject(new Error(data?.error || "Notification registration failed.")));
        }),
      ])
        .then((added) => {
          handles.push(...added);
          return push.register();
        })
        .catch((err) => settle(() => reject(err)));
    });
  } finally {
    for (const handle of handles) {
      try {
        await handle.remove();
      } catch {
        // Listener already gone; nothing to undo.
      }
    }
  }
}

// The OS permission cannot be revoked from inside the app, so "granted" alone
// can't distinguish "reminders on" from "turned off here after allowing". The
// token we last stored server-side is what tells them apart.
const TOKEN_KEY = "peckers.nativePushToken";

export function rememberedNativeToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function rememberNativeToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode / blocked storage. The card then re-registers on next open,
    // which re-saves the same row — wrong state, never a wrong write.
  }
}

// -------------------------------------------------------------
// Notification arrival and taps (Android app only).
//
// Two cases, and Android treats them differently:
//
//  • BACKGROUNDED or KILLED — the system tray draws the notification itself,
//    and tapping it fires `pushNotificationActionPerformed`. The tap does NOT
//    navigate the WebView, so the reminder's target URL has to be applied here.
//  • FOREGROUNDED — Android shows NOTHING. The payload arrives as
//    `pushNotificationReceived` and it is the page's job to say something, or
//    the reminder is simply lost for anyone with the app already open.
// -------------------------------------------------------------

/** The reminder's target path, if the payload carried a safe one. */
export function notificationUrl(notification: NativeNotification): string | null {
  const url = notification?.data?.url;
  if (typeof url !== "string") return null;
  // Same-origin relative paths only. "//host" is protocol-relative and would
  // leave the app, so a second slash disqualifies it.
  if (!url.startsWith("/") || url.startsWith("//")) return null;
  return url;
}

/**
 * Attach a plugin listener and hand back a synchronous unsubscribe.
 *
 * addListener resolves asynchronously, so an effect that unmounts before it
 * settles must still be able to detach — hence the cancelled flag rather than
 * just holding the handle.
 */
function listen(attach: (push: PushNotificationsPlugin) => Promise<ListenerHandle>): () => void {
  const push = capacitor()?.Plugins?.PushNotifications;
  if (!push) return () => {};

  let handle: ListenerHandle | null = null;
  let cancelled = false;
  void attach(push).then((h) => {
    if (cancelled) void h.remove();
    else handle = h;
  });

  return () => {
    cancelled = true;
    void handle?.remove();
  };
}

/** Fires when a tray notification is tapped. Returns an unsubscribe function. */
export function onNativeNotificationTap(
  handler: (notification: NativeNotification) => void,
): () => void {
  return listen((push) =>
    push.addListener("pushNotificationActionPerformed", (action) =>
      handler(action.notification),
    ),
  );
}

/** Fires when a push arrives while the app is in the FOREGROUND. */
export function onNativeNotificationReceived(
  handler: (notification: NativeNotification) => void,
): () => void {
  return listen((push) => push.addListener("pushNotificationReceived", handler));
}
