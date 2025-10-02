// service-worker.js

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const { routing, strategies, core, precaching, navigationPreload } = workbox;

const PRECACHE_CACHE_NAME = "milk-farm-cache-v2";
const OFFLINE_FALLBACK_PAGE = "/index.html";

const PRECACHE_ASSETS = [
    { url: OFFLINE_FALLBACK_PAGE, revision: '1.0.20251002' },
    { url: '/', revision: '1.0.20251002' }, 
    { url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap', revision: null },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css', revision: '6.5.1' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js', revision: '2.1.0' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', revision: '1.4.1' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', revision: '2.5.1' },
    { url: 'https://unpkg.com/dexie@3.2.3/dist/dexie.js', revision: '3.2.3' },
    { url: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_20x20dp.png', revision: '1' } 
];

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

core.setCacheNameDetails({
    prefix: 'milkfarm',
    suffix: 'v2',
    precache: PRECACHE_CACHE_NAME 
});

precaching.precacheAndRoute(PRECACHE_ASSETS);

if (navigationPreload.isSupported()) {
  navigationPreload.enable();
}

routing.registerRoute(
  ({ url, request }) => PRECACHE_ASSETS.findIndex(asset => asset.url === url.href) === -1 && request.destination !== 'document',
  new strategies.NetworkFirst({
    cacheName: PRECACHE_CACHE_NAME,
    plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new strategies.NetworkOnly({
      plugins: [
        {
          handlerDidError: async () => {
            const cache = await caches.open(PRECACHE_CACHE_NAME);
            const cachedResp = await cache.match(OFFLINE_FALLBACK_PAGE);
            return cachedResp;
          }
        }
      ]
    })
);
