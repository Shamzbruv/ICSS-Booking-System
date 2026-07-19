/**
 * ICSS Admin Dashboard — Shared JavaScript
 * Handles: auth, API calls, UI utilities
 */

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = '';  // Same-origin; update if API is on a separate domain

// ── Impersonation Token Persistence ──────────────────────────────────────────
// When the platform console opens an admin page with ?_impToken=xxx&tenant=xxx,
// save both to sessionStorage so they survive page-to-page navigation.
(function bootstrapImpersonation() {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('_impToken');
    const ten = params.get('tenant');
    if (tok) sessionStorage.setItem('_impToken', tok);
    if (ten) sessionStorage.setItem('_impTenant', ten);
})();

// ── Auth Helpers ──────────────────────────────────────────────────────────────
function getImpToken()  { return new URLSearchParams(window.location.search).get('_impToken') || sessionStorage.getItem('_impToken'); }
function getImpTenant() { return new URLSearchParams(window.location.search).get('tenant')    || sessionStorage.getItem('_impTenant'); }

function getToken() {
    const imp = getImpToken();
    if (imp) return imp;
    return localStorage.getItem('icss_token');
}

function getUser() {
    const imp = getImpToken();
    if (imp) {
        try {
            const payload = JSON.parse(atob(imp.split('.')[1]));
            return {
                id: payload.id,
                email: payload.email,
                role: payload.role,
                tenant_id: payload.tenant_id,
                tenant_slug: payload.tenant_slug || getImpTenant(),
                name: payload.tenant_name ? `Impersonating: ${payload.tenant_name}` : (payload.name || payload.email || 'Tenant Admin').split('@')[0]
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
    // Storage can be unavailable in strict/private browser modes. A failed
    // cleanup must never prevent the user from reaching the login screen.
    try {
        localStorage.removeItem('icss_token');
        localStorage.removeItem('icss_user');
    } catch (error) {
        console.warn('Unable to clear persistent authentication storage', error);
    }
    try {
        sessionStorage.removeItem('_impToken');
        sessionStorage.removeItem('_impTenant');
    } catch (error) {
        console.warn('Unable to clear impersonation storage', error);
    }
}

function requireAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    const user = getUser();
    if (user?.role === 'platform_partner' && !window.location.pathname.endsWith('/contracts.html') && !window.location.pathname.endsWith('contracts.html')) {
        window.location.href = 'contracts.html';
        return false;
    }
    return true;
}

function logout(event) {
    event?.preventDefault?.();
    clearAuth();
    window.location.replace('login.html');
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
    if (user.role === 'super_admin' || user.role === 'platform_owner') {
        document.querySelectorAll('.super-admin-only').forEach(el => el.classList.remove('hidden'));
    }
}

// ── API Fetch ──────────────────────────────────────────────────────────────────
function getTenantSlug() {
    // Priority: URL param → sessionStorage impersonation → user object
    const params = new URLSearchParams(window.location.search);
    if (params.has('tenant')) return params.get('tenant');
    const imp = sessionStorage.getItem('_impTenant');
    if (imp) return imp;
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

    // Serialize body to JSON string if it's a plain object
    let body = options.body;
    if (body !== undefined && body !== null && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
        body = JSON.stringify(body);
    }

    const res = await fetch(API_BASE + path, { ...options, headers, body });

    if (res.status === 401) {
        clearAuth();
        window.location.href = 'login.html';
        throw new Error('Session expired. Please log in again.');
    }

    const data = await res.json();
    if (!res.ok) {
        const error = new Error(data.error || `HTTP ${res.status}`);
        error.status = res.status;
        if (data && typeof data === 'object') Object.assign(error, data);
        throw error;
    }
    return data;
}

// ── UI Utilities ──────────────────────────────────────────────────────────────
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractDateParts(dateValue) {
    if (!dateValue) return null;

    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
        return {
            year: dateValue.getUTCFullYear(),
            month: dateValue.getUTCMonth() + 1,
            day: dateValue.getUTCDate()
        };
    }

    const match = String(dateValue).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;

    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3])
    };
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const parts = extractDateParts(dateStr);
        if (!parts) return dateStr;
        const d = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
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
        pending_after_hours_confirmation: { label: 'After-hours Request', cls: 'badge-new' },
        rejected:    { label: 'Rejected',    cls: 'badge-cancelled' },
        expired:     { label: 'Expired',     cls: 'badge-cancelled' }
    };
    const info = map[status] || { label: capitalize(status), cls: 'badge-default' };
    return `<span class="badge ${info.cls}">${info.label}</span>`;
}

function confirmDialog(message) {
    return window.confirm(message);
}

// ── Help & Support ───────────────────────────────────────────────────────────
const SUPPORT_META_FALLBACK = {
    supportEmail: 'icssbookingsystem@gmail.com',
    supportLabel: 'ICSS Developer Support'
};

let supportMetaCache = { ...SUPPORT_META_FALLBACK };
let supportMetaPromise = null;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getAdminDashboardHref() {
    const tenantSlug = getTenantSlug();
    const params = new URLSearchParams(window.location.search);
    const impToken = params.get('_impToken') || sessionStorage.getItem('_impToken');
    const search = new URLSearchParams();
    if (tenantSlug) search.set('tenant', tenantSlug);
    if (impToken) search.set('_impToken', impToken);
    search.set('tour', '1');
    return `index.html?${search.toString()}`;
}

function getSafeCurrentPageUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('_impToken');
    return url.toString();
}

async function getSupportMeta() {
    if (supportMetaPromise) return supportMetaPromise;

    supportMetaPromise = apiFetch('/api/v1/admin/support-meta')
        .then((data) => {
            supportMetaCache = {
                supportEmail: data.supportEmail || SUPPORT_META_FALLBACK.supportEmail,
                supportLabel: data.supportLabel || SUPPORT_META_FALLBACK.supportLabel
            };
            syncSupportMetaUI();
            return supportMetaCache;
        })
        .catch(() => {
            supportMetaCache = { ...SUPPORT_META_FALLBACK };
            syncSupportMetaUI();
            return supportMetaCache;
        });

    return supportMetaPromise;
}

function syncSupportMetaUI() {
    const emailLabel = document.getElementById('supportDeveloperEmail');
    const emailLink = document.getElementById('supportEmailLink');
    const supportEmail = supportMetaCache.supportEmail || SUPPORT_META_FALLBACK.supportEmail;
    const supportLabel = supportMetaCache.supportLabel || SUPPORT_META_FALLBACK.supportLabel;

    if (emailLabel) {
        emailLabel.textContent = `${supportLabel}: ${supportEmail}`;
    }

    if (emailLink) {
        emailLink.href = buildSupportMailto(supportEmail);
    }
}

function buildSupportMailto(email) {
    const user = getUser();
    const subject = 'ICSS Dashboard Help Request';
    const bodyLines = [
        `Tenant: ${getTenantSlug() || 'Unknown'}`,
        `User: ${user?.name || user?.email || 'Unknown'}`,
        `Page: ${getSafeCurrentPageUrl()}`,
        '',
        'Please describe the issue here:'
    ];
    return `mailto:${encodeURIComponent(email || SUPPORT_META_FALLBACK.supportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
}

function ensureSupportModal() {
    if (document.getElementById('supportModal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'supportModal';
    overlay.className = 'modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <div class="modal support-modal" role="dialog" aria-modal="true" aria-labelledby="supportModalTitle">
            <div class="modal-header">
                <div>
                    <p class="support-kicker">Help & Support</p>
                    <h2 class="modal-title" id="supportModalTitle">Need help with your dashboard?</h2>
                </div>
                <button class="modal-close" type="button" aria-label="Close help dialog" id="supportModalClose">&times;</button>
            </div>

            <div class="support-callout">
                <p class="support-callout__title">Reach the developer team or restart the tutorial.</p>
                <p class="support-callout__copy">Use this space to send a real support request, explain a bug, or ask for help with anything in your booking system.</p>
                <div class="support-callout__actions">
                    <button class="btn btn-secondary" type="button" id="supportRestartTourBtn">↺ Start Tutorial Again</button>
                    <a class="btn btn-secondary" id="supportEmailLink" href="${buildSupportMailto(SUPPORT_META_FALLBACK.supportEmail)}">✉ Email Developer</a>
                </div>
            </div>

            <div class="support-contact" id="supportDeveloperEmail">ICSS Developer Support: ${SUPPORT_META_FALLBACK.supportEmail}</div>

            <form id="supportRequestForm" class="support-form">
                <div class="support-form__grid">
                    <div class="form-group">
                        <label for="supportCategory">Category</label>
                        <select id="supportCategory" required>
                            <option value="general">General Help</option>
                            <option value="bug">Bug / Something Broken</option>
                            <option value="tutorial">Tutorial / Onboarding</option>
                            <option value="billing">Billing / Account</option>
                            <option value="feature">Feature Request</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="supportSubject">Subject</label>
                        <input id="supportSubject" type="text" maxlength="120" placeholder="Briefly describe what you need help with" required>
                    </div>
                </div>

                <div class="form-group">
                    <label for="supportReplyTo">Signed-in account</label>
                    <input id="supportReplyTo" type="text" readonly>
                </div>

                <div class="form-group">
                    <label for="supportMessage">Message</label>
                    <textarea id="supportMessage" rows="5" maxlength="4000" placeholder="Tell the developer what happened, what page you were on, and what you expected to happen." required></textarea>
                </div>

                <p class="support-note">The current page and tenant handle are automatically included with your message.</p>

                <div class="modal-footer">
                    <button class="btn btn-secondary" type="button" id="supportCancelBtn">Close</button>
                    <button class="btn btn-primary" type="submit" id="supportSubmitBtn">Send to Developer</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeSupportModal();
    });

    document.getElementById('supportModalClose')?.addEventListener('click', closeSupportModal);
    document.getElementById('supportCancelBtn')?.addEventListener('click', closeSupportModal);
    document.getElementById('supportRestartTourBtn')?.addEventListener('click', restartDashboardTutorial);
    document.getElementById('supportRequestForm')?.addEventListener('submit', submitSupportRequest);

    syncSupportMetaUI();
}

function ensureHelpMenuEntry() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || !getToken() || document.getElementById('helpNavBtn')) return;

    const helpButton = document.createElement('button');
    helpButton.type = 'button';
    helpButton.id = 'helpNavBtn';
    helpButton.className = 'nav-item';
    helpButton.innerHTML = '<span class="nav-icon">🛟</span> Help';
    helpButton.addEventListener('click', openSupportModal);
    nav.appendChild(helpButton);
}

function openSupportModal() {
    if (!getToken()) return;
    ensureSupportModal();

    const modal = document.getElementById('supportModal');
    const replyField = document.getElementById('supportReplyTo');
    const subjectField = document.getElementById('supportSubject');
    const user = getUser();

    if (replyField) {
        replyField.value = user?.email || 'Signed in account';
    }

    if (subjectField && !subjectField.value.trim()) {
        subjectField.value = `Help with ${document.title.replace(/^ICSS Admin\s*—\s*/i, '') || 'my dashboard'}`;
    }

    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    getSupportMeta();
    if (window.innerWidth <= 900) {
        closeSidebar();
    }

    document.getElementById('supportMessage')?.focus({ preventScroll: false });
}

function closeSupportModal() {
    const modal = document.getElementById('supportModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
}

function restartDashboardTutorial() {
    closeSupportModal();

    if (window.dashboardTour && typeof window.dashboardTour.start === 'function' && /index\.html$/i.test(window.location.pathname)) {
        window.dashboardTour.start({ force: true, stepIndex: 0 });
        return;
    }

    window.location.href = getAdminDashboardHref();
}

async function submitSupportRequest(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('supportSubmitBtn');
    const category = document.getElementById('supportCategory')?.value || 'general';
    const subject = document.getElementById('supportSubject')?.value.trim() || '';
    const message = document.getElementById('supportMessage')?.value.trim() || '';

    if (!subject) {
        showToast('Please add a short subject for your support request.', 'error');
        return;
    }

    if (message.length < 12) {
        showToast('Please add a few details so the developer knows what went wrong.', 'error');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
    }

    try {
        const response = await apiFetch('/api/v1/admin/support-request', {
            method: 'POST',
            body: {
                category,
                subject,
                message,
                pageUrl: getSafeCurrentPageUrl()
            }
        });

        if (response?.supportEmail) {
            supportMetaCache.supportEmail = response.supportEmail;
            syncSupportMetaUI();
        }

        document.getElementById('supportRequestForm')?.reset();
        const replyField = document.getElementById('supportReplyTo');
        const user = getUser();
        if (replyField) {
            replyField.value = user?.email || 'Signed in account';
        }
        closeSupportModal();
        showToast(response?.message || 'Your support request was sent successfully.');
    } catch (error) {
        showToast(error.message || 'We could not send your support request right now.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send to Developer';
        }
    }
}

// ── Mobile Navigation ─────────────────────────────────────────────────────────
function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar) return;
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('show');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('open')) {
        closeSidebar();
        return;
    }
    openSidebar();
}

function setupMobileNav() {
    const hamburger = document.getElementById('hamburgerBtn');
    const sidebar   = document.getElementById('sidebar');
    const backdrop  = document.getElementById('sidebarBackdrop');
    if (!hamburger || !sidebar) return;

    hamburger.addEventListener('click', () => toggleSidebar());
    if (backdrop) {
        backdrop.addEventListener('click', () => closeSidebar());
    }
}

window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.toggleSidebar = toggleSidebar;

// Auto-init mobile nav on every page (runs after DOM ready)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.logout-btn').forEach((button) => {
        button.addEventListener('click', logout);
    });
    setupMobileNav();
    ensureHelpMenuEntry();
    if (getToken() && document.querySelector('.sidebar-nav')) {
        ensureSupportModal();
    }
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.getElementById('supportModal')?.classList.contains('open')) {
            closeSupportModal();
        }
    });
});
