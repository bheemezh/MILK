// --- Service Worker & Data Worker Implementation ---
if ('serviceWorker' in navigator) {
    // 1. Define the internal Data Worker code (Handles DB & Compression)
    const workerCodeContent = `
        importScripts('https://unpkg.com/dexie@3.2.3/dist/dexie.js', 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js', 'https://unpkg.com/comlink/dist/umd/comlink.js');
        
        const DB_NAME = 'MilkFarmDB';
        const DB_VERSION = 2; 
        
        const db = new Dexie(DB_NAME);
        db.version(DB_VERSION).stores({
            dataStore: '&key, value'
        });

        function compressData(data) {
            return new Promise((resolve, reject) => {
                try {
                    if (!data) return resolve(null);
                    // Standard pako deflate to Uint8Array for better storage performance
                    const compressed = pako.deflate(JSON.stringify(data));
                    resolve(compressed);
                } catch (e) { reject(e); }
            });
        }

        function decompressData(compressedData) {
            return new Promise((resolve, reject) => {
                try {
                    if (!compressedData) return resolve(null);
                    const decompressed = pako.inflate(compressedData, { to: 'string' });
                    resolve(JSON.parse(decompressed));
                } catch (e) { reject(e); }
            });
        }

        const api = {
            async saveData(key, data) {
                try {
                    const compressed = await compressData(data);
                    await db.dataStore.put({ key: key, value: compressed });
                } catch (e) {
                    console.error("Save operation failed:", e);
                    throw e;
                }
            },
            async loadData(key, defaultValue) {
                try {
                    const data = await db.dataStore.get(key);
                    if (data && data.value) {
                        return await decompressData(data.value);
                    }
                    return defaultValue;
                } catch (e) {
                    console.error("Load operation failed:", e);
                    throw e;
                }
            },
            async loadAllData() {
                const [priceHistory, records, deletedRecords, customerMetadata, uiColors, currencySymbol, currencyColor, selDimensions] = await Promise.all([
                    this.loadData('priceHistory', [{ date: '2020-01-01', price: 80 }]),
                    this.loadData('records', {}),
                    this.loadData('deletedRecords', {}),
                    this.loadData('customerMetadata', {}),
                    this.loadData('uiColors', { header: '#357ABD', totalPayableText: '#333', totalPayableValue: '#357ABD' }),
                    this.loadData('currencySymbol', '₹'),
                    this.loadData('currencyColor', '#607D8B'),
                    this.loadData('selDimensions', { height: 2596, width: 1520 })
                ]);
                return { priceHistory, records, deletedRecords, customerMetadata, uiColors, currencySymbol, currencyColor, selDimensions };
            },
            async addMultiCustomer(payload) {
                const { customers, startDate, endDate, newRecord } = payload;
                const records = await this.loadData('records', {});
                const customerMetadata = await this.loadData('customerMetadata', {});
                let totalRecordsAdded = 0;
                
                const loopStartDate = new Date(startDate);
                const loopEndDate = new Date(endDate);

                customers.forEach(customer => {
                    if (!records[customer]) {
                        records[customer] = {};
                        if (!customerMetadata[customer]) {
                            customerMetadata[customer] = { alternateName: customer };
                        }
                    }
                    let currentDate = new Date(loopStartDate);
                    while (currentDate <= loopEndDate) {
                        const dateString = currentDate.toISOString().slice(0, 10);
                        if (JSON.stringify(records[customer][dateString]) !== JSON.stringify(newRecord)) {
                            records[customer][dateString] = newRecord;
                            totalRecordsAdded++;
                        }
                        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                    }
                });
                await this.saveData('records', records);
                await this.saveData('customerMetadata', customerMetadata);
                return { totalRecordsAdded, customerCount: customers.length, newRecords: records };
            },
            async getCustomerList() {
                const records = await this.loadData('records', {});
                return Object.keys(records);
            }
        };
        Comlink.expose(api);
    `;

    // 2. Define the Service Worker code (Handles Caching & Asset Interception)
    const swCode = `
        const CACHE_NAME = 'milk-farm-v1';
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

        const workerBlobContent = \`${workerCodeContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;

        self.addEventListener('install', event => {
            event.waitUntil(
                caches.open(CACHE_NAME).then(cache => {
                    return cache.addAll(urlsToCache).then(() => {
                        const workerBlob = new Blob([workerBlobContent], { type: 'application/javascript' });
                        return cache.put(FAKE_WORKER_URL, new Response(workerBlob));
                    });
                })
            );
        });

        self.addEventListener('fetch', event => {
            const url = new URL(event.request.url);
            
            // Serve cached index for root navigation
            if (url.origin === self.location.origin && (url.pathname === '/index.html' || url.pathname === '/')) {
                event.respondWith(caches.match('/').then(res => res || fetch(event.request)));
                return;
            }

            // Intercept requests for the virtual data worker
            if (event.request.url === FAKE_WORKER_URL) {
                event.respondWith(caches.match(FAKE_WORKER_URL));
                return;
            }

            // General cache-first strategy
            event.respondWith(
                caches.match(event.request).then(response => response || fetch(event.request))
            );
        });

        self.addEventListener('activate', event => {
            event.waitUntil(
                caches.keys().then(keys => Promise.all(
                    keys.map(key => { if (key !== CACHE_NAME) return caches.delete(key); })
                ))
            );
        });
    `;

    // 3. Register the SW using a Blob
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    const swURL = URL.createObjectURL(swBlob);

    navigator.serviceWorker.register(swURL)
        .then(reg => console.log('MilkFarm Service Worker Active'))
        .catch(err => console.error('SW Registration Failed:', err));
}
