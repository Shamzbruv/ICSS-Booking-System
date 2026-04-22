// src/api.js — Centralized API client for all backend requests
const BASE = '/api/v1';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('icss_token');
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
  login:  (body) => apiFetch('/auth/login',    { method: 'POST', body }),
  me:     ()     => apiFetch('/auth/me'),

  // Themes
  themes: ()     => apiFetch('/themes'),

  // Public endpoints
  publicTenant:   (slug) => apiFetch('/public/tenant', { headers: { 'X-Tenant-Slug': slug } }),
  publicServices: (slug) => apiFetch('/public/services', { headers: { 'X-Tenant-Slug': slug } }),

  // Onboarding – create pending signup + PayPal subscription
  createPendingSignup: (body) => apiFetch('/payments/paypal/create-subscription', { method: 'POST', body }),

  // Editor – layout CRUD
  getLayout:  (slug)         => apiFetch(`/tenants/${slug}/layout`),
  saveLayout: (slug, layout) => apiFetch(`/tenants/${slug}/layout`, { method: 'PATCH', body: layout }),

  // Payment Settings
  savePaymentSettings: (slug, settings) => apiFetch(`/tenants/${slug}/payment-settings`, { method: 'PATCH', body: settings }),

  // Services
  getServices:    () => apiFetch('/services'),
  createService:  (service) => apiFetch('/services', { method: 'POST', body: service }),
  updateService:  (id, service) => apiFetch(`/services/${id}`, { method: 'PATCH', body: service }),

  // Admin Bookings
  summary:  () => apiFetch('/admin/summary'),
  bookings: (params = '') => apiFetch(`/bookings?${params}`),
  updateBookingStatus: (id, status, note) => apiFetch(`/bookings/${id}/status`, { method: 'PATCH', body: { status, note } }),
};
