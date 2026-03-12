const CACHE_NAME = "rentabilite-immo-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("api.anthropic.com")) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});