const CACHE_NAME = 'talesh-app-v5';
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/app-icon.svg',
  '/talesh-taxi-logo.webp',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        // Optional icons must not prevent the service worker from installing.
        await Promise.allSettled(SHELL_URLS.map(async path => {
          const response = await fetch(path, { cache: 'reload' });
          if (response.ok) await cache.put(path, response);
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('talesh-app-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithShell(request));
    return;
  }

  if (SHELL_URLS.includes(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirstWithShell(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return (await cache.match('/index.html')) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
