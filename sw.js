const CACHE = "pwabuilder-app-data-cache"; // IndexedDB డేటా పోతే, కనీసం యాప్ షెల్ అయినా ఉండాలి.
const offlineFallbackPage = "/index.html";

// Workbox ని లోడ్ చేయండి
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

// Workbox ఉందో లేదో తనిఖీ చేయండి
if (!workbox) {
  console.error(`Workbox failed to load.`);
} else {
  console.log(`Workbox is loaded.`);
}

// మీ అప్లికేషన్ యొక్క ముఖ్యమైన ఫైల్స్ జాబితా (App Shell)
// ఈ ఫైల్స్ Service Worker install అయిన వెంటనే క్యాష్ చేయబడతాయి.
// IndexedDB డేటా పోయినా, ఈ ఫైల్స్ యాప్‌ను లోడ్ చేస్తాయి.
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

// 1. Pre-caching strategy: Installation సమయంలో App Shell ఫైల్స్ అన్నీ క్యాష్ చేయబడతాయి.
workbox.precaching.precacheAndRoute(appShellFiles.map(url => ({ url, revision: null })));

// 2. Routing strategy: ఇది Cache-First/StaleWhileRevalidate స్ట్రాటజీని ఉపయోగిస్తుంది.
// * అన్ని రిక్వెస్ట్‌ల కోసం StaleWhileRevalidate
workbox.routing.registerRoute(
  new RegExp('/*'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE,
    // Workbox లో IndexedDB డేటా స్టోరేజీని కాష్‌లో ఉంచడానికి ఉపయోగపడుతుంది.
    // కానీ ఇది బ్రౌజర్ "Clear Site Data" నుండి రక్షణ ఇవ్వదు.
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50, // గరిష్టంగా 50 ఎంట్రీలు
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 రోజులు
      }),
    ],
  })
);

// 3. Fallback logic for navigation requests (HTML pages) when network is unavailable.
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
        // నెట్‌వర్క్ ఫెయిల్ అయినప్పుడు, క్యాష్ చేయబడిన index.html (offline fallback page) ని చూపించు.
        const cache = await caches.open(CACHE);
        const cachedResp = await cache.match(offlineFallbackPage);
        
        if (cachedResp) {
             return cachedResp;
        }
        // కాష్ లో కూడా ఏమీ లేకపోతే (డేటా క్లియర్ అయిన తర్వాత), పాత రెస్పాన్స్ ఇవ్వు.
        return new Response('<h1>Offline</h1><p>The app shell is not available in the cache.</p>', {
            headers: { 'Content-Type': 'text/html' }
        });
      }
    })());
  }
});
