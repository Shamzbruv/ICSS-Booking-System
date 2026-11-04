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

/* ── Push notifications ────────────────────────────────────────────────────
   Payloads carry only display text and an /admin/ link — never booking data
   beyond what the business owner already sees in their dashboard. */
self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'ICSS Bookings', body: event.data ? event.data.text() : '' }; }
    const url = typeof data.url === 'string' && data.url.startsWith('/admin/') ? data.url : '/admin/index.html';
    const title = data.title || 'ICSS Bookings';
    const options = {
        body: data.body || '',
        icon: '/admin/icons/app-192-v2.png',
        badge: '/admin/icons/app-192-v2.png',
        tag: data.tag || data.type || 'icss',
        renotify: true,
        requireInteraction: Boolean(data.requireInteraction),
        silent: Boolean(data.silent),
        timestamp: data.timestamp || Date.now(),
        data: { url, id: data.id || null },
        actions: [{ action: 'open', title: 'View' }, { action: 'dismiss', title: 'Dismiss' }]
    };
    event.waitUntil((async () => {
        await self.registration.showNotification(title, options);
        if (typeof data.badgeCount === 'number' && self.navigator && self.navigator.setAppBadge) {
            try { if (data.badgeCount > 0) await self.navigator.setAppBadge(data.badgeCount); else await self.navigator.clearAppBadge(); } catch { /* unsupported */ }
        }
        // Open admin tabs refresh their bell instantly.
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        windows.forEach((client) => client.postMessage({ type: 'icss:push', id: data.id || null }));
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss') return;
    const base = (event.notification.data && event.notification.data.url) || '/admin/index.html';
    const id = event.notification.data && event.notification.data.id;
    const target = new URL(base, self.location.origin);
    if (id) target.searchParams.set('notif', id);
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const existing = windows.find((client) => new URL(client.url).pathname.startsWith('/admin/'));
        if (existing) {
            await existing.focus();
            return existing.navigate(target.href).catch(() => self.clients.openWindow(target.href));
        }
        return self.clients.openWindow(target.href);
    })());
});

// Browser rotated the push keys: re-subscribe silently next time the app opens.
self.addEventListener('pushsubscriptionchange', () => { /* the page re-syncs on load (syncExistingSubscription) */ });
