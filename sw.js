const CACHE_NAME = 'milk-farm-app-cache-v2';

// List of all the files that need to be cached for offline use.
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  
  // External Libraries (CDNs)
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/dexie@3.2.3/dist/dexie.js',
  'https://unpkg.com/comlink/dist/umd/comlink.js',
];

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching assets for offline use...');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Failed to cache some URLs:', error);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request);
      })
      .catch(error => {
        console.error('Fetching failed:', error);
      })
  );
});

self.addEventListener('activate', event => {
  // This event fires when the new service worker is ready to take control.
  // It's a perfect time to clean up old caches to save space.
  console.log('Service Worker activating...');
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches that do not match the current CACHE_NAME.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
