"use client";

// =============================================================
// Is this page running inside the Peckers app (pms-mobile, Android or iOS)
// rather than a browser?
//
// Only ever used to word a message correctly. "Enable location in your browser
// settings" is useless advice to someone holding an app — the permission lives
// in the phone's Settings under Peckers, and there is no address bar padlock
// to tap. Nothing about WHAT the app may do is allowed to branch on this; the
// geofence verdict stays identical in both.
//
// The marker comes from `android.appendUserAgent` / `ios.appendUserAgent` in
// the shell's capacitor.config.json, which is explicit rather than sniffing the
// WebView's "; wv" token — that token also appears in unrelated embedded browsers.
// =============================================================

export const NATIVE_APP_UA_MARKER = "PeckersApp";

export type PeckersAppPlatform = "android" | "ios";

/** Which app the page is in, or null in a browser. Android's UA always says so. */
export function peckersAppPlatform(): PeckersAppPlatform | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (!ua.includes(NATIVE_APP_UA_MARKER)) return null;
  return /Android/i.test(ua) ? "android" : "ios";
}

/** Where the phone keeps the app's location permission, for "open X" copy. */
export function appLocationSettingsPath(platform: PeckersAppPlatform): string {
  return platform === "ios"
    ? "Settings › Peckers › Location"
    : "Android Settings › Apps › Peckers › Permissions › Location";
}

/** Where the phone keeps the app's notification permission. */
export function appNotificationSettingsPath(platform: PeckersAppPlatform): string {
  return platform === "ios"
    ? "Settings › Peckers › Notifications"
    : "Android Settings › Apps › Peckers › Notifications";
}
