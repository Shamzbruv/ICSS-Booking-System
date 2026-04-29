/**
 * ICSS Admin Dashboard — Shared JavaScript
 * Handles: auth, API calls, UI utilities
 */

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = '';  // Same-origin; update if API is on a separate domain

// ── Auth Helpers ──────────────────────────────────────────────────────────────
function getToken() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('_impToken')) return params.get('_impToken');
    return localStorage.getItem('icss_token');
}

function getUser() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('_impToken')) {
        try {
            const token = params.get('_impToken');
            const payload = JSON.parse(atob(token.split('.')[1]));
            return {
                id: payload.id,
                email: payload.email,
                role: payload.role,
                tenant_id: payload.tenant_id,
                name: (payload.email || 'Tenant Admin').split('@')[0]
            };
        } catch (e) {
            console.error('Failed to parse impersonation token', e);
        }
    }

    const raw = localStorage.getItem('icss_user');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function setAuth(token, user) {
    localStorage.setItem('icss_token', token);
    localStorage.setItem('icss_user', JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem('icss_token');
    localStorage.removeItem('icss_user');
}

function requireAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function logout() {
    clearAuth();
    window.location.href = 'login.html';
}

function populateUserUI() {
    const user = getUser();
    if (!user) return;
    const nameEl   = document.getElementById('userName');
    const roleEl   = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl)   nameEl.textContent   = user.name || user.email;
    if (roleEl)   roleEl.textContent   = capitalize(user.role || 'user');
    if (avatarEl) avatarEl.textContent = (user.name || user.email || 'U')[0].toUpperCase();

    // Show super-admin elements
    if (user.role === 'super_admin') {
        document.querySelectorAll('.super-admin-only').forEach(el => el.classList.remove('hidden'));
    }
}

// ── API Fetch ──────────────────────────────────────────────────────────────────
function getTenantSlug() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('tenant')) return params.get('tenant');
    const user = getUser();
    return user ? user.tenant_slug : null;
}

async function apiFetch(path, options = {}) {
    const token = getToken();
    const tenantSlug = getTenantSlug();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : {}),
        ...options.headers
    };

    const res = await fetch(API_BASE + path, { ...options, headers });

    if (res.status === 401) {
        clearAuth();
        window.location.href = 'login.html';
        throw new Error('Session expired. Please log in again.');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// ── UI Utilities ──────────────────────────────────────────────────────────────
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
        return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
}

function formatTime(timeStr) {
    if (!timeStr) return '—';
    try {
        const t = typeof timeStr === 'string' ? timeStr.slice(0, 5) : timeStr;
        const [h, m] = t.split(':');
        const hour   = parseInt(h, 10);
        const ampm   = hour >= 12 ? 'PM' : 'AM';
        const h12    = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    } catch { return timeStr; }
}

function showToast(message, type = 'success') {
    const existing = document.getElementById('icssToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id          = 'icssToast';
    toast.className   = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

function statusBadge(status) {
    const map = {
        confirmed:   { label: 'Confirmed',   cls: 'badge-confirmed' },
        cancelled:   { label: 'Cancelled',   cls: 'badge-cancelled' },
        completed:   { label: 'Completed',   cls: 'badge-completed' },
        no_show:     { label: 'No Show',     cls: 'badge-noshow'    },
        new:         { label: 'New',         cls: 'badge-new'       },
        reviewed:    { label: 'Reviewed',    cls: 'badge-reviewed'  },
        in_progress: { label: 'In Progress', cls: 'badge-progress'  },
        paid:        { label: 'Paid',        cls: 'badge-confirmed' },
        pending:     { label: 'Pending',     cls: 'badge-pending'   },
        pending_payment: { label: 'Pending Payment', cls: 'badge-pending' },
        pending_manual_confirmation: { label: 'Awaiting Bank Transfer', cls: 'badge-new' },
        rejected:    { label: 'Rejected',    cls: 'badge-cancelled' },
        expired:     { label: 'Expired',     cls: 'badge-cancelled' }
    };
    const info = map[status] || { label: capitalize(status), cls: 'badge-default' };
    return `<span class="badge ${info.cls}">${info.label}</span>`;
}

function confirmDialog(message) {
    return window.confirm(message);
}
