// ==========================================
// Service Worker — MICHaquetas
// ==========================================

const CACHE_NAME = 'michaquetas-cache-v1.07';
const API_CACHE = 'michaquetas-api-cache-v1.07';

// Recursos estáticos que se cachean en instalación (Cache First)
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/css/styles.css',
    './assets/js/main.js',
    './icons/icono-512x512.png',
    './icons/icono-admin-512x512.png',
    // Google Fonts (CSS se cachea; las fuentes woff2 se cachean dinámicamente en fetch)
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

// ==========================================
// INSTALACIÓN — Precacheo de recursos estáticos
// ==========================================
self.addEventListener('install', event => {
    console.log('[SW] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Cacheando recursos estáticos');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(err => console.error('[SW] Error en caché de instalación:', err))
    );
    // Activar el SW inmediatamente
    self.skipWaiting();
});

// ==========================================
// ACTIVACIÓN — Limpieza de cachés antiguas
// ==========================================
self.addEventListener('activate', event => {
    console.log('[SW] Activado');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    // Borrar cachés que no sean los actuales
                    if (cache !== CACHE_NAME && cache !== API_CACHE) {
                        console.log('[SW] Borrando caché antigua:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// ==========================================
// FETCH — Estrategias de caché
// ==========================================
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // --- 1. API de Google Apps Script (Network First) ---
    // Los datos del catálogo son dinámicos; siempre intentamos la red primero
    if (url.origin === 'https://script.google.com') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cacheamos la respuesta exitosa
                    const cloned = response.clone();
                    caches.open(API_CACHE).then(cache => cache.put(event.request, cloned));
                    return response;
                })
                .catch(() => {
                    // Si falla la red, servimos desde caché
                    return caches.match(event.request);
                })
        );
        return;
    }

    // --- 2. Google Fonts (Cache First) ---
    if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
        event.respondWith(
            caches.match(event.request)
                .then(cached => {
                    // Devolver caché inmediatamente, actualizar en segundo plano
                    const networkFetch = fetch(event.request).then(networkResp => {
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResp.clone()));
                        return networkResp;
                    }).catch(() => cached);
                    return cached || networkFetch;
                })
        );
        return;
    }

    // --- 3. QR Server (Cache First con expiración) ---
    if (url.origin.includes('api.qrserver.com')) {
        event.respondWith(
            caches.match(event.request)
                .then(cached => {
                    return cached || fetch(event.request).then(networkResp => {
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResp.clone()));
                        return networkResp;
                    });
                })
        );
        return;
    }

    // --- 4. Imágenes externas (Cache First) ---
    if (event.request.destination === 'image') {
        event.respondWith(
            caches.match(event.request)
                .then(cached => {
                    return cached || fetch(event.request).then(networkResp => {
                        // Cacheamos imágenes externas (productos, logos de Drive)
                        if (networkResp && networkResp.status === 200) {
                            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResp.clone()));
                        }
                        return networkResp;
                    }).catch(() => cached);
                })
        );
        return;
    }

    // --- 5. Recursos estáticos locales (Cache First) ---
    // HTML, CSS, JS, manifest, iconos
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                return cached || fetch(event.request).then(networkResp => {
                    // Cacheamos recursos estáticos nuevos
                    if (networkResp && networkResp.status === 200 &&
                        networkResp.type === 'basic') {
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResp.clone()));
                    }
                    return networkResp;
                }).catch(() => {
                    // Fallback offline para navegación
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});

// ==========================================
// MENSAJES — Para actualización en tiempo real
// ==========================================
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
