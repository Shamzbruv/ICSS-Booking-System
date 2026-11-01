/* Cache only the generic reconnect screen. Never cache admin pages, API data,
   invoices, authentication, or tenant-specific content. */
const CACHE = 'icss-admin-offline-v1';
const OFFLINE = '/admin/offline.html';
self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then(keys => Promise.all(
        keys.filter(key => key.startsWith('icss-admin-offline-') && key !== CACHE).map(key => caches.delete(key))
    )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || event.request.mode !== 'navigate' ||
        url.origin !== self.location.origin || !url.pathname.startsWith('/admin/')) return;
    event.respondWith(fetch(event.request).catch(async () =>
        (await caches.match(OFFLINE)) || Response.error()
    ));
});
