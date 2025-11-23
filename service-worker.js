const CACHE_NAME = 'floodguard-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
];

// Whitelist of trusted origins allowed to be cached
const CACHEABLE_ORIGINS = [
  'https://unpkg.com',
  'https://cdn.tailwindcss.com',
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
        if (networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic') {

          // Check if request URL is from a cacheable origin
          const requestUrl = new URL(event.request.url);
          const isCacheable = CACHEABLE_ORIGINS.some(origin => requestUrl.href.startsWith(origin));

          if (isCacheable) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
        }
        return networkResponse;
      }).catch(() => {
        // If fetch fails (offline), return null or handle specific offline fallbacks
        // For images (tiles), we could return a placeholder, but Leaflet handles missing tiles gracefully enough.
      });
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