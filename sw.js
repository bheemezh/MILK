const CACHE = "pwabuilder-offline-page";

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const offlineFallbackPage = "/index.html";

// మీ అప్లికేషన్ యొక్క ముఖ్యమైన ఫైల్స్ జాబితా.
// ఈ ఫైల్స్ Service Worker install అయిన వెంటనే క్యాష్ చేయబడతాయి.
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

// Routing strategy: Applies StaleWhileRevalidate to all requests (*). 
// It serves cached content immediately while checking the network for updates.
workbox.routing.registerRoute(
  new RegExp('/*'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE
  })
);

// Fallback logic for navigation requests (HTML pages) when network is unavailable.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloadResp = await event.preloadResponse;

        if (preloadResp) {
          return preloadResp;
        }

        const networkResp = await fetch(event.request);
        return networkResp;
      } catch (error) {
        // When the network fails, serve the cached offline fallback page.
        const cache = await caches.open(CACHE);
        const cachedResp = await cache.match(offlineFallbackPage);
        return cachedResp;
      }
    })());
  }
});