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
  { id: 'dashboard',  icon: '📊', label: 'Dashboard' },
  { id: 'tenants',    icon: '🏢', label: 'Tenants' },
  { id: 'themes',     icon: '🎨', label: 'Themes' },
  { id: 'jobs',       icon: '⚙️', label: 'Jobs & Queue' },
  { id: 'payments',   icon: '💳', label: 'Payments' },
  { id: 'audit',      icon: '📋', label: 'Audit Log' },
  { id: 'team',       icon: '👥', label: 'Developer Admins', ownerOnly: true },
  { id: 'contracts',  icon: '✍️', label: 'Contracts', ownerOnly: true },
  { id: 'system',     icon: '🖥', label: 'System' },
];

const money = value => `JMD ${Number(value || 0).toLocaleString(undefined,{maximumFractionDigits:2})}`;

function DashboardView() {
  const [d, setD] = useState(null);
  const [selected, setSelected] = useState(null);
  useEffect(() => { api.platform.getDashboardAnalytics().then(setD); }, []);
  if (!d) return <div className={s.loading}>Loading platform analytics…</div>;

  const colors = ['#7c6ef7','#4ade80','#facc15','#fb923c','#f87171','#38bdf8','#a78bfa'];
  const maxPayment = Math.max(1, ...d.monthly.map(x => Number(x.payments)));
  const maxBookings = Math.max(1, ...d.monthly.map(x => Number(x.bookings)));
  const totalStatus = Math.max(1, d.statuses.reduce((n, x) => n + x.count, 0));
  const linePoints = d.monthly.map((x, i) => ({
    ...x,
    x: i * (520 / Math.max(1, d.monthly.length - 1)),
    y: 150 - (Number(x.bookings) / maxBookings) * 130
  }));
  let pieOffset = 0;
  const pieSegments = d.statuses.map((item, i) => {
    const fraction = item.count / totalStatus;
    const segment = { ...item, color: colors[i % colors.length], fraction, offset: pieOffset };
    pieOffset += fraction;
    return segment;
  });
  const choose = (title, detail) => setSelected({ title, detail });

  return <div className={s.view}>
    <div className={s.view__header}><div><h2 className={s.view__title}>Platform Health Dashboard</h2><p className={s.chartHint}>Hover or focus any chart item for its value. Click it to keep the explanation open.</p></div></div>
    <div className={s.metricGrid}>
      {[
        ['Confirmed booking value', money(d.summary.total_paid), 'Full JMD service value of every confirmed or completed booking across all tenants, including after-hours fees.'],
        ['Confirmed value — last 30 days', money(d.summary.paid_30d), 'Full JMD service value of bookings created in the last 30 days that are now confirmed or completed.'],
        ['Total bookings', d.summary.total_bookings, 'All booking records created across the platform.'],
        ['Active tenants', d.summary.active_tenants, 'Tenant accounts currently enabled and available.']
      ].map(([label,value,help]) => <button key={label} className={s.metricCard} onClick={() => choose(label, `${value} — ${help}`)}><span>{label}</span><strong>{value}</strong><small>{help}</small></button>)}
    </div>
    {selected && <div className={s.chartSelection} role="status"><div><strong>{selected.title}</strong><span>{selected.detail}</span></div><button onClick={() => setSelected(null)} aria-label="Close selected chart detail">×</button></div>}
    <div className={s.chartGrid}>
      <Section title="Monthly confirmed booking value">
        <div className={s.barChart}>{d.monthly.map(x => <button className={s.barItem} key={x.month} onClick={() => choose(`Confirmed value in ${x.month}`, `${money(x.payments)} from ${x.bookings} confirmed or completed bookings.`)} aria-label={`${x.month}: ${money(x.payments)}, ${x.bookings} confirmed bookings`}><span className={s.chartTooltip}>{x.month}<br/><strong>{money(x.payments)}</strong><br/>{x.bookings} confirmed</span><div className={s.bar} style={{height:`${Math.max(3,Number(x.payments)/maxPayment*170)}px`}}/><span>{x.month.slice(5)}</span></button>)}</div>
      </Section>
      <Section title="Booking status mix">
        <div className={s.pieWrap}><svg className={s.pie} viewBox="0 0 42 42" aria-label="Booking status pie chart">{pieSegments.map(segment => <circle key={segment.status} className={s.pieSegment} cx="21" cy="21" r="15.915" fill="transparent" stroke={segment.color} strokeWidth="8" strokeDasharray={`${segment.fraction*100} ${100-segment.fraction*100}`} strokeDashoffset={25-segment.offset*100} tabIndex="0" role="button" aria-label={`${segment.status}: ${segment.count} bookings`} onClick={() => choose(segment.status.replaceAll('_',' '), `${segment.count} bookings — ${(segment.fraction*100).toFixed(1)}% of all bookings.`)} onKeyDown={e => (e.key==='Enter'||e.key===' ') && choose(segment.status.replaceAll('_',' '), `${segment.count} bookings — ${(segment.fraction*100).toFixed(1)}% of all bookings.`)}/>)}</svg><div>{pieSegments.map(segment => <button key={segment.status} className={s.legend} onClick={() => choose(segment.status.replaceAll('_',' '), `${segment.count} bookings — ${(segment.fraction*100).toFixed(1)}% of all bookings.`)}><i style={{background:segment.color}}/>{segment.status.replaceAll('_',' ')} ({segment.count})</button>)}</div></div>
      </Section>
      <Section title="Booking activity — 12 months">
        <div className={s.lineChartWrap}><svg className={s.lineChart} viewBox="-8 0 536 180" role="img" aria-label="Monthly confirmed bookings line graph"><polyline points={linePoints.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#7c6ef7" strokeWidth="4" strokeLinejoin="round"/>{linePoints.map(p=><g key={p.month} className={s.linePoint} tabIndex="0" role="button" aria-label={`${p.month}: ${p.bookings} confirmed bookings`} onClick={() => choose(`Confirmed bookings in ${p.month}`, `${p.bookings} confirmed or completed bookings worth ${money(p.payments)}.`)} onKeyDown={e => (e.key==='Enter'||e.key===' ') && choose(`Confirmed bookings in ${p.month}`, `${p.bookings} confirmed or completed bookings worth ${money(p.payments)}.`)}><circle cx={p.x} cy={p.y} r="7"/><text x={p.x} y={Math.max(12,p.y-13)} textAnchor="middle">{p.bookings}</text></g>)}</svg></div>
      </Section>
      <Section title="Top tenants by confirmed booking value"><table className={s.table}><thead><tr><th>Tenant</th><th>Confirmed</th><th>Value</th></tr></thead><tbody>{d.tenants.map(t=><tr key={t.slug} className={s.interactiveRow} tabIndex="0" onClick={() => choose(t.name, `${t.bookings} confirmed or completed bookings worth ${money(t.payments)}.`)} onKeyDown={e => e.key==='Enter' && choose(t.name, `${t.bookings} confirmed or completed bookings worth ${money(t.payments)}.`)}><td>{t.name}<div className={s.muted}>{t.slug}</div></td><td>{t.bookings}</td><td>{money(t.payments)}</td></tr>)}</tbody></table></Section>
    </div>
  </div>;
}

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

  const quickImpersonate = async (tenant, mode = 'read_only', page = 'index.html') => {
    try {
      const session = await startImpersonation(tenant.id, mode, 'Console Quick Access');
      window.open(`/admin/${page}?tenant=${tenant.slug}&_impToken=${session.token}`, '_blank');
    } catch (err) {
      alert('Failed to open admin: ' + (err.message || 'Unknown error'));
    }
  };

  const quickResetPassword = async (tenant) => {
    if (!window.confirm(`Send password reset email to ${tenant.owner_email}?`)) return;
    try {
      await api.platform.resetTenantPassword(tenant.id);
      alert('Password reset email sent.');
    } catch (e) { alert(e.message); }
  };

  const quickResetTour = async (tenant) => {
    if (!window.confirm(`Reset the dashboard tutorial for ${tenant.name}? The walkthrough will show again the next time they open their dashboard.`)) return;
    try {
      const res = await api.platform.resetTenantDashboardTour(tenant.id);
      alert(res.message || 'Dashboard tutorial reset.');
    } catch (e) {
      alert(e.message || 'Failed to reset the dashboard tutorial.');
    }
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
                      <a href={`/${t.slug}`} target="_blank" rel="noreferrer" className={s.rowBtn} title="Open customer booking site">Site</a>
                      <button className={s.rowBtn} title="Open tenant color customization with edit access" onClick={() => quickImpersonate(t,'edit','customize.html')}>Customize</button>
                      <button className={s.rowBtn} title="Reset dashboard tutorial" onClick={() => quickResetTour(t)}>Reset Tour</button>
                      <button className={s.rowBtn} title="Send owner password reset email" onClick={() => quickResetPassword(t)}>Reset Password</button>
                      <button className={s.rowBtn} title={t.active ? "Suspend account" : "Activate account"} onClick={() => quickToggleStatus(t)}>{t.active ? 'Suspend' : 'Activate'}</button>
                      <button className={s.rowBtn} title="Permanently delete account" onClick={() => quickDelete(t)}>Delete</button>
                      <button className={s.rowBtn} title="Open tenant admin with edit access" onClick={() => quickImpersonate(t, 'edit')}>Edit Admin</button>
                      <button className={`${s.rowBtn} ${s['rowBtn--imp']}`} title="Open tenant admin read-only" onClick={() => quickImpersonate(t, 'read_only')}>View Admin</button>
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
    api.platform.getJobs().then(setData).finally(() => setLoading(false));
  }, []);
  const update=async(job,status)=>{const note=window.prompt(`Optional note for the tenant (${status.replace('_',' ')}):`)??null;if(note===null)return;await api.platform.updateJobStatus(job.id,status,note);setData(await api.platform.getJobs())};

  return (
    <div className={s.view}>
      <div className={s.view__header}><h2 className={s.view__title}>Jobs & Queue</h2></div>
      {loading ? <div className={s.loading}>Loading…</div> : (
        <>
          <Section title={`🧰 Tenant Issues (${data?.supportJobs?.length || 0})`}>
            {(data?.supportJobs || []).length===0?<div className={s.empty}>No tenant issues submitted.</div>:<table className={s.table}><thead><tr><th>Tenant</th><th>Issue</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{data.supportJobs.map(j=><tr key={j.id}><td>{j.tenant_name}<div className={s.muted}>{j.submitter_email}</div></td><td><strong>{j.subject}</strong><div className={s.muted}>{j.description}</div>{j.developer_note&&<div>Developer note: {j.developer_note}</div>}</td><td><span className={s.badge}>{j.status.replace('_',' ')}</span></td><td>{new Date(j.created_at).toLocaleString()}</td><td><div className={s.rowActions}>{j.status!=='in_review'&&j.status!=='completed'&&<button className={s.rowBtn} title="Mark in review" onClick={()=>update(j,'in_review')}>Review</button>}{j.status!=='completed'&&<button className={s.rowBtn} title="Mark completed" onClick={()=>update(j,'completed')}>Done</button>}</div></td></tr>)}</tbody></table>}
          </Section>
          <Section title={`🎨 Custom Theme Requests (${data?.themeRequests?.length || 0})`}>
            {(data?.themeRequests || []).length === 0 ? <div className={s.empty}>No custom theme requests.</div> : (
              <table className={s.table}><thead><tr><th>Tenant</th><th>Request</th><th>Price</th><th>Status</th><th>Created</th></tr></thead><tbody>{data.themeRequests.map(j => <tr key={j.id}><td>{j.tenant_name}<div className={s.muted}>{j.tenant_slug}</div></td><td>{j.notes}</td><td>JMD ${Number(j.final_price || 10000).toLocaleString()}</td><td><span className={s.badge}>{j.status}</span></td><td>{new Date(j.created_at).toLocaleString()}</td></tr>)}</tbody></table>
            )}
          </Section>
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

  const affectedAccount = entry => {
    const metadata = entry.metadata || {};
    const name = entry.tenant_name || metadata.impersonatedTenantName;
    const slug = entry.tenant_slug || metadata.impersonatedTenantSlug;
    const email = entry.target_account_email || metadata.impersonatedAccountEmail;
    if (!name && !slug && !email) return <span className={s.muted}>Platform-wide</span>;
    return <div><strong>{name || slug || email}</strong>{slug && <div className={s.muted}>@{slug}</div>}{email && <div className={s.muted}>{email}</div>}</div>;
  };

  return (
    <div className={s.view}>
      <div className={s.view__header}><h2 className={s.view__title}>Audit Log</h2></div>
      {loading ? <div className={s.loading}>Loading…</div> : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Action</th><th>Actor</th><th>Affected account</th><th>Entity</th><th>Timestamp</th></tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td><span className={s.badge}>{e.action}</span></td>
                  <td>{e.actor_email || '—'}</td>
                  <td>{affectedAccount(e)}</td>
                  <td>{e.entity ? `${e.entity}${e.entity_id ? ' #'+e.entity_id.slice(0,8) : ''}` : '—'}</td>
                  <td className={s.muted}>{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={5} className={s.empty}>No audit entries.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DeveloperAdminsView() {
  const [admins,setAdmins]=useState([]); const [form,setForm]=useState({name:'',email:'',password:''}); const [message,setMessage]=useState('');
  const load=()=>api.platform.getDeveloperAdmins().then(r=>setAdmins(r.admins||[]));
  useEffect(()=>{load()},[]);
  const submit=async e=>{e.preventDefault();setMessage('');try{const result=await api.platform.createDeveloperAdmin(form);setForm({name:'',email:'',password:''});setMessage(result.message);load()}catch(err){setMessage(err.message)}};
  return <div className={s.view}><div className={s.view__header}><div><h2 className={s.view__title}>Developer Admins</h2><p className={s.chartHint}>Accounts activate only after the invited administrator signs the agreement and you countersign it in Contracts.</p></div></div><Section title="Invite developer administrator"><form onSubmit={submit} className={s.loginForm} style={{maxWidth:520}}><input className={s.loginInput} placeholder="Full legal name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/><input className={s.loginInput} type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/><input className={s.loginInput} type="password" minLength="10" placeholder="Temporary password (10+ characters)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/><button className={s.btnPrimary}>Email Contract Invitation</button>{message&&<div className={s.contractNotice}>{message}</div>}</form></Section><Section title={`Active accounts (${admins.length})`}><table className={s.table}><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Created</th></tr></thead><tbody>{admins.map(a=><tr key={a.id}><td>{a.name}</td><td>{a.email}</td><td>{a.active?'Active':'Disabled'}</td><td>{new Date(a.created_at).toLocaleString()}</td></tr>)}</tbody></table></Section></div>;
}

function ContractsView() {
  const [agreements,setAgreements]=useState([]); const [loading,setLoading]=useState(true); const [message,setMessage]=useState(''); const [forms,setForms]=useState({});
  const load=()=>api.platform.getAgreements().then(r=>setAgreements(r.agreements||[])).finally(()=>setLoading(false));
  useEffect(()=>{load()},[]);
  const setField=(id,key,value)=>setForms(prev=>({...prev,[id]:{...prev[id],[key]:value}}));
  const openPdf=async(a,download=false)=>{setMessage('');try{const blob=await api.platform.getAgreementPdf(a.id);const url=URL.createObjectURL(blob);if(download){const link=document.createElement('a');link.href=url;link.download=`ICSS_Agreement_${a.partner_name||a.id}.pdf`;link.click()}else window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(err){setMessage(err.message)}};
  const previewTemplate=async()=>{setMessage('');try{const blob=await api.platform.getAgreementTemplate();const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(err){setMessage(err.message)}};
  const previewSigningExperience=()=>window.open('/partner-contract.html?preview=1','_blank','noopener,noreferrer');
  const countersign=async a=>{const body={effectiveDate:new Date().toISOString().slice(0,10),signature:'Shamar Baker',printedName:'Shamar Baker',title:'Platform Owner',...(forms[a.id]||{})};if(!window.confirm(`Apply your saved signature, countersign ${a.partner_name||a.partner_email}'s agreement and activate their ${a.access_role==='developer_admin'?'developer admin':'partner'} account?`))return;setMessage('');try{const result=await api.platform.ownerSignAgreement(a.id,body);setMessage(result.message);load()}catch(err){setMessage(err.message)}};
  const revoke=async a=>{if(!window.confirm(`Revoke the unsigned invitation for ${a.partner_email}? The existing signing link will stop working immediately.`))return;setMessage('');try{const result=await api.platform.revokeAgreementInvite(a.id);setMessage(result.message);load()}catch(err){setMessage(err.message)}};
  return <div className={s.view}><div className={s.view__header}><div><h2 className={s.view__title}>Contracts</h2><p className={s.chartHint}>Preview the agreement, track both signatures, complete your Owner fields, and download permanent copies.</p></div><div className={s.contractActions}><button className={s.btnGhost} onClick={previewTemplate}>Preview PDF</button><button className={s.btnPrimary} onClick={previewSigningExperience}>Preview Signing Experience</button></div></div>{message&&<div className={s.contractNotice}>{message}</div>}{loading?<div className={s.loading}>Loading contracts…</div>:<div className={s.contractGrid}>{agreements.map(a=><article className={s.contractCard} key={a.id}><div className={s.contractHead}><div><h3>{a.partner_name||a.partner_email}</h3><p>{a.partner_email}</p></div><span className={s.badge}>{a.status.replaceAll('_',' ')}</span></div><div className={s.contractFacts}><span><b>Access</b>{a.access_role==='developer_admin'?'Developer admin':'Marketing partner'}</span><span><b>Partner signed</b>{a.partner_signed_at?new Date(a.partner_signed_at).toLocaleString():'Waiting'}</span><span><b>Owner signed</b>{a.owner_signed_at?new Date(a.owner_signed_at).toLocaleString():'Waiting'}</span></div><div className={s.contractActions}><button className={s.btnGhost} onClick={()=>openPdf(a)}>Preview PDF</button><button className={s.btnGhost} onClick={()=>openPdf(a,true)}>Download copy</button>{a.status==='invited'&&<button className={s.btnDanger} onClick={()=>revoke(a)}>Revoke Invite</button>}</div>{a.status==='partner_signed'&&<div className={s.ownerFields}><h4>Owner completion fields</h4><input className={s.loginInput} type="date" aria-label="Effective date" onChange={e=>setField(a.id,'effectiveDate',e.target.value)}/><input className={s.loginInput} placeholder="Owner signature (typed full name)" onChange={e=>setField(a.id,'signature',e.target.value)}/><input className={s.loginInput} placeholder="Owner printed name" onChange={e=>setField(a.id,'printedName',e.target.value)}/><input className={s.loginInput} placeholder="Owner title / capacity" onChange={e=>setField(a.id,'title',e.target.value)}/><input className={s.loginInput} placeholder="Owner witness printed name" onChange={e=>setField(a.id,'witnessName',e.target.value)}/><input className={s.loginInput} placeholder="Owner witness signature" onChange={e=>setField(a.id,'witnessSignature',e.target.value)}/><button className={s.btnPrimary} onClick={()=>countersign(a)}>Countersign & Activate Account</button></div>}</article>)}{!agreements.length&&<div className={s.empty}>No contracts yet. Create a developer invitation from Developer Admins.</div>}</div>}</div>;
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
  dashboard:<DashboardView />,
  tenants:  <TenantsView />,
  themes:   <ThemesView />,
  jobs:     <JobsView />,
  payments: <PaymentsView />,
  audit:    <AuditView />,
  team:     <DeveloperAdminsView />,
  contracts:<ContractsView />,
  system:   <SystemView />,
};

// ── Console shell ─────────────────────────────────────────────────────────────
function ConsoleShell() {
  const { platformUser, logout, loading, authError, isImpersonating } = useConsole();
  const [activeView, setActiveView] = useState('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const activeLabel = NAV.find(item => item.id === activeView)?.label || 'Platform Console';

  if (loading) return <div className={s.fullscreen}><div className={s.spinner} /></div>;
  if (!platformUser) return <ConsoleLogin />;

  return (
    <div className={s.shell}>
      <ImpersonationBanner />

      <header className={s.mobileHeader}>
        <button type="button" onClick={() => setNavOpen(true)} aria-label="Open navigation">☰</button>
        <strong>{activeLabel}</strong>
      </header>
      {navOpen && <button type="button" className={s.navBackdrop} aria-label="Close navigation" onClick={() => setNavOpen(false)} />}

      {/* Sidebar */}
      <aside className={`${s.sidebar} ${navOpen ? s.sidebarOpen : ''}`}>
        <div className={s.sidebar__brand}>
          <span className={s.sidebar__brandIcon}>⚙️</span>
          <span>Platform Console</span>
        </div>

        <nav className={s.sidebar__nav}>
          {NAV.filter(item => !item.ownerOnly || platformUser.role === 'platform_owner').map(item => (
            <button
              key={item.id}
              className={`${s.navItem} ${activeView === item.id ? s['navItem--active'] : ''}`}
              onClick={() => { setActiveView(item.id); setNavOpen(false); }}
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
              <div className={s.sidebar__userRole}>{platformUser.role}</div>
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
