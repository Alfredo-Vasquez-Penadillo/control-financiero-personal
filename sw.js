const CACHE_NAME = "alvapen-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/maskable.svg"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("alvapen-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // HTML: preferir la versión publicada y usar la copia local si no hay conexión.
  if (request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return (await cache.match(request)) || (await cache.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Archivos estáticos de la app: caché primero y actualización en segundo plano.
  if (url.pathname.includes("/icons/") || url.pathname.endsWith(".webmanifest") || url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const network = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
  }
});
