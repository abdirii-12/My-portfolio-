// sw.js - Service Worker
// Version this value to force a cache refresh on deploy
const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/', // ensure your server serves index.html for '/'
  '/index.html',
  '/offline.html',      // offline fallback page (create this file)
  '/styles/main.css',
  '/scripts/main.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Maximum age / size strategies are not enforced here but could be added.

self.addEventListener('install', (event) => {
  // Pre-cache static assets
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Fetch strategy:
 * - Navigation requests -> Network first, fallback to cache, then offline page.
 * - Requests to /api/ -> Network first (fresh data), cache a copy for offline fallback.
 * - Other static assets -> Cache first, fallback to network.
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // 1) Navigation requests (user typed or clicked link)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // If response ok, put a copy in runtime cache
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => {
          // If network fails, try cache, else offline page
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // 2) API requests - prefer network, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // store a copy in runtime cache
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3) Static assets - cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          // store in runtime cache for future
          if (res && res.status === 200 && res.type !== 'opaque') {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => {
          // If it's an image request, optionally return a placeholder image from cache
          if (request.destination === 'image') {
            return caches.match('/icons/icon-192x192.png');
          }
          // otherwise, try offline page for HTML-like requests
          if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
            return caches.match('/offline.html');
          }
          return new Response(null, { status: 504, statusText: 'Gateway Timeout' });
        });
    })
  );
});

// Optional: Listen for message to skipWaiting from the page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
