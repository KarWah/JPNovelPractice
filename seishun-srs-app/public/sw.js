// Service Worker — app shell caching for offline support
const CACHE = "seibusrs-v1";

// Assets to pre-cache on install (Next.js static shell)
const PRECACHE = ["/", "/vocab", "/study"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin, API routes, and _next internals
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/")
  ) {
    return;
  }

  // Network-first with cache fallback so pre-cached pages work offline
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
