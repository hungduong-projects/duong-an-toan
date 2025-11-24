const CACHE_NAME = 'floodguard-v3';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
  // CDN resources are cached dynamically when first accessed (see fetch handler)
];

// Whitelist of trusted origins allowed to be cached
const CACHEABLE_ORIGINS = [
  'https://unpkg.com',
  'https://cdn.tailwindcss.com',
  'https://tilecache.rainviewer.com', // RainViewer radar tiles
  self.location.origin // The app's own origin
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Navigation strategy
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Stale-while-revalidate for tiles and API
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache external assets dynamically if successful AND from trusted origin
        if (networkResponse && networkResponse.ok) {
          // Check if request URL is from a cacheable origin
          const requestUrl = new URL(event.request.url);
          const isCacheable = CACHEABLE_ORIGINS.some(origin => requestUrl.href.startsWith(origin));

          if (isCacheable && event.request.method === 'GET') {
            // Clone before caching to avoid consuming the response
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
        }
        return networkResponse;
      }).catch(() => {
        // If fetch fails (offline), return a proper 404 Response instead of null
        // For images (tiles), Leaflet handles missing tiles gracefully
        return new Response(null, { status: 404, statusText: 'Network request failed' });
      });

      // If cached, return it immediately, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});