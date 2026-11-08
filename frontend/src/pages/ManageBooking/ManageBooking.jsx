/**
 * ManageBooking — /manage#t=<signed token>
 * The link in every confirmation email. Customers can reschedule (pick a new
 * open time and say why) or cancel, within the business's own policy.
 * The token is moved from the URL into sessionStorage straight away so it
 * doesn't linger in browser history.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNoIndex } from '../../hooks/useNoIndex';
import s from './ManageBooking.module.css';

const STORAGE_KEY = 'icss_manage_token';

function readToken() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const fromHash = hash.get('t');
  if (fromHash) {
    try { sessionStorage.setItem(STORAGE_KEY, fromHash); } catch { /* private mode */ }
    window.history.replaceState(null, '', window.location.pathname);
    return fromHash;
  }
  try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
}

async function manageFetch(token, path = '', options = {}) {
  const res = await fetch(`/api/v1/manage${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Manage-Token': token, ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function longDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function timeLabel(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function googleCalendarLink(booking, tenantName) {
  if (!booking.date || !booking.time) return null;
  const start = new Date(`${booking.date}T${booking.time}:00`);
  const end = new Date(start.getTime() + (Number(booking.duration_minutes) || 60) * 60000);
  const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({ action: 'TEMPLATE', text: `${booking.service_name} @ ${tenantName}`, dates: `${stamp(start)}/${stamp(end)}` });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function ReasonPicker({ reasons, code, text, onCode, onText, required }) {
  return (
    <div className={s.reasonBlock}>
      <p className={s.label}>Reason{required ? '' : ' (optional)'}</p>
      <div className={s.chips} role="radiogroup" aria-label="Reason">
        {Object.entries(reasons).map(([key, label]) => (
          <button key={key} type="button" role="radio" aria-checked={code === key}
            className={`${s.chip} ${code === key ? s.chipActive : ''}`} onClick={() => onCode(key)}>
            {label}
          </button>
        ))}
      </div>
      <textarea className={s.textarea} rows={3} maxLength={500} value={text} onChange={(e) => onText(e.target.value)}
        placeholder={code === 'other' ? 'Tell the business what happened…' : 'Anything the business should know? (optional)'} />
    </div>
  );
}

export default function ManageBooking() {
  useNoIndex();
  const [token] = useState(readToken);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('view'); // view | reschedule | cancel | done
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotMessage, setSlotMessage] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [time, setTime] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');

  const load = useCallback(() => {
    if (!token) { setError('This link is missing its security code. Please open the link from your email again.'); return; }
    manageFetch(token).then(setData).catch((err) => setError(err.message));
  }, [token]);
  useEffect(load, [load]);

  const brandStyle = useMemo(() => ({ '--brand': data?.tenant?.primaryColor || '#6d28d9' }), [data]);

  const days = useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      list.push(d);
    }
    return list;
  }, []);

  useEffect(() => {
    if (!date || !data) return;
    let cancelled = false;
    setLoadingSlots(true); setSlots([]); setTime(''); setSlotMessage('');
    const params = new URLSearchParams({ date });
    if (data.booking.service_id) params.set('service_id', data.booking.service_id);
    fetch(`/api/v1/availability?${params}`, { cache: 'no-store', headers: { 'X-Tenant-Slug': data.tenant.slug } })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const open = (res.slots || []).filter((slot) => slot.available && !(date === data.booking.date && slot.time === data.booking.time));
        setSlots(open);
        setSlotMessage(open.length ? '' : (res.message || 'No open times on this day. Try another date.'));
      })
      .catch(() => !cancelled && setSlotMessage('Could not load times. Please try again.'))
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => { cancelled = true; };
  }, [date, data]);

  const resetForm = () => { setDate(''); setTime(''); setSlots([]); setReasonCode(''); setReasonText(''); setError(''); };

  const submitReschedule = async () => {
    setBusy(true); setError('');
    try {
      const res = await manageFetch(token, '/reschedule', { method: 'POST', body: { date, time, reason_code: reasonCode, reason: reasonText } });
      setData(res); setDone({ type: res.mode === 'request' ? 'requested' : 'rescheduled' }); setMode('done'); resetForm();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const submitCancel = async () => {
    setBusy(true); setError('');
    try {
      const res = await manageFetch(token, '/cancel', { method: 'POST', body: { reason_code: reasonCode, reason: reasonText } });
      setData(res); setDone({ type: 'cancelled' }); setMode('done'); resetForm();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  if (!data) {
    return (
      <main className={s.page}>
        <div className={s.card}>
          {error ? (<><div className={s.bigIcon}>🔒</div><h1 className={s.title}>We couldn't open this booking</h1><p className={s.muted}>{error}</p></>)
            : (<><div className={s.spinner} /><p className={s.muted}>Loading your booking…</p></>)}
        </div>
      </main>
    );
  }

  const { tenant, booking, options, policy, reasons } = data;
  const reasonRequired = policy.reasonRequired;
  const reasonOk = !reasonRequired || (reasonCode && (reasonCode !== 'other' || reasonText.trim()));
  const contact = tenant.contact || {};
  const statusLabel = { confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed', rejected: 'Declined', expired: 'Expired', pending_payment: 'Awaiting payment', pending_manual_confirmation: 'Payment under review', pending_after_hours_confirmation: 'Awaiting approval', no_show: 'Missed' }[booking.status] || booking.status;
  const calendarLink = googleCalendarLink(booking, tenant.name);

  return (
    <main className={s.page} style={brandStyle}>
      <div className={s.card}>
        <header className={s.brand}>
          {tenant.logoUrl ? <img src={tenant.logoUrl} alt="" className={s.logo} /> : <span className={s.logoFallback}>{tenant.name.slice(0, 1)}</span>}
          <div><p className={s.kicker}>Manage your booking</p><h1 className={s.brandName}>{tenant.name}</h1></div>
        </header>

        <section className={s.summary} aria-label="Your appointment">
          <div className={s.summaryTop}>
            <span className={`${s.status} ${s[`status_${booking.status}`] || ''}`}>{statusLabel}</span>
            <span className={s.ref}>{booking.reference}</span>
          </div>
          <p className={s.service}>{booking.service_name}</p>
          <p className={s.when}>{longDate(booking.date)}<br /><strong>{timeLabel(booking.time)}</strong></p>
          {booking.pending_request && (
            <p className={s.pending}>⏳ You asked to move this to <strong>{longDate(booking.pending_request.date)} at {timeLabel(booking.pending_request.time)}</strong>. Waiting for {tenant.name} to confirm.</p>
          )}
        </section>

        {mode === 'done' && done && (
          <section className={s.notice} role="status">
            <div className={s.bigIcon}>{done.type === 'cancelled' ? '👋' : done.type === 'requested' ? '📨' : '✅'}</div>
            <h2 className={s.title}>{done.type === 'cancelled' ? 'Your booking is cancelled' : done.type === 'requested' ? 'Request sent' : 'You’re all set'}</h2>
            <p className={s.muted}>
              {done.type === 'cancelled' ? `We’ve let ${tenant.name} know. A confirmation is on its way to your email.`
                : done.type === 'requested' ? `${tenant.name} will confirm your new time shortly. Your original time stays booked until then.`
                : `Your appointment has moved to ${longDate(booking.date)} at ${timeLabel(booking.time)}. We’ve emailed you the new details.`}
            </p>
            {done.type === 'rescheduled' && calendarLink && <a className={s.secondary} href={calendarLink} target="_blank" rel="noreferrer">Add to Google Calendar</a>}
            <button type="button" className={s.linkButton} onClick={() => setMode('view')}>Back to my booking</button>
          </section>
        )}

        {mode === 'view' && (
          <section className={s.actions}>
            <button type="button" className={s.primary} disabled={!options.canReschedule} onClick={() => { resetForm(); setMode('reschedule'); }}>Reschedule</button>
            <button type="button" className={s.danger} disabled={!options.canCancel} onClick={() => { resetForm(); setMode('cancel'); }}>Cancel booking</button>
            {(!options.canReschedule || !options.canCancel) && (
              <p className={s.policyNote}>{options.rescheduleBlockedReason || options.cancelBlockedReason}</p>
            )}
            {options.canReschedule && policy.maxReschedules > 0 && (
              <p className={s.policyNote}>You can reschedule up to {options.remainingReschedules} more time{options.remainingReschedules === 1 ? '' : 's'} online{policy.cutoffHours ? `, until ${policy.cutoffHours} hours before your appointment` : ''}.{policy.requireApproval ? ` ${tenant.name} confirms each new time.` : ''}</p>
            )}
          </section>
        )}

        {mode === 'reschedule' && (
          <section className={s.flow} aria-label="Choose a new time">
            <h2 className={s.title}>Pick a new time</h2>
            <p className={s.label}>Date</p>
            <div className={s.dayStrip}>
              {days.map((d) => {
                const iso = isoDate(d);
                return (
                  <button key={iso} type="button" className={`${s.day} ${date === iso ? s.dayActive : ''}`} onClick={() => setDate(iso)} aria-pressed={date === iso}>
                    <span>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <strong>{d.getDate()}</strong>
                    <span>{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                  </button>
                );
              })}
            </div>
            {date && (
              <>
                <p className={s.label}>Time on {longDate(date)}</p>
                {loadingSlots ? <p className={s.muted}>Checking open times…</p> : slotMessage ? <p className={s.muted}>{slotMessage}</p> : (
                  <div className={s.slots}>
                    {slots.map((slot) => (
                      <button key={slot.time} type="button" className={`${s.slot} ${time === slot.time ? s.slotActive : ''}`} onClick={() => setTime(slot.time)} aria-pressed={time === slot.time}>
                        {slot.label || timeLabel(slot.time)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {time && (
              <>
                <ReasonPicker reasons={reasons} code={reasonCode} text={reasonText} onCode={setReasonCode} onText={setReasonText} required={reasonRequired} />
                <div className={s.confirmBox}>
                  <span className={s.strike}>{longDate(booking.date)} · {timeLabel(booking.time)}</span>
                  <span aria-hidden="true">→</span>
                  <strong>{longDate(date)} · {timeLabel(time)}</strong>
                </div>
              </>
            )}
            {error && <p className={s.error} role="alert">{error}</p>}
            <div className={s.flowActions}>
              <button type="button" className={s.ghost} onClick={() => setMode('view')}>Back</button>
              <button type="button" className={s.primary} disabled={!date || !time || !reasonOk || busy} onClick={submitReschedule}>
                {busy ? 'Saving…' : policy.requireApproval ? 'Send request' : 'Confirm new time'}
              </button>
            </div>
          </section>
        )}

        {mode === 'cancel' && (
          <section className={s.flow} aria-label="Cancel booking">
            <h2 className={s.title}>Cancel this booking?</h2>
            <p className={s.muted}>Your time will be released for someone else. {options.canReschedule ? 'You could also reschedule instead.' : ''}</p>
            <ReasonPicker reasons={reasons} code={reasonCode} text={reasonText} onCode={setReasonCode} onText={setReasonText} required={reasonRequired} />
            {error && <p className={s.error} role="alert">{error}</p>}
            <div className={s.flowActions}>
              <button type="button" className={s.ghost} onClick={() => setMode('view')}>Keep my booking</button>
              <button type="button" className={s.dangerSolid} disabled={!reasonOk || busy} onClick={submitCancel}>{busy ? 'Cancelling…' : 'Cancel booking'}</button>
            </div>
          </section>
        )}

        {(contact.phone || contact.whatsapp || contact.email) && (
          <footer className={s.contact}>
            <p className={s.label}>Need help? Contact {tenant.name}</p>
            <div className={s.contactLinks}>
              {contact.phone && <a href={`tel:${contact.phone.replace(/[^+0-9]/g, '')}`}>📞 Call</a>}
              {contact.whatsapp && <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>}
              {contact.email && <a href={`mailto:${contact.email}`}>✉️ Email</a>}
            </div>
          </footer>
        )}
        <a className={s.bookAgain} href={`/${tenant.slug}`}>Visit {tenant.name}</a>
      </div>
    </main>
  );
}
