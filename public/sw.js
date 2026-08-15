// Service worker for the installable PWA.
//
// Goals (all supervisors use this on phones, often on flaky hotspots):
//  • Never show a blank white screen. If a page navigation fails on a bad
//    network, serve a friendly offline page with a retry instead of nothing.
//  • Stay fast & work after the first load: hashed build assets are immutable,
//    so cache-first them; the HTML shell is always network-first so a new deploy
//    is picked up (and references the current chunks).

const CACHE = "gwg-shell-v4";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older SW versions so stale shells can't linger.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Let the page trigger an immediate update (used by the register script).
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

// Hanya berkas yang namanya MEMUAT sidik isinya yang aman disimpan selamanya,
// ditambah gambar dan huruf yang jarang berubah.
//
// Sebelumnya aturan ini mencakup SEMUA berkas berakhiran .js dan .css, termasuk
// yang namanya tetap sama antar penerapan versi. Berkas seperti itu tersimpan
// selamanya di perangkat: halamannya sudah versi baru, tapi berkas kodenya
// masih versi lama — dan menyegarkan halaman tidak menolong, karena yang
// dilayani tetap salinan lama dari perangkat itu sendiri.
function isImmutableAsset(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  return /\.(?:woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle our own origin — never touch Supabase/ESB/API calls.
  if (url.origin !== self.location.origin) return;

  const isNavigation = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    // Network-first: always try to load the freshest HTML; on failure fall back
    // to the offline page so the screen is never blank.
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }),
    );
    return;
  }

  if (isImmutableAsset(url)) {
    // Cache-first for immutable, hashed build assets (fast + offline-capable).
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return cached || Response.error();
        }
      }),
    );
    return;
  }

  // Everything else: network-first, fall back to any cached copy.
  event.respondWith(
    fetch(req).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(req)) || Response.error();
    }),
  );
});
