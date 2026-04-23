/**
 * TenantDrawer — Slide-in detail panel for a selected tenant.
 * Shows profile, health, services, recent bookings, payment settings, provisioning.
 * All Phase 1 quick-action buttons are present.
 */

import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useConsole } from './ConsoleContext';
import s from './PlatformConsole.module.css';

const STATUS_COLOR = {
  confirmed: '#4ade80', pending_payment: '#facc15', pending_manual_confirmation: '#fb923c',
  rejected: '#f87171', expired: '#71717a', cancelled: '#71717a',
};

export default function TenantDrawer({ tenant, onClose }) {
  const { startImpersonation } = useConsole();
  const [tab, setTab]       = useState('overview');
  const [health, setHealth] = useState(null);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState(null);
  const [provision, setProvision] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    Promise.all([
      api.platform.getTenantHealth(tenant.id),
      api.platform.getTenantServices(tenant.id),
      api.platform.getTenantBookings(tenant.id),
      api.platform.getTenantPayments(tenant.id),
      api.platform.getTenantProvisioning(tenant.id),
    ]).then(([h, svc, bk, ps, prov]) => {
      setHealth(h);
      setServices(svc.services || []);
      setBookings(bk.bookings || []);
      setPayments(ps.paymentSettings);
      setProvision(prov.provisioning || []);
    }).finally(() => setLoading(false));
  }, [tenant]);

  const impersonate = async (mode) => {
    const reason = mode === 'edit' ? prompt('Reason for edit access:') : '';
    if (mode === 'edit' && !reason) return;
    await startImpersonation(tenant.id, mode, reason || '');
  };

  const openPublicPage = () => window.open(`/book/${tenant.slug}`, '_blank');
  const openEditor     = () => window.open(`/editor?_tenant=${tenant.slug}`, '_blank');
  const openAdmin      = () => window.open(`/admin?tenant=${tenant.slug}`, '_blank');

  if (!tenant) return null;

  const branding = tenant.branding || {};
  const accent   = branding.accent_color || '#7c6ef7';

  return (
    <div className={s.drawer} onClick={onClose}>
      <div className={s.drawer__panel} onClick={e => e.stopPropagation()} style={{ '--accent': accent }}>
        {/* Header */}
        <div className={s.drawer__header}>
          <div>
            <div className={s.drawer__name}>{tenant.name}</div>
            <div className={s.drawer__slug}>/{tenant.slug}</div>
          </div>
          <div className={s.drawer__headerActions}>
            <button className={s.actionBtn} onClick={openPublicPage} title="Open Public Page">🌐 Public</button>
            <button className={s.actionBtn} onClick={openEditor}     title="Open Editor">🎨 Editor</button>
            <button className={s.actionBtn} onClick={openAdmin}      title="Open Admin">🛠 Admin</button>
            <button className={`${s.actionBtn} ${s['actionBtn--primary']}`} onClick={() => impersonate('read_only')} title="Impersonate">
              👁 View As
            </button>
            <button className={s.drawer__close} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Tab bar */}
        <div className={s.drawer__tabs}>
          {['overview','services','bookings','payments','provisioning'].map(t => (
            <button key={t} className={`${s.drawer__tab} ${tab === t ? s['drawer__tab--active'] : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className={s.drawer__body}>
          {loading ? <div className={s.loading}>Loading…</div> : (
            <>
              {/* ── Overview ── */}
              {tab === 'overview' && (
                <div>
                  {/* Health warnings */}
                  {health?.warnings?.length > 0 && (
                    <div className={s.healthWarnings}>
                      <div className={s.healthWarnings__title}>⚠️ Health Warnings</div>
                      {health.warnings.map(w => (
                        <div key={w.code} className={s.healthWarning}>{w.message}</div>
                      ))}
                    </div>
                  )}
                  {health?.healthy && <div className={s.healthOk}>✅ All health checks passed</div>}

                  <div className={s.infoGrid}>
                    <InfoRow label="Owner" value={tenant.owner_name || '—'} />
                    <InfoRow label="Email" value={tenant.owner_email || '—'} />
                    <InfoRow label="Plan" value={tenant.plan_id || '—'} />
                    <InfoRow label="Theme" value={tenant.theme_name || 'None'} />
                    <InfoRow label="Active" value={tenant.active ? '✅ Yes' : '❌ No'} />
                    <InfoRow label="Created" value={new Date(tenant.created_at).toLocaleDateString()} />
                    <InfoRow label="Total Bookings" value={tenant.total_bookings || 0} />
                    <InfoRow label="Active Services" value={tenant.active_services || 0} />
                    <InfoRow label="Payment Mode" value={tenant.default_payment_mode || '—'} />
                    <InfoRow label="WiPay" value={tenant.wipay_enabled ? '✅ Enabled' : '—'} />
                    <InfoRow label="Manual Transfer" value={tenant.manual_payment_enabled ? '✅ Enabled' : '—'} />
                  </div>

                  {branding.logo_url && (
                    <div className={s.brandPreview}>
                      <img src={branding.logo_url} alt="Logo" className={s.brandPreview__logo} />
                    </div>
                  )}
                </div>
              )}

              {/* ── Services ── */}
              {tab === 'services' && (
                <div>
                  {services.length === 0 ? <div className={s.empty}>No services configured.</div> : (
                    <table className={s.table}>
                      <thead><tr><th>Name</th><th>Duration</th><th>Price</th><th>Mode</th><th>Active</th></tr></thead>
                      <tbody>
                        {services.map(svc => (
                          <tr key={svc.id}>
                            <td>{svc.name}</td>
                            <td>{svc.duration_minutes} min</td>
                            <td>{svc.currency} {Number(svc.price || 0).toLocaleString()}</td>
                            <td><span className={s.badge}>{svc.payment_mode || 'tenant_default'}</span></td>
                            <td>{svc.active ? '✅' : '❌'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ── Bookings ── */}
              {tab === 'bookings' && (
                <div>
                  {bookings.length === 0 ? <div className={s.empty}>No bookings yet.</div> : (
                    <table className={s.table}>
                      <thead><tr><th>Customer</th><th>Service</th><th>Date</th><th>Status</th></tr></thead>
                      <tbody>
                        {bookings.map(b => (
                          <tr key={b.id}>
                            <td>{b.name}</td>
                            <td>{b.service_name || '—'}</td>
                            <td>{b.booking_date ? new Date(b.booking_date).toLocaleDateString() : '—'}</td>
                            <td>
                              <span className={s.statusDot} style={{ background: STATUS_COLOR[b.status] || '#71717a' }} />
                              {b.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ── Payments ── */}
              {tab === 'payments' && (
                <div>
                  {!payments ? <div className={s.empty}>No payment settings configured.</div> : (
                    <div className={s.infoGrid}>
                      <InfoRow label="Default Mode" value={payments.payment_mode || '—'} />
                      <InfoRow label="WiPay" value={payments.wipay_enabled ? '✅ Enabled' : 'Disabled'} />
                      <InfoRow label="Manual Transfer" value={payments.manual_payment_enabled ? '✅ Enabled' : 'Disabled'} />
                      <InfoRow label="Hold Timeout" value={`${payments.hold_timeout_minutes || 30} min`} />
                      <InfoRow label="Transfer Instructions" value={payments.manual_transfer_instructions ? '✅ Set' : '⚠️ Missing'} />
                    </div>
                  )}
                </div>
              )}

              {/* ── Provisioning ── */}
              {tab === 'provisioning' && (
                <div>
                  {provision.length === 0 ? <div className={s.empty}>No provisioning records found.</div> : (
                    provision.map(p => (
                      <div key={p.id} className={s.provRow}>
                        <div className={s.provRow__status}>{p.status}</div>
                        <div className={s.provRow__detail}>
                          <span>{p.admin_email}</span>
                          <span style={{ opacity: 0.5, fontSize: 12 }}>{new Date(p.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className={s.infoRow}>
      <span className={s.infoRow__label}>{label}</span>
      <span className={s.infoRow__value}>{String(value)}</span>
    </div>
  );
}
