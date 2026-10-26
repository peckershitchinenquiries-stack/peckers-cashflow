import { headers } from "next/headers";

// Same marker as NATIVE_APP_UA_MARKER in is-native-app.ts. Not imported from
// there: that module is "use client", so on the server its exports arrive as
// client references, not as the string.
const MARKER = "PeckersApp";

/**
 * True when this request comes from the Peckers app (Android or iOS shell), read
 * from the user agent the shell appends. Gates the app-only UI (logo home
 * header, profile photos) so the browser site renders exactly as before.
 */
export function isPeckersAppRequest(): boolean {
  return (headers().get("user-agent") ?? "").includes(MARKER);
}
