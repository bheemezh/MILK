// Service Worker file: sw.js
// This file handles caching, offline support, and background sync.

const CACHE = "milk-farm-app-v2"; // A new cache name for versioning
const offlineFallbackPage = "/index.html";

// Load Workbox
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

// Check if Workbox loaded successfully
if (!workbox) {
  console.error(`Workbox failed to load.`);
} else {
  console.log(`Workbox is loaded.`);
}

// 1. List of essential application files (App Shell)
// These files will be cached immediately when the Service Worker is installed.
const appShellFiles = [
    offlineFallbackPage,
    '/',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://unpkg.com/dexie@3.2.3/dist/dexie.js',
    // We assume the main HTML file is served from the root
    // and the script is inline, so we don't need to precache a separate .js file.
];

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// 2. Pre-caching strategy: All App Shell files are cached during installation.
workbox.precaching.precacheAndRoute(appShellFiles.map(url => ({ url, revision: null })));

// 3. Runtime caching strategy: This uses a StaleWhileRevalidate strategy.
// * For all static assets (images, fonts, etc.) that can't be fetched from the network.
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'image' ||
                   request.destination === 'font' ||
                   request.destination === 'style',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'static-assets-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// 4. Fallback logic for navigation requests (HTML pages) when network is unavailable.
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
        // If the network fails, show the cached index.html (offline fallback page).
        const cache = await caches.open(CACHE);
        const cachedResp = await cache.match(offlineFallbackPage);
        return cachedResp || new Response('<h1>Offline</h1><p>The app shell is not available in the cache.</p>');
      }
    })());
  }
});

// 5. Background Sync and Periodic Sync
// * Background Sync: To sync data when the network connection is restored.
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-milk-farm-data') {
        console.log('Syncing milk farm data...');
        event.waitUntil(syncData());
    }
});

// * Periodic Sync: For continuous synchronization (supported only on some browsers).
// The registration for periodic sync must be done from the client side (index.html).
// The service-worker.js file only contains the event listener.

async function syncData() {
    // This is where your data synchronization logic goes.
    // For example, sending data to the server.
    console.log('Attempting to sync data with the server...');
    try {
        // This function needs to be implemented in your application logic.
        // The code for this is in your main JavaScript file.
        // Example: fetch('/api/sync-data', { method: 'POST', body: data });
        const response = await fetch('/api/sync-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: 'Sync request' })
        });
        
        if (response.ok) {
            console.log('Data synced successfully!');
            // If sync is successful, send a message to the client.
            self.clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage('sync-success'));
            });
        } else {
            console.error('Data sync failed:', response.statusText);
        }
    } catch (error) {
        console.error('Data sync failed due to network error:', error);
        // If there's a network error, you can store the data here for a later sync attempt.
    }
}
