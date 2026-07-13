/* =============================================================
 * Peckers — clock-in / clock-out reminder service worker.
 *
 * Receives Web Push messages (even when the app is closed) and shows the
 * reminder notification; taps focus/open the attendance screen.
 *
 * Plain JS, served as-is from /sw.js (no build step). Keep it dependency-free.
 * ============================================================= */

self.addEventListener("install", () => {
  // Activate this worker immediately rather than waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Peckers", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Peckers";
  const options = {
    body: data.body || "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    // Distinct tags (clock_in vs clock_out, per day) so one reminder doesn't
    // silently replace the other; renotify re-alerts if the same tag repeats.
    tag: data.tag || "peckers-reminder",
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || "/employee/attendance" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/employee/attendance";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) {
              try {
                client.navigate(targetUrl);
              } catch (e) {
                /* cross-origin or not allowed — ignore, focus is enough */
              }
            }
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      }),
  );
});
