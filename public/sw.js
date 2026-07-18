// Minimal service worker to make the app installable as a PWA on Android/iOS.
// A registered SW with a fetch handler is required for Chrome's "Install app"
// prompt; without it the browser only offers a plain home-screen shortcut.

const CACHE = "gwg-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first pass-through. The presence of this fetch handler is what makes
// the app installable; we don't intercept responses beyond an offline fallback.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    fetch(req).catch(async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      return cached ?? Response.error();
    }),
  );
});
