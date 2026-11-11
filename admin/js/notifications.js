/**
 * ICSS Admin Notifications
 *  - Bell with unread badge in every page header, inbox panel (sheet on phones)
 *  - Live updates: polls while visible + instant refresh when a push arrives
 *  - Phone/desktop push opt-in (Web Push via the admin service worker)
 *  - App-icon badge and "(3)" tab title
 *  - Settings → Notifications: devices, per-event switches, quiet hours, test
 * Every node is built with createElement/textContent (no HTML injection).
 */
(function initAdminNotifications(global) {
    'use strict';

    const API = '/api/v1/notifications';
    const POLL_MS = 30000;
    const TYPE_META = {
        booking_new: { icon: '📅', tone: 'success' },
        booking_payment: { icon: '💳', tone: 'warning' },
        booking_after_hours: { icon: '🌙', tone: 'info' },
        booking_cancelled: { icon: '✕', tone: 'danger' },
        booking_updated: { icon: '✓', tone: 'info' },
        booking_review: { icon: '★', tone: 'warning' },
        booking_expired: { icon: '⏳', tone: 'warning' },
        appointment_reminder: { icon: '⏰', tone: 'primary' },
        daily_summary: { icon: '☀️', tone: 'primary' },
        billing: { icon: '🧾', tone: 'warning' },
        system: { icon: '🔔', tone: 'primary' }
    };

    const state = { unread: 0, latestId: null, items: [], hasMore: false, open: false, loaded: false, timer: 0 };
    let bell, badge, panel, list, pushBanner;

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function token() {
        return typeof global.getToken === 'function' ? global.getToken() : null;
    }

    function impersonating() {
        try { return Boolean(new URLSearchParams(location.search).get('_impToken') || sessionStorage.getItem('_impToken')); } catch { return false; }
    }

    function call(path, options = {}) {
        return global.apiFetch(`${API}${path}`, options);
    }

    function timeAgo(value) {
        const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
        if (seconds < 60) return 'just now';
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.round(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    function isStandalone() {
        return global.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    }
    function isIOS() {
        return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    function pushSupported() {
        return 'serviceWorker' in navigator && 'PushManager' in global && 'Notification' in global && global.isSecureContext;
    }

    // ── Unread count, badge, title ─────────────────────────────────────────
    const baseTitle = document.title.replace(/^\(\d+\+?\)\s*/, '');
    function setUnread(count) {
        state.unread = Math.max(0, Number(count) || 0);
        if (badge) {
            badge.textContent = state.unread > 99 ? '99+' : String(state.unread);
            badge.hidden = state.unread === 0;
            bell.setAttribute('aria-label', state.unread ? `Notifications, ${state.unread} unread` : 'Notifications');
            bell.classList.toggle('has-unread', state.unread > 0);
        }
        document.title = state.unread ? `(${state.unread > 99 ? '99+' : state.unread}) ${baseTitle}` : baseTitle;
        try {
            if (state.unread && navigator.setAppBadge) navigator.setAppBadge(state.unread);
            else if (navigator.clearAppBadge) navigator.clearAppBadge();
        } catch { /* badging unsupported */ }
    }

    async function pollUnread({ announce = true } = {}) {
        if (!token()) return;
        try {
            const data = await call('/unread-count');
            const latest = data.latest;
            const isNew = latest && state.latestId && latest.id !== state.latestId && !latest.read_at;
            if (latest) state.latestId = latest.id;
            if (announce && isNew && data.unread > state.unread) {
                const inView = document.visibilityState === 'visible' && document.hasFocus();
                if (inView) showLiveAlert(latest);
                else showSystemNotification(latest);
            }
            setUnread(data.unread);
            if (state.open && isNew) loadList();
        } catch { /* offline or signed out: try again next tick */ }
    }

    function startPolling() {
        clearInterval(state.timer);
        state.timer = setInterval(() => pollUnread(), POLL_MS);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollUnread(); });
        global.addEventListener('focus', () => pollUnread());
        if (navigator.serviceWorker) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'icss:push') pollUnread();
            });
        }
    }

    // ── Browser system notification (works without push while a tab is open) ─
    const shownLocally = new Set();
    async function showSystemNotification(item) {
        if (!('Notification' in global) || Notification.permission !== 'granted' || shownLocally.has(item.id)) return;
        shownLocally.add(item.id);
        // This device already receives pushes for the same alert — avoid a duplicate.
        if (await currentSubscription().catch(() => null)) return;
        const options = {
            body: item.body || '',
            icon: '/admin/icons/app-192-v2.png',
            badge: '/admin/icons/app-192-v2.png',
            tag: `icss-${item.id}`,
            renotify: true,
            vibrate: [120, 60, 120],
            timestamp: new Date(item.created_at || Date.now()).getTime(),
            data: { url: item.url || '/admin/index.html', id: item.id }
        };
        try {
            // Service-worker notifications work on phones (where `new Notification` is not allowed).
            const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/admin/') : null;
            if (reg) { await reg.showNotification(item.title, options); return; }
            const note = new Notification(item.title, options);
            note.onclick = () => { global.focus(); openItem(item); note.close(); };
        } catch { /* notifications unavailable */ }
    }

    // ── Live alert (in-page toast) ─────────────────────────────────────────
    function showLiveAlert(item) {
        const meta = TYPE_META[item.type] || TYPE_META.system;
        document.querySelector('.notif-live')?.remove();
        const card = el('div', `notif-live notif-tone-${meta.tone}`);
        card.setAttribute('role', 'status');
        const icon = el('span', 'notif-live-icon', meta.icon);
        const text = el('div', 'notif-live-text');
        text.append(el('strong', '', item.title), el('span', '', item.body || ''));
        const view = el('button', 'btn btn-primary btn-sm', 'View');
        view.type = 'button';
        view.addEventListener('click', () => openItem(item));
        const close = el('button', 'notif-live-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', 'Dismiss');
        close.addEventListener('click', () => card.remove());
        card.append(icon, text, view, close);
        document.body.appendChild(card);
        requestAnimationFrame(() => card.classList.add('is-in'));
        setTimeout(() => { card.classList.remove('is-in'); setTimeout(() => card.remove(), 300); }, 8000);
    }

    // ── Bell + panel ───────────────────────────────────────────────────────
    function mountBell() {
        const header = document.querySelector('.main-content .page-header');
        if (!header || document.getElementById('notifBell')) return;
        bell = el('button', 'notif-bell');
        bell.id = 'notifBell';
        bell.type = 'button';
        bell.setAttribute('aria-haspopup', 'dialog');
        bell.setAttribute('aria-expanded', 'false');
        bell.setAttribute('aria-label', 'Notifications');
        bell.title = 'Notifications';
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M12 3a6 6 0 0 0-6 6v3.6l-1.6 2.7A1 1 0 0 0 5.3 17h13.4a1 1 0 0 0 .9-1.7L18 12.6V9a6 6 0 0 0-6-6Zm-2.4 15.5a2.5 2.5 0 0 0 4.8 0');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '1.8');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
        badge = el('span', 'notif-badge', '0');
        badge.hidden = true;
        bell.append(svg, badge);
        bell.addEventListener('click', togglePanel);
        header.classList.add('has-notif-bell');
        header.appendChild(bell);
    }

    function buildPanel() {
        panel = el('section', 'notif-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Notifications');
        panel.hidden = true;
        const head = el('div', 'notif-panel-head');
        const title = el('h2', '', 'Notifications');
        const actions = el('div', 'notif-panel-actions');
        const readAll = el('button', 'btn btn-ghost btn-sm', 'Mark all read');
        readAll.type = 'button';
        readAll.addEventListener('click', markAllRead);
        const settings = el('a', 'btn btn-ghost btn-sm', 'Settings');
        settings.href = 'settings.html#notifications';
        const close = el('button', 'notif-panel-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close notifications');
        close.addEventListener('click', closePanel);
        actions.append(readAll, settings, close);
        head.append(title, actions);
        pushBanner = el('div', 'notif-push-banner');
        pushBanner.hidden = true;
        list = el('div', 'notif-list');
        panel.append(head, pushBanner, list);
        const scrim = el('div', 'notif-scrim');
        scrim.addEventListener('click', closePanel);
        panel.scrim = scrim;
        document.body.append(scrim, panel);
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.open) closePanel(); });
        document.addEventListener('click', (event) => {
            if (!state.open || panel.contains(event.target) || bell.contains(event.target)) return;
            if (global.innerWidth > 640) closePanel();
        });
    }

    function positionPanel() {
        if (global.innerWidth <= 640) { panel.style.top = ''; panel.style.right = ''; return; }
        const rect = bell.getBoundingClientRect();
        panel.style.top = `${Math.round(rect.bottom + 10)}px`;
        panel.style.right = `${Math.max(12, Math.round(global.innerWidth - rect.right - 8))}px`;
    }

    function togglePanel() { if (state.open) closePanel(); else openPanel(); }

    function openPanel() {
        if (!panel) buildPanel();
        state.open = true;
        panel.hidden = false;
        panel.scrim.classList.add('is-on');
        positionPanel();
        requestAnimationFrame(() => panel.classList.add('is-open'));
        bell.setAttribute('aria-expanded', 'true');
        renderPushBanner();
        loadList();
    }

    function closePanel() {
        if (!panel) return;
        state.open = false;
        panel.classList.remove('is-open');
        panel.scrim.classList.remove('is-on');
        bell.setAttribute('aria-expanded', 'false');
        setTimeout(() => { if (!state.open) panel.hidden = true; }, 200);
    }

    async function loadList({ append = false } = {}) {
        if (!append) {
            list.replaceChildren(el('div', 'notif-empty', 'Loading…'));
        }
        try {
            const before = append && state.items.length ? `&before=${encodeURIComponent(state.items[state.items.length - 1].created_at)}` : '';
            const data = await call(`?limit=25${before}`);
            state.items = append ? state.items.concat(data.notifications) : data.notifications;
            state.hasMore = data.has_more;
            if (data.notifications[0] && !append) state.latestId = data.notifications[0].id;
            setUnread(data.unread);
            renderList();
        } catch (err) {
            list.replaceChildren(el('div', 'notif-empty', err.message || 'Could not load notifications.'));
        }
    }

    function dayLabel(value) {
        const date = new Date(value);
        const today = new Date();
        const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return 'Earlier';
    }

    function renderList() {
        if (!state.items.length) {
            const empty = el('div', 'notif-empty');
            empty.append(el('div', 'notif-empty-icon', '🔔'), el('strong', '', 'You’re all caught up'), el('span', '', 'New bookings, payments and changes will appear here.'));
            list.replaceChildren(empty);
            return;
        }
        const nodes = [];
        let currentGroup = null;
        state.items.forEach((item) => {
            const group = dayLabel(item.created_at);
            if (group !== currentGroup) { currentGroup = group; nodes.push(el('div', 'notif-group', group)); }
            const meta = TYPE_META[item.type] || TYPE_META.system;
            const row = el('button', `notif-item notif-tone-${meta.tone}${item.read_at ? '' : ' is-unread'}`);
            row.type = 'button';
            const icon = el('span', 'notif-icon', meta.icon);
            const text = el('span', 'notif-text');
            text.append(el('strong', '', item.title));
            if (item.body) text.append(el('span', 'notif-body', item.body));
            text.append(el('time', 'notif-time', timeAgo(item.created_at)));
            row.append(icon, text);
            if (!item.read_at) row.append(el('span', 'notif-dot'));
            row.addEventListener('click', () => openItem(item));
            nodes.push(row);
        });
        if (state.hasMore) {
            const more = el('button', 'btn btn-secondary btn-sm notif-more', 'Show older');
            more.type = 'button';
            more.addEventListener('click', () => loadList({ append: true }));
            nodes.push(more);
        }
        list.replaceChildren(...nodes);
    }

    async function openItem(item) {
        if (!item.read_at) {
            item.read_at = new Date().toISOString();
            try { const res = await call(`/${item.id}/read`, { method: 'POST' }); setUnread(res.unread); } catch { /* ignore */ }
        }
        const target = item.url || 'index.html';
        const here = location.pathname + location.search;
        if (target === here) { closePanel(); focusFromUrl(); return; }
        location.href = target;
    }

    async function markAllRead() {
        try {
            await call('/read-all', { method: 'POST' });
            state.items.forEach((item) => { item.read_at = item.read_at || new Date().toISOString(); });
            setUnread(0);
            renderList();
        } catch (err) {
            if (global.showToast) global.showToast(err.message, 'error');
        }
    }

    // ── Push opt-in ────────────────────────────────────────────────────────
    function urlBase64ToUint8Array(base64) {
        const padding = '='.repeat((4 - (base64.length % 4)) % 4);
        const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
        return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
    }

    async function currentSubscription() {
        if (!pushSupported()) return null;
        const reg = await navigator.serviceWorker.getRegistration('/admin/');
        return reg ? reg.pushManager.getSubscription() : null;
    }

    async function enablePush() {
        if (!pushSupported()) throw new Error(isIOS() && !isStandalone()
            ? 'On iPhone, first add this app to your Home Screen (Share → Add to Home Screen), open it from there, then turn on notifications.'
            : 'This browser does not support push notifications. Try Chrome, Edge, Firefox or Safari 16.4+.');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.');
        const reg = await navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/', updateViaCache: 'none' });
        await navigator.serviceWorker.ready;
        try {
            const prefs = await call('/preferences');
            if (!prefs.push_available || !prefs.vapid_public_key) return null;
            const key = urlBase64ToUint8Array(prefs.vapid_public_key);
            let sub = await reg.pushManager.getSubscription();
            if (sub) {
                const existingKey = sub.options && sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
                if (existingKey && existingKey.join(',') !== key.join(',')) { await sub.unsubscribe(); sub = null; }
            }
            if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
            await call('/subscriptions', { method: 'POST', body: { subscription: sub.toJSON() } });
            return sub;
        } catch (err) {
            // Permission is granted, so browser alerts still work whenever ICSS is open in a tab.
            console.warn('Background push unavailable, using in-browser alerts:', err.message);
            return null;
        }
    }

    async function disablePush() {
        const sub = await currentSubscription();
        if (!sub) return;
        try { await call('/subscriptions', { method: 'DELETE', body: { endpoint: sub.endpoint } }); } catch { /* still unsubscribe locally */ }
        await sub.unsubscribe();
    }

    // Re-link an existing device to whoever is signed in now (handles shared tablets).
    async function syncExistingSubscription() {
        try {
            if (!pushSupported() || Notification.permission !== 'granted') return;
            const sub = await currentSubscription();
            if (sub) await call('/subscriptions', { method: 'POST', body: { subscription: sub.toJSON() } });
        } catch { /* best effort */ }
    }

    async function renderPushBanner() {
        if (!pushBanner) return;
        let dismissed = false;
        try { dismissed = localStorage.getItem('icss_push_banner_dismissed') === '1'; } catch { /* ignore */ }
        const sub = await currentSubscription().catch(() => null);
        if (sub || dismissed || (pushSupported() && Notification.permission === 'denied')) { pushBanner.hidden = true; return; }
        const text = el('div', 'notif-push-text');
        const needsInstall = isIOS() && !isStandalone();
        text.append(el('strong', '', needsInstall ? 'Get booking alerts on your iPhone' : 'Get alerts on this device'),
            el('span', '', needsInstall ? 'Tap Share → Add to Home Screen, open the app from your Home Screen, then turn on alerts.' : 'Know the moment someone books, pays or cancels — even when the app is closed.'));
        const actions = el('div', 'notif-push-actions');
        if (!needsInstall && pushSupported()) {
            const on = el('button', 'btn btn-primary btn-sm', 'Turn on');
            on.type = 'button';
            on.addEventListener('click', async () => {
                on.disabled = true; on.textContent = 'Turning on…';
                try { const sub = await enablePush(); pushBanner.hidden = true; if (global.showToast) global.showToast(sub ? 'Alerts are on for this device.' : 'Browser alerts are on while ICSS is open.'); }
                catch (err) { on.disabled = false; on.textContent = 'Turn on'; if (global.showToast) global.showToast(err.message, 'error'); }
            });
            actions.append(on);
        }
        const later = el('button', 'btn btn-ghost btn-sm', 'Not now');
        later.type = 'button';
        later.addEventListener('click', () => { pushBanner.hidden = true; try { localStorage.setItem('icss_push_banner_dismissed', '1'); } catch { /* ignore */ } });
        actions.append(later);
        pushBanner.replaceChildren(el('span', 'notif-push-icon', '📲'), text, actions);
        pushBanner.hidden = false;
    }

    // ── Deep link: bookings.html?focus=<id> highlights that booking ─────────
    function focusFromUrl() {
        const params = new URLSearchParams(location.search);
        const id = params.get('focus');
        const notifId = params.get('notif');
        if (notifId && /^[0-9a-f-]{36}$/i.test(notifId)) call(`/${notifId}/read`, { method: 'POST' }).then((r) => setUnread(r.unread)).catch(() => {});
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
        const find = () => {
            const row = document.querySelector(`[data-booking-row="${id}"]`);
            if (!row) return false;
            row.classList.add('row-focus');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => row.classList.remove('row-focus'), 6000);
            return true;
        };
        if (find()) return;
        const observer = new MutationObserver(() => { if (find()) observer.disconnect(); });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 15000);
    }

    // ── Settings → Notifications ───────────────────────────────────────────
    async function mountSettings(root) {
        root.replaceChildren(el('p', 'settings-section-copy', 'Loading notification settings…'));
        let data;
        try { data = await call('/preferences'); } catch (err) { root.replaceChildren(el('p', 'settings-section-copy', err.message)); return; }
        const prefs = data.preferences;
        let saveTimer = 0;
        const save = () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(async () => {
                try { await call('/preferences', { method: 'PUT', body: { preferences: prefs } }); if (global.showToast) global.showToast('Notification settings saved.'); }
                catch (err) { if (global.showToast) global.showToast(err.message, 'error'); }
            }, 500);
        };

        // This device
        const device = el('div', 'notif-settings-device');
        const deviceText = el('div');
        const deviceTitle = el('strong');
        const deviceCopy = el('span');
        deviceText.append(deviceTitle, deviceCopy);
        const deviceButtons = el('div', 'row-actions');
        device.append(el('span', 'notif-push-icon', '📲'), deviceText, deviceButtons);

        const renderDevice = async () => {
            const sub = await currentSubscription().catch(() => null);
            deviceButtons.replaceChildren();
            if (!pushSupported()) {
                deviceTitle.textContent = isIOS() && !isStandalone() ? 'Add the app to your Home Screen first' : 'Push not supported in this browser';
                deviceCopy.textContent = isIOS() && !isStandalone()
                    ? 'In Safari tap Share → Add to Home Screen, open ICSS Bookings from your Home Screen, then come back here.'
                    : 'You will still see every alert in the bell inbox.';
                return;
            }
            if (Notification.permission === 'denied') {
                deviceTitle.textContent = 'Notifications are blocked on this device';
                deviceCopy.textContent = 'Allow notifications for this site in your browser or phone settings, then reload.';
                return;
            }
            const granted = Notification.permission === 'granted';
            deviceTitle.textContent = sub ? 'Alerts are on for this device' : granted ? 'Browser alerts are on' : 'Alerts are off for this device';
            deviceCopy.textContent = sub ? 'Bookings, payments and changes arrive even when the app is closed.'
                : granted ? 'You\u2019ll get pop-up alerts while ICSS is open in a tab. Turn on background alerts to get them when it\u2019s closed too.'
                : 'Turn on to get alerts on this phone or computer.';
            const toggle = el('button', `btn btn-sm ${sub ? 'btn-secondary' : 'btn-primary'}`, sub ? 'Turn off' : Notification.permission === 'granted' ? 'Turn on background alerts' : 'Turn on alerts');
            toggle.type = 'button';
            toggle.addEventListener('click', async () => {
                toggle.disabled = true;
                try {
                    if (sub) await disablePush(); else await enablePush();
                    await refreshDevices();
                    await renderDevice();
                } catch (err) { toggle.disabled = false; if (global.showToast) global.showToast(err.message, 'error'); }
            });
            const test = el('button', 'btn btn-secondary btn-sm', 'Send test');
            test.type = 'button';
            test.addEventListener('click', async () => {
                test.disabled = true;
                try {
                    const res = await call('/test', { method: 'POST' });
                    if (global.showToast) global.showToast(res.devices ? `Test sent to ${res.devices} device${res.devices === 1 ? '' : 's'}.` : 'Test added to your inbox. Turn on alerts to get it on this device.');
                    setTimeout(() => pollUnread({ announce: false }), 800);
                } catch (err) { if (global.showToast) global.showToast(err.message, 'error'); }
                test.disabled = false;
            });
            deviceButtons.append(toggle, test);
        };

        // Devices list
        const devicesWrap = el('div', 'notif-devices');
        const refreshDevices = async () => {
            try { data = await call('/preferences'); } catch { return; }
            const nodes = [el('div', 'notif-settings-label', 'Devices receiving alerts')];
            if (!data.devices.length) nodes.push(el('p', 'gw-help', 'No devices yet. Turn on alerts on each phone or computer you use.'));
            data.devices.forEach((d) => {
                const row = el('div', 'notif-device-row');
                const meta = el('div');
                meta.append(el('strong', '', d.device_label || 'Device'), el('span', 'gw-help', d.last_used_at ? `Last alert ${timeAgo(d.last_used_at)}` : `Added ${timeAgo(d.created_at)}`));
                const remove = el('button', 'btn btn-ghost btn-sm', 'Remove');
                remove.type = 'button';
                remove.addEventListener('click', async () => {
                    remove.disabled = true;
                    try { await call('/subscriptions', { method: 'DELETE', body: { id: d.id } }); await refreshDevices(); await renderDevice(); }
                    catch (err) { remove.disabled = false; if (global.showToast) global.showToast(err.message, 'error'); }
                });
                row.append(meta, remove);
                nodes.push(row);
            });
            devicesWrap.replaceChildren(...nodes);
        };

        const switchRow = (label, checked, onChange, hint) => {
            const row = el('label', 'notif-switch');
            const input = el('input');
            input.type = 'checkbox';
            input.checked = checked;
            input.addEventListener('change', () => onChange(input.checked));
            const text = el('span', 'notif-switch-text');
            text.append(el('span', '', label));
            if (hint) text.append(el('small', '', hint));
            row.append(text, input, el('span', 'notif-switch-ui'));
            return row;
        };

        // Event types grouped
        const typesWrap = el('div', 'notif-types');
        const groups = {};
        data.types.forEach((t) => { (groups[t.group] = groups[t.group] || []).push(t); });
        Object.entries(groups).forEach(([group, types]) => {
            const box = el('div', 'notif-type-group');
            box.append(el('div', 'notif-settings-label', group));
            types.forEach((t) => box.append(switchRow(t.label, prefs.types[t.key] !== false, (v) => { prefs.types[t.key] = v; save(); })));
            typesWrap.append(box);
        });

        // Delivery options
        const delivery = el('div', 'notif-type-group');
        delivery.append(el('div', 'notif-settings-label', 'Delivery'));
        delivery.append(switchRow('Push alerts to my devices', prefs.push, (v) => { prefs.push = v; save(); }, 'Off = alerts only appear in the bell inbox.'));
        delivery.append(switchRow('Play sound', prefs.sound, (v) => { prefs.sound = v; save(); }));
        const quiet = switchRow('Quiet hours', prefs.quietHours.enabled, (v) => { prefs.quietHours.enabled = v; times.hidden = !v; save(); }, 'No push alerts during these hours (they still reach your inbox).');
        const times = el('div', 'notif-quiet-times');
        const start = el('input'); start.type = 'time'; start.value = prefs.quietHours.start;
        const end = el('input'); end.type = 'time'; end.value = prefs.quietHours.end;
        start.addEventListener('change', () => { prefs.quietHours.start = start.value || '22:00'; save(); });
        end.addEventListener('change', () => { prefs.quietHours.end = end.value || '07:00'; save(); });
        times.append(el('span', '', 'From'), start, el('span', '', 'to'), end);
        times.hidden = !prefs.quietHours.enabled;
        delivery.append(quiet, times);

        root.replaceChildren(device, devicesWrap, delivery, typesWrap);
        await renderDevice();
        await refreshDevices();
    }

    // ── Sign-out: stop alerts for this device ──────────────────────────────
    function hookLogout() {
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.logout-btn')) return;
            const authToken = token();
            currentSubscription().then((sub) => {
                if (!sub || !authToken) return;
                fetch(`${API}/subscriptions`, {
                    method: 'DELETE',
                    keepalive: true,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ endpoint: sub.endpoint })
                }).catch(() => {});
            }).catch(() => {});
        }, true);
    }

    function init() {
        if (!token() || impersonating() || !document.querySelector('.sidebar')) return;
        mountBell();
        startPolling();
        pollUnread({ announce: false });
        syncExistingSubscription();
        hookLogout();
        focusFromUrl();
        const settingsRoot = document.getElementById('notificationSettings');
        if (settingsRoot) mountSettings(settingsRoot);
        global.addEventListener('resize', () => { if (state.open) positionPanel(); });
    }

    global.ICSSNotifications = { enablePush, disablePush, open: openPanel, refresh: pollUnread };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(window);
