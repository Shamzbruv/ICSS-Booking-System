(function () {
    'use strict';

    const el = id => document.getElementById(id);
    const numbers = new Intl.NumberFormat();
    const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
    const statusLabels = {
        confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show',
        pending_payment: 'Awaiting payment', pending_manual_confirmation: 'Payment review',
        pending_after_hours_confirmation: 'After-hours request', rejected: 'Rejected', expired: 'Expired'
    };
    const visitLabel = visits => `${numbers.format(visits)} ${visits === 1 ? 'visit' : 'visits'}`;
    const dateTime = booking => `${formatDate(booking.booking_date)} · ${formatTime(booking.booking_time)}`;
    let directoryPage = 1;
    let historyPage = 1;
    let request;
    let searchTimer;

    function node(tag, className, text) {
        const item = document.createElement(tag);
        if (className) item.className = className;
        if (text) item.textContent = text;
        return item;
    }

    function message(id, text = '', error = false) {
        el(id).textContent = text;
        el(id).toggleAttribute('data-error', error);
    }

    function actionLink(href, label) {
        const link = node('a', 'btn btn-secondary btn-sm', label);
        link.href = href;
        return link;
    }

    function bookingLink(id) {
        return actionLink(`bookings.html?booking=${encodeURIComponent(id)}`, 'Open booking');
    }

    function metric(figure, label) {
        const item = node('div');
        item.append(node('strong', null, figure), node('small', null, label));
        return item;
    }

    function clientRow(client) {
        const name = client.name || 'Unnamed client';
        const initials = name.split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase();
        const row = node('li', 'client-row');
        const person = node('div', 'client-person');
        const avatar = node('span', 'client-avatar', initials);
        avatar.setAttribute('aria-hidden', 'true');
        const contact = node('div');
        contact.append(node('strong', null, name), node('small', null, [client.email, client.phone].filter(Boolean).join(' · ') || 'No contact details'));
        person.append(avatar, contact);
        const open = actionLink(`?client=${encodeURIComponent(client.id)}`, 'View profile');
        open.setAttribute('aria-label', `View profile for ${name}`);
        open.addEventListener('click', event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            const url = new URL(location.href);
            url.searchParams.set('client', client.id);
            history.pushState({}, '', url);
            renderView();
        });
        row.append(person,
            metric(visitLabel(client.visits), `${numbers.format(client.bookings)} ${client.bookings === 1 ? 'booking' : 'bookings'}`),
            metric(client.top_service || '—', client.top_service_visits ? `Most used · ${visitLabel(client.top_service_visits)}` : 'Most-used service'),
            open);
        return row;
    }

    function pager(prefix, page, limit, total) {
        const pages = Math.max(1, Math.ceil(total / limit));
        const directory = prefix === 'client';
        el(directory ? 'directoryPagination' : 'historyPagination').hidden = pages === 1;
        el(`${prefix}PageLabel`).textContent = `Page ${numbers.format(page)} of ${numbers.format(pages)}`;
        el(`${prefix}Previous`).disabled = page <= 1;
        el(`${prefix}Next`).disabled = page >= pages;
    }

    function nextRequest() {
        request?.abort();
        request = new AbortController();
        return request.signal;
    }

    async function loadDirectory() {
        const signal = nextRequest();
        el('directoryPagination').hidden = true;
        el('clientResults').replaceChildren();
        message('directoryMessage', 'Loading clients…');
        const search = el('clientSearch').value.trim();
        const filter = el('clientFilter').value;
        const params = new URLSearchParams({ search, filter, sort: el('clientSort').value, page: directoryPage });
        try {
            const data = await apiFetch(`/api/v1/clients?${params}`, { signal });
            if (signal.aborted) return;
            el('directoryTotal').textContent = numbers.format(data.overview.clients);
            el('directoryReturning').textContent = numbers.format(data.overview.returning);
            el('directoryVisits').textContent = numbers.format(data.overview.visits);
            const count = data.total === 1 ? '1 client' : `${numbers.format(data.total)} clients`;
            message('directoryMessage', data.total ? count : search || filter !== 'all'
                ? 'No clients match your search and filters.' : 'Your clients will appear after their first booking.');
            el('clientResults').replaceChildren(...data.clients.map(clientRow));
            pager('client', directoryPage, data.limit, data.total);
        } catch (err) {
            if (!signal.aborted) message('directoryMessage', err.message, true);
        }
    }

    function showContact(client) {
        const items = [];
        if (client.email) {
            const email = node('a', null, client.email);
            email.href = `mailto:${encodeURIComponent(client.email).replace('%40', '@')}`;
            items.push(email);
        }
        if (client.phone) {
            const number = client.phone.trim().replace(/[^0-9+]/g, '');
            const phone = node('a', null, client.phone);
            phone.href = `tel:${number}`;
            items.push(phone);
        }
        el('profileContact').replaceChildren(...(items.length ? items : [node('span', null, 'No contact details')]));
    }

    function appointmentRow(booking) {
        const row = node('li', 'client-row client-history-row');
        const status = node('div');
        const badge = node('span', 'client-status', statusLabels[booking.status] || 'Unspecified');
        badge.dataset.state = booking.status;
        status.append(badge);
        row.append(metric(booking.service_name || 'Service unavailable', dateTime(booking)), status,
            node('small', null, booking.booking_source === 'phone' ? 'Phone booking' : 'Online booking'), bookingLink(booking.id));
        return row;
    }

    function showProfile(data) {
        const client = data.client;
        el('profileName').textContent = client.name || 'Unnamed client';
        showContact(client);
        el('profileVisits').textContent = numbers.format(client.visits);
        el('profileBookings').textContent = numbers.format(client.bookings);
        el('profileCancellations').textContent = numbers.format(client.cancellations);
        el('profileNoShows').textContent = numbers.format(client.no_shows);
        el('profileLastVisit').textContent = client.last_visit ? `Last completed visit · ${formatDate(client.last_visit)}` : 'No completed visits yet.';
        const next = data.next_appointment;
        el('profileNextBooking').replaceChildren(...(next
            ? [node('strong', null, next.service_name || 'Service unavailable'), node('p', null, dateTime(next)), bookingLink(next.id)]
            : [node('p', null, 'No upcoming confirmed booking.')]));
        el('profileServices').replaceChildren(...(data.services.length ? data.services.map(service => {
            const row = node('li');
            row.append(node('span', null, service.name), node('small', null, visitLabel(service.visits)));
            return row;
        }) : [node('li', null, 'No completed services on record.')]));
        el('profileHistory').replaceChildren(...data.appointments.map(appointmentRow));
        pager('history', historyPage, data.limit, client.bookings);
    }

    async function loadProfile(id, focusHeading = false) {
        const signal = nextRequest();
        el('profileContent').hidden = true;
        if (!uuid.test(id)) return message('profileMessage', 'Invalid client reference.', true);
        message('profileMessage', 'Loading client profile…');
        try {
            const data = await apiFetch(`/api/v1/clients/${id}?page=${historyPage}`, { signal });
            if (signal.aborted) return;
            showProfile(data);
            el('profileContent').hidden = false;
            message('profileMessage');
            if (focusHeading) el('profileName').focus();
        } catch (err) {
            if (!signal.aborted) message('profileMessage', err.message, true);
        }
    }

    function renderView() {
        clearTimeout(searchTimer);
        const client = new URLSearchParams(location.search).get('client');
        el('clientDirectory').hidden = Boolean(client);
        el('clientProfile').hidden = !client;
        historyPage = 1;
        if (client) {
            window.scrollTo(0, 0);
            loadProfile(client, true);
        } else {
            loadDirectory();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!requireAuth()) return;
        populateUserUI();
        const applyFilters = () => { clearTimeout(searchTimer); directoryPage = 1; loadDirectory(); };
        el('clientFilters').addEventListener('submit', event => { event.preventDefault(); applyFilters(); });
        el('clientSearch').addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(applyFilters, 350);
        });
        el('clientFilter').addEventListener('change', applyFilters);
        el('clientSort').addEventListener('change', applyFilters);
        el('clientPrevious').addEventListener('click', () => { directoryPage--; loadDirectory(); });
        el('clientNext').addEventListener('click', () => { directoryPage++; loadDirectory(); });
        el('historyPrevious').addEventListener('click', () => { historyPage--; loadProfile(new URLSearchParams(location.search).get('client')); });
        el('historyNext').addEventListener('click', () => { historyPage++; loadProfile(new URLSearchParams(location.search).get('client')); });
        el('clientBack').addEventListener('click', event => {
            event.preventDefault();
            const url = new URL(location.href);
            url.searchParams.delete('client');
            history.pushState({}, '', url);
            renderView();
            el('clientSearch').focus();
        });
        window.addEventListener('popstate', renderView);
        renderView();
    });
}());
