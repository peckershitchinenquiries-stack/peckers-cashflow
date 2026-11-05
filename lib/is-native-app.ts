"use client";

// =============================================================
// Is this page running inside the Peckers app (pms-mobile, Android or iOS)
// rather than a browser?
//
// Used to word a message correctly — "Enable location in your browser settings"
// is useless advice to someone holding an app — and, since Update 268, to show
// the app-only UI (logo home header, profile photos; server twin in
// is-native-app-server.ts). Nothing about what a person is ALLOWED to do may
// branch on this; the geofence verdict stays identical in both.
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

/**
 * The shell's version: the N in "PeckersApp/N", which the shell bumps whenever
 * its NATIVE code changes (web changes never need it). Null in a browser.
 */
export function peckersAppVersion(): number | null {
  if (typeof navigator === "undefined") return null;
  const match = navigator.userAgent.match(new RegExp(`${NATIVE_APP_UA_MARKER}/(\\d+)`));
  return match ? Number(match[1]) : null;
}

/**
 * Oldest shell that has every native fix staff need. An app reporting less is
 * told to update — a native fix only reaches a phone by reinstalling. Raise it
 * in step with pms-mobile's appendUserAgent when a release must not be skipped.
 * 2 = renderer-crash recovery, reminder icon and channel (pms-mobile Update 22).
 */
export const MIN_PECKERS_APP_VERSION = 2;

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
