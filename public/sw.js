// AlgoMind Service Worker
// Provides offline caching for PWA functionality

const CACHE_NAME = 'algomind-1773112191096';
const STATIC_ASSETS = [
    '/',
    '/manifest.webmanifest',
    '/favicon.svg',
    '/icon-192x192.png',
    '/icon-512x512.png',
];

// Helper: Check if URL scheme is cacheable (only http/https)
function isCacheableUrl(url) {
    return url.protocol === 'http:' || url.protocol === 'https:';
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).catch(() => {
            // Silently continue if cache fails
        })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip non-cacheable URLs (chrome-extension://, etc.)
    if (!isCacheableUrl(url)) return;

    // Skip API routes and Supabase calls - always fetch fresh
    if (url.pathname.startsWith('/api/') ||
        url.hostname.includes('supabase')) {
        return;
    }

    // For page navigations, use network first
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache the page (only if cacheable)
                    if (isCacheableUrl(url)) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, clone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Offline - try cache
                    return caches.match(request).then((cached) => {
                        return cached || caches.match('/');
                    });
                })
        );
        return;
    }

    // For static assets, use cache first
    if (url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;

                return fetch(request).then((response) => {
                    // Only cache http/https URLs
                    if (isCacheableUrl(url)) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, clone);
                        });
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Default: network first
    event.respondWith(
        fetch(request)
            .then((response) => {
                return response;
            })
            .catch(() => {
                return caches.match(request);
            })
    );
});
