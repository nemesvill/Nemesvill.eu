const CACHE_NAME = 'nemesvill-crm-shell-v5';
const SHELL_FILES = [
  '/crm.html',
  '/crm.css',
  '/crm.js',
  '/manifest.webmanifest',
  '/assets/pwa-icon.svg'
];

self.addEventListener('install', (event) => {
  // Első telepítéskor az új worker automatikusan aktiválódik.
  // Frissítéskor megvárjuk, amíg a felhasználó a CRM-ben a Frissítés gombra kattint.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('nemesvill-crm-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Csak a statikus alkalmazásfelület gyorsítótárazható. API és üzleti adat soha.
  if (!SHELL_FILES.includes(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      throw error;
    }
  })());
});
