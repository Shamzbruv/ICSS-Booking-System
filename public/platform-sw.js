/* Cache only the generic reconnect screen. Never cache platform pages, API data,
   invoices, authentication, or tenant-specific content. */
const CACHE = 'icss-platform-offline-v1';
const OFFLINE = '/platform-offline.html';
self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then(keys => Promise.all(
        keys.filter(key => key.startsWith('icss-platform-offline-') && key !== CACHE).map(key => caches.delete(key))
    )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || event.request.mode !== 'navigate' ||
        url.origin !== self.location.origin || !/^\/platform\/?$/.test(url.pathname)) return;
    event.respondWith(fetch(event.request).catch(async () =>
        (await caches.match(OFFLINE)) || Response.error()
    ));
});
