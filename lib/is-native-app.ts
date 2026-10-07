"use client";

// =============================================================
// Is this page running inside the Peckers Android shell (pms-mobile) rather
// than a browser?
//
// Only ever used to word a message correctly. "Enable location in your browser
// settings" is useless advice to someone holding an app — the permission lives
// under Android Settings › Apps › Peckers, and there is no address bar padlock
// to tap. Nothing about WHAT the app may do is allowed to branch on this; the
// geofence verdict stays identical in both.
//
// The marker comes from `android.appendUserAgent` in the shell's
// capacitor.config.json, which is explicit rather than sniffing the WebView's
// "; wv" token — that token also appears in unrelated embedded browsers.
// =============================================================

export const NATIVE_APP_UA_MARKER = "PeckersApp";

export function isPeckersApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.includes(NATIVE_APP_UA_MARKER);
}
