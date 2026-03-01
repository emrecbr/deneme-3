const CACHE_NAME = 'telepet-rfq-v1';
const API_HOST = `http://${self.location.hostname}:3001`;
const RFQ_API_PREFIX = `${API_HOST}/api/rfq`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (!event.request.url.startsWith(RFQ_API_PREFIX)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const networkResponse = await fetch(event.request);
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      } catch (_error) {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        return new Response(JSON.stringify({ success: false, data: [], message: 'Offline cache yok.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    })
  );
});
