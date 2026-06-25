// Abingdon 2026 (Sophie) Service Worker
// Handles offline caching so the plan works without internet.
// Firebase sync (save/load) still needs network, which degrades
// gracefully. The plan UI itself is always available.

const CACHE = 'abingdon-2026-sophie-v1';

const PRECACHE = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: cache the plan shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(PRECACHE).catch(err => {
        console.warn('[SW] Precache partial failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache, fall back to network (stale-while-revalidate)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('strava.com') ||
    event.request.method !== 'GET'
  ) {
    return; // live network
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        fetch(event.request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request).then(response => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});

// Push notifications (placeholder for future use)
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Training Today';
  const options = {
    body: data.body || "Check today's session.",
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
