/**
 * PlatformConsole — Main page shell.
 *
 * Routes:
 *  /platform  — Platform Owner Console (platform_owner role only)
 *
 * Layout:
 *  ┌─ Sidebar ─┬─ Main area ──────────────────────┐
 *  │  nav       │  search + content               │
 *  └────────────┴─────────────────────────────────┘
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ConsoleProvider, useConsole } from './ConsoleContext';
import ImpersonationBanner from './ImpersonationBanner';
import TenantDrawer from './TenantDrawer';
import { api } from '../../api';
import { useNoIndex } from '../../hooks/useNoIndex';
import s from './PlatformConsole.module.css';


// ── Login screen ──────────────────────────────────────────────────────────────
function ConsoleLogin() {
  const { login, authError } = useConsole();
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [err, setErr]       = useState('');
  const [busy, setBusy]     = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await login(email, pass); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className={s.loginPage}>
      <div className={s.loginCard}>
        <div className={s.loginCard__icon}>⚙️</div>
        <h1 className={s.loginCard__title}>Platform Console</h1>
        <p className={s.loginCard__sub}>ICSS Booking System — Owner Access</p>
        {(err || authError) && <div className={s.errorBanner}>{err || authError}</div>}
        <form onSubmit={handleLogin} className={s.loginForm}>
          <input className={s.loginInput} type="email" placeholder="Owner email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className={s.loginInput} type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} required />
          <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '8px' }}>
            <a href="/forgot-password" style={{ color: '#7c6ef7', fontSize: '13px', textDecoration: 'none' }}>Forgot Password?</a>
          </div>
          <button className={s.btnPrimary} type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  );
}

// ── Sidebar nav ────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'tenants',    icon: '🏢', label: 'Tenants' },
  { id: 'themes',     icon: '🎨', label: 'Themes' },
  { id: 'jobs',       icon: '⚙️', label: 'Jobs & Queue' },
  { id: 'payments',   icon: '💳', label: 'Payments' },
  { id: 'audit',      icon: '📋', label: 'Audit Log' },
  { id: 'system',     icon: '🖥', label: 'System' },
];

// ── Tenants view ──────────────────────────────────────────────────────────────
function TenantsView() {
  const { startImpersonation } = useConsole();
  const [tenants, setTenants]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const searchRef               = useRef();
  const debounceRef             = useRef();

  const load = useCallback((q = '') => {
    setLoading(true);
    api.platform.listTenants(q)
      .then(r => { setTenants(r.tenants); setTotal(r.total); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, []);

  const handleSearch = (v) => {
    setSearch(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(v), 350);
  };

  const quickImpersonate = async (tenant, mode = 'read_only') => {
    const session = await startImpersonation(tenant.id, mode, 'Console Quick Access');
    window.open(`/admin?tenant=${tenant.slug}&_impToken=${session.token}`, '_blank');
  };

  const quickResetPassword = async (tenant) => {
    if (!window.confirm(`Send password reset email to ${tenant.owner_email}?`)) return;
    try {
      await api.platform.resetTenantPassword(tenant.id);
      alert('Password reset email sent.');
    } catch (e) { alert(e.message); }
  };

  const quickToggleStatus = async (tenant) => {
    const action = tenant.active ? 'Suspend' : 'Activate';
    if (!window.confirm(`Are you sure you want to ${action} ${tenant.name}?`)) return;
    try {
      await api.platform.updateTenantStatus(tenant.id, !tenant.active);
      load();
    } catch (e) { alert(e.message); }
  };

  const quickDelete = async (tenant) => {
    const code = window.prompt(`Type "DELETE" to permanently delete ${tenant.name} and ALL their data.`);
    if (code !== 'DELETE') return;
    try {
      await api.platform.deleteTenant(tenant.id);
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className={s.view}>
      <div className={s.view__header}>
        <h2 className={s.view__title}>Tenants <span className={s.view__count}>{total}</span></h2>
        <input
          ref={searchRef}
          className={s.searchInput}
          placeholder="Search by name or handle…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {loading ? <div className={s.loading}>Loading tenants…</div> : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Handle</th>
                <th>Owner</th>
                <th>Theme</th>
                <th>Svcs</th>
                <th>Bookings</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} className={s.tableRow} onClick={() => setSelected(t)}>
                  <td className={s.table__name}>
                    {t.branding?.logo_url && <img src={t.branding.logo_url} className={s.table__logo} alt="" />}
                    <strong>{t.name}</strong>
                  </td>
                  <td className={s.table__slug}>{t.slug}</td>
                  <td>{t.owner_email || '—'}</td>
                  <td>{t.theme_name || <span className={s.muted}>None</span>}</td>
                  <td>{t.active_services || 0}</td>
                  <td>{t.total_bookings || 0}</td>
                  <td>
                    {t.default_payment_mode
                      ? <span className={s.badge}>{t.default_payment_mode}</span>
                      : <span className={s.muted}>—</span>
                    }
                  </td>
                  <td>
                    <span className={`${s.statusPill} ${t.active ? s['statusPill--active'] : s['statusPill--inactive']}`}>
                      {t.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={s.rowActions}>
                      <a href={`/${t.slug}`} target="_blank" rel="noreferrer" className={s.rowBtn} title="Open Public Page">🌐</a>
                      <a href={`/editor?_tenant=${t.slug}`} target="_blank" rel="noreferrer" className={s.rowBtn} title="Open Editor">🎨</a>
                      <button className={s.rowBtn} title="Reset Password" onClick={() => quickResetPassword(t)}>🔑</button>
                      <button className={s.rowBtn} title={t.active ? "Suspend Account" : "Activate Account"} onClick={() => quickToggleStatus(t)}>{t.active ? '🛑' : '✅'}</button>
                      <button className={s.rowBtn} title="Delete Account" onClick={() => quickDelete(t)}>🗑️</button>
                      <button className={s.rowBtn} title="Open Admin (Edit)" onClick={() => quickImpersonate(t, 'edit')}>🛠</button>
                      <button className={`${s.rowBtn} ${s['rowBtn--imp']}`} title="Impersonate (Read-Only)" onClick={() => quickImpersonate(t, 'read_only')}>👁</button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={9} className={s.empty}>No tenants found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && <TenantDrawer tenant={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── Themes view ───────────────────────────────────────────────────────────────
function ThemesView() {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.platform.getThemes()
      .then(r => setThemes(r.themes || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={s.view}>
      <div className={s.view__header}>
        <h2 className={s.view__title}>Theme Library <span className={s.view__count}>{themes.length}</span></h2>
      </div>
      {loading ? <div className={s.loading}>Loading…</div> : (
        <div className={s.themeGrid}>
          {themes.map(th => (
            <div key={th.id} className={s.themeCard}>
              <div className={s.themeCard__cat}>{th.category}</div>
              <div className={s.themeCard__name}>{th.name}</div>
              <div className={s.themeCard__footer}>
                <span className={s.muted}>{th.tenant_count || 0} tenants</span>
                {th.template_path && (
                  <a href={th.template_path} target="_blank" rel="noreferrer" className={s.rowBtn}>Preview</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Jobs / Queue view ─────────────────────────────────────────────────────────
function JobsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.platform.getJobs()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={s.view}>
      <div className={s.view__header}><h2 className={s.view__title}>Jobs & Queue</h2></div>
      {loading ? <div className={s.loading}>Loading…</div> : (
        <>
          <Section title={`⚠️ Failed Jobs (${data?.failed?.length || 0})`}>
            {(data?.failed || []).length === 0 ? <div className={s.empty}>No failed jobs. ✅</div> : (
              <table className={s.table}>
                <thead><tr><th>Name</th><th>State</th><th>Created</th><th>Error</th></tr></thead>
                <tbody>
                  {data.failed.map(j => (
                    <tr key={j.id}>
                      <td>{j.name}</td>
                      <td><span className={`${s.badge} ${s['badge--danger']}`}>{j.state}</span></td>
                      <td>{new Date(j.created_on).toLocaleString()}</td>
                      <td className={s.muted}>{j.output?.message?.slice(0,80) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
          <Section title={`⏳ Pending Jobs (${data?.pending?.length || 0})`}>
            {(data?.pending || []).length === 0 ? <div className={s.empty}>Queue is clear. ✅</div> : (
              <table className={s.table}>
                <thead><tr><th>Name</th><th>State</th><th>Created</th></tr></thead>
                <tbody>{data.pending.map(j => (
                  <tr key={j.id}><td>{j.name}</td><td>{j.state}</td><td>{new Date(j.created_on).toLocaleString()}</td></tr>
                ))}</tbody>
              </table>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

// ── Payments view ─────────────────────────────────────────────────────────────
function PaymentsView() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const STATUS_COLOR = { paid: '#4ade80', pending: '#facc15', failed: '#f87171' };

  useEffect(() => {
    api.platform.getPayments()
      .then(r => setPayments(r.payments || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={s.view}>
      <div className={s.view__header}><h2 className={s.view__title}>Recent Payments</h2></div>
      {loading ? <div className={s.loading}>Loading…</div> : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Tenant</th><th>Customer</th><th>Service</th><th>Amount</th><th>Provider</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td>{p.tenant_name}</td>
                  <td>{p.customer_name}</td>
                  <td>{p.service_name || '—'}</td>
                  <td>{Number(p.amount_due || 0).toLocaleString()}</td>
                  <td><span className={s.badge}>{p.provider}</span></td>
                  <td><span className={s.statusDot} style={{ background: STATUS_COLOR[p.status] || '#71717a' }} />{p.status}</td>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={7} className={s.empty}>No payments found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Audit log view ────────────────────────────────────────────────────────────
function AuditView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.platform.getAuditLog()
      .then(r => setEntries(r.entries || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={s.view}>
      <div className={s.view__header}><h2 className={s.view__title}>Audit Log</h2></div>
      {loading ? <div className={s.loading}>Loading…</div> : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Action</th><th>Actor</th><th>Entity</th><th>Timestamp</th></tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td><span className={s.badge}>{e.action}</span></td>
                  <td>{e.actor_email || '—'}</td>
                  <td>{e.entity ? `${e.entity}${e.entity_id ? ' #'+e.entity_id.slice(0,8) : ''}` : '—'}</td>
                  <td className={s.muted}>{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={4} className={s.empty}>No audit entries.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── System / build info view ──────────────────────────────────────────────────
function SystemView() {
  const [info, setInfo]     = useState(null);
  const [env, setEnv]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.platform.getBuildInfo(), api.platform.getEnvCheck()])
      .then(([b, e]) => { setInfo(b); setEnv(e); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={s.view}>
      <div className={s.view__header}><h2 className={s.view__title}>System Info</h2></div>
      {loading ? <div className={s.loading}>Loading…</div> : (
        <>
          <Section title="Build Info">
            <div className={s.infoGrid}>
              <InfoRow label="Version"    value={info?.version} />
              <InfoRow label="Git Ref"    value={info?.gitRef} />
              <InfoRow label="Node"       value={info?.nodeVersion} />
              <InfoRow label="Env"        value={info?.env} />
              <InfoRow label="Uptime"     value={`${Math.round(info?.uptime / 60)} min`} />
              <InfoRow label="DB"         value={info?.dbHealthy ? '✅ Connected' : '❌ Down'} />
              <InfoRow label="App URL"    value={info?.publicAppUrl} />
            </div>
          </Section>

          <Section title="Environment Variables">
            <table className={s.table}>
              <thead><tr><th>Key</th><th>Required</th><th>Present</th></tr></thead>
              <tbody>
                {[...(env?.required || []).map(e => ({...e, req: true})),
                   ...(env?.optional || []).map(e => ({...e, req: false}))].map(e => (
                  <tr key={e.key}>
                    <td><code>{e.key}</code></td>
                    <td>{e.req ? '✅ Required' : <span className={s.muted}>Optional</span>}</td>
                    <td>{e.present ? '✅ Set' : <span style={{color:'#f87171'}}>❌ Missing</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </>
      )}
    </div>
  );
}

// ── Reusable helpers ──────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className={s.section}>
      <div className={s.section__title}>{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className={s.infoRow}>
      <span className={s.infoRow__label}>{label}</span>
      <span className={s.infoRow__value}>{String(value ?? '—')}</span>
    </div>
  );
}

const VIEW_MAP = {
  tenants:  <TenantsView />,
  themes:   <ThemesView />,
  jobs:     <JobsView />,
  payments: <PaymentsView />,
  audit:    <AuditView />,
  system:   <SystemView />,
};

// ── Console shell ─────────────────────────────────────────────────────────────
function ConsoleShell() {
  const { platformUser, logout, loading, authError, isImpersonating } = useConsole();
  const [activeView, setActiveView] = useState('tenants');

  if (loading) return <div className={s.fullscreen}><div className={s.spinner} /></div>;
  if (!platformUser) return <ConsoleLogin />;

  return (
    <div className={s.shell}>
      <ImpersonationBanner />

      {/* Sidebar */}
      <aside className={s.sidebar}>
        <div className={s.sidebar__brand}>
          <span className={s.sidebar__brandIcon}>⚙️</span>
          <span>Platform Console</span>
        </div>

        <nav className={s.sidebar__nav}>
          {NAV.map(item => (
            <button
              key={item.id}
              className={`${s.navItem} ${activeView === item.id ? s['navItem--active'] : ''}`}
              onClick={() => setActiveView(item.id)}
            >
              <span className={s.navItem__icon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={s.sidebar__footer}>
          <div className={s.sidebar__user}>
            <div className={s.sidebar__userAvatar}>
              {platformUser.email?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className={s.sidebar__userName}>{platformUser.name || 'Owner'}</div>
              <div className={s.sidebar__userRole}>platform_owner</div>
            </div>
          </div>
          <button className={s.logoutBtn} onClick={logout} title="Sign Out">↩</button>
        </div>
      </aside>

      {/* Main */}
      <main className={s.main}>
        {VIEW_MAP[activeView]}
      </main>
    </div>
  );
}

// ── Page export ────────────────────────────────────────────────────────────────
export default function PlatformConsole() {
  useNoIndex(); // /platform is internal — must not be indexed
  return (
    <ConsoleProvider>
      <ConsoleShell />
    </ConsoleProvider>
  );
}
