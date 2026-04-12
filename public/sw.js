const CACHE_VERSION = 'v1';
const STATIC_CACHE = `algomind-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `algomind-dynamic-${CACHE_VERSION}`;

// Assets to cache on install (app shell)
const PRECACHE_URLS = [
    '/',
    '/login',
    '/practice',
    '/icon-192x192.png',
    '/icon-512x512.png',
];

// Routes that should never be cached
const NETWORK_ONLY_PATTERNS = [
    /\/api\//,
    /\/auth\//,
    /\/vad\//,
    /supabase\//,
    /razorpay\//,
];

// Install: precache app shell
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(PRECACHE_URLS).catch((err) => {
                console.warn('[SW] Precache failed for some URLs:', err);
            });
        })
    );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip cross-origin requests
    if (url.origin !== location.origin) return;

    // Network-only for API routes
    if (NETWORK_ONLY_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
        return;
    }

    // Cache-first for static assets (_next/static, icons, fonts)
    if (
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/icon-') ||
        url.pathname.match(/\.(png|jpg|jpeg|svg|woff2|woff)$/)
    ) {
        event.respondWith(
            caches.match(request).then((cached) => {
                return cached || fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Network-first for HTML pages (stale-while-revalidate)
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});
