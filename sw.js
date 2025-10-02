const CACHE = "pwabuilder-offline-page-v2";

// Import Workbox from a specific version for better control.
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const offlineFallbackPage = "/index.html";

// Your application's essential files list.
// Workbox will precache these files on installation.
const appShellFiles = [
    offlineFallbackPage,
    '/',
    '/styles/main.css',
    '/scripts/main.js',
    '/manifest.json'
];

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Pre-caching strategy: Workbox uses this to cache the files listed in appShellFiles 
// during the Service Worker's installation.
workbox.precaching.precacheAndRoute(appShellFiles.map(url => ({ url, revision: null })));

// Optional: Enable navigation preload for faster navigation.
if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// Routing strategy for static assets (CSS, JS, images).
// Uses CacheFirst, which is great for files that don't change often.
workbox.routing.registerRoute(
  /\.(?:css|js|png|gif|jpg|jpeg|svg|ico)$/,
  new workbox.strategies.CacheFirst({
    cacheName: 'static-assets-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Routing strategy for all other requests.
// StaleWhileRevalidate is a good default, providing both speed and freshness.
workbox.routing.registerRoute(
  new RegExp('/*'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE
  })
);

// Fallback logic for navigation requests (HTML pages) when network is unavailable.
workbox.routing.setCatchHandler(({event}) => {
  // Return the offline page when a navigation request fails.
  if (event.request.mode === 'navigate') {
    return caches.match(offlineFallbackPage);
  }
  // For other requests, you could return a different fallback or a custom response.
  return Response.error();
});

// Activate event listener to clean up old caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          // Check if the cache name starts with "pwabuilder-offline-page" but is not the current version.
          return cacheName.startsWith('pwabuilder-offline-page') && cacheName !== CACHE;
        }).map((cacheName) => {
          // Delete the outdated cache.
          return caches.delete(cacheName);
        })
      );
    })
  );
});
