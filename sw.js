// --- Service Worker & Data Worker Implementation ---
if ('serviceWorker' in navigator) {
    const swCode = `
        const CACHE_NAME = 'milk-farm-v2'; // Incremented version
        const FAKE_WORKER_URL = 'https://fake-worker/data-worker.js';

        const urlsToCache = [
            '/',
            '/index.html',
            'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
            'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
            'https://unpkg.com/dexie@3.2.3/dist/dexie.js',
            'https://unpkg.com/comlink/dist/umd/comlink.js',
            FAKE_WORKER_URL
        ];
        
        // Data Worker Source Code
        const workerCodeContent = \` 
            importScripts('https://unpkg.com/dexie@3.2.3/dist/dexie.js', 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js', 'https://unpkg.com/comlink/dist/umd/comlink.js');
            
            const db = new Dexie('MilkFarmDB');
            db.version(2).stores({ dataStore: '&key, value' });

            const api = {
                async saveData(key, data) {
                    const compressed = pako.deflate(JSON.stringify(data)); 
                    await db.dataStore.put({ key, value: compressed });
                },
                async loadData(key, defaultValue) {
                    const entry = await db.dataStore.get(key);
                    if (!entry) return defaultValue;
                    const decompressed = pako.inflate(entry.value, { to: 'string' });
                    return JSON.parse(decompressed);
                },
                async loadAllData() {
                    return {
                        priceHistory: await this.loadData('priceHistory', [{ date: '2020-01-01', price: 80 }]),
                        records: await this.loadData('records', {}),
                        customerMetadata: await this.loadData('customerMetadata', {}),
                        uiColors: await this.loadData('uiColors', { header: '#357ABD' }),
                        currencySymbol: await this.loadData('currencySymbol', '₹')
                    };
                }
            };
            Comlink.expose(api);
        \`;

        // Install Event: Cache all assets and the fake worker
        self.addEventListener('install', event => {
            self.skipWaiting(); // Force activation
            event.waitUntil(
                caches.open(CACHE_NAME).then(cache => {
                    return cache.addAll(urlsToCache).then(() => {
                        const blob = new Blob([workerCodeContent], { type: 'application/javascript' });
                        return cache.put(FAKE_WORKER_URL, new Response(blob));
                    });
                })
            );
        });

        // Activate Event: Clean up old caches
        self.addEventListener('activate', event => {
            event.waitUntil(
                Promise.all([
                    self.clients.claim(),
                    caches.keys().then(keys => Promise.all(
                        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
                    ))
                ])
            );
        });

        // Fetch Event: Serve from cache first, then network
        self.addEventListener('fetch', event => {
            event.respondWith(
                caches.match(event.request).then(response => {
                    return response || fetch(event.request).catch(() => {
                        if (event.request.mode === 'navigate') return caches.match('/');
                    });
                })
            );
        });
    `;

    // Create Blob and Register
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    const swURL = URL.createObjectURL(swBlob);

    navigator.serviceWorker.register(swURL, { scope: './' })
        .then(reg => console.log('Offline Engine Ready'))
        .catch(err => console.error('Offline Setup Failed', err));
}
