// src/api.js — Centralized API client for all backend requests
const BASE = '/api/v1';

// apiFetch — uses owner token from localStorage by default.
// Pass overrideToken to use an impersonation overlay token instead.
async function apiFetch(path, options = {}, overrideToken = null) {
  const token = overrideToken || localStorage.getItem('icss_token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, data: err });
  }
  return res.json();
}

export const api = {
  // Auth
  login:  (body) => apiFetch('/auth/login', { method: 'POST', body }),
  me:     ()     => apiFetch('/auth/me'),
  forgotPassword: (email) => apiFetch('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (email, token, newPassword) => apiFetch('/auth/reset-password', { method: 'POST', body: { email, token, newPassword } }),

  // Themes
  themes: () => apiFetch('/themes'),

  // Public endpoints
  publicTenant:   (slug) => apiFetch('/public/tenant',   { headers: { 'X-Tenant-Slug': slug } }),
  publicServices: (slug) => apiFetch('/public/services', { headers: { 'X-Tenant-Slug': slug } }),

  // Public Booking Flow
  publicAvailability: (slug, date, serviceId) =>
    apiFetch(`/availability?date=${date}${serviceId ? `&service_id=${serviceId}` : ''}`, {
      headers: { 'X-Tenant-Slug': slug },
    }),
  publicCreateBooking: (slug, body) =>
    apiFetch('/bookings', { method: 'POST', body, headers: { 'X-Tenant-Slug': slug } }),
  publicVerifyPayment: (slug, bookingId, transactionId) =>
    apiFetch(`/bookings/${bookingId}/verify-payment`, {
      method: 'POST',
      body: { transaction_id: transactionId },
      headers: { 'X-Tenant-Slug': slug },
    }),

  // Onboarding – create pending signup + PayPal subscription
  createPendingSignup: (body) => apiFetch('/payments/paypal/create-subscription', { method: 'POST', body }),

  // Editor – layout CRUD
  getLayout:  (slug)         => apiFetch(`/tenants/${slug}/layout`),
  saveLayout: (slug, layout) => apiFetch(`/tenants/${slug}/layout`, { method: 'PATCH', body: layout }),

  // Payment Settings
  savePaymentSettings: (slug, settings) => apiFetch(`/tenants/${slug}/payment-settings`, { method: 'PATCH', body: settings }),

  // Services
  getServices:   ()           => apiFetch('/services'),
  createService: (service)    => apiFetch('/services', { method: 'POST', body: service }),
  updateService: (id, service)=> apiFetch(`/services/${id}`, { method: 'PATCH', body: service }),

  // Admin Bookings
  summary:  ()           => apiFetch('/admin/summary'),
  bookings: (params = '') => apiFetch(`/bookings?${params}`),
  updateBookingStatus: (id, status, note) => apiFetch(`/bookings/${id}/status`, { method: 'PATCH', body: { status, note } }),

  // ── Platform Console (platform_owner only) ────────────────────────────────
  // All platform calls use the owner's main localStorage token automatically.
  platform: {
    // Tenant management
    listTenants:          (search = '', page = 1) => apiFetch(`/platform/tenants?search=${encodeURIComponent(search)}&page=${page}`),
    getTenant:            (id)   => apiFetch(`/platform/tenants/${id}`),
    getTenantHealth:      (id)   => apiFetch(`/platform/tenants/${id}/health`),
    getTenantServices:    (id)   => apiFetch(`/platform/tenants/${id}/services`),
    getTenantBookings:    (id)   => apiFetch(`/platform/tenants/${id}/bookings`),
    getTenantPayments:    (id)   => apiFetch(`/platform/tenants/${id}/payment-settings`),
    getTenantProvisioning:(id)   => apiFetch(`/platform/tenants/${id}/provisioning`),

    // Themes
    getThemes:            ()         => apiFetch('/platform/themes'),
    getThemeTenants:      (themeId)  => apiFetch(`/platform/themes/${themeId}/tenants`),

    // Diagnostics
    getJobs:              ()          => apiFetch('/platform/jobs'),
    getAuditLog:          (tenantId)  => apiFetch(`/platform/audit-log${tenantId ? `?tenantId=${tenantId}` : ''}`),
    getPayments:          (tenantId)  => apiFetch(`/platform/payments${tenantId ? `?tenantId=${tenantId}` : ''}`),
    getBuildInfo:         ()          => apiFetch('/platform/build-info'),
    getEnvCheck:          ()          => apiFetch('/platform/env-check'),

    // Impersonation — returns { session_id, token, expires_at, mode, tenant }
    // The returned token is the OVERLAY token — kept in React state only (never localStorage)
    startImpersonation:   (tenantId, mode, reason) =>
      apiFetch(`/platform/impersonate/tenant/${tenantId}`, { method: 'POST', body: { mode, reason } }),
    endImpersonation:     (sessionId) =>
      apiFetch(`/platform/impersonation/${sessionId}/end`, { method: 'POST' }),
    elevateImpersonation: (sessionId, reason) =>
      apiFetch(`/platform/impersonation/${sessionId}/elevate`, { method: 'POST', body: { reason } }),
    getActiveSessions:    () => apiFetch('/platform/impersonation/active'),

    // Safe write actions
    expireHold:           (bookingId) =>
      apiFetch(`/platform/bookings/${bookingId}/expire-hold`, { method: 'POST' }),
    replayProvisioning:   (tenantId)  =>
      apiFetch(`/platform/tenants/${tenantId}/replay-provisioning`, { method: 'POST' }),
  },
};
