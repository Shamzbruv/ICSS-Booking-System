import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { ConsultationSlots } from './ConsultationSlots';
import { addToCalendar, dateLabel, jamaicaDate, timeLabel } from './format';
import pc from '../PlatformConsole/PlatformConsole.module.css';
import s from './ConsultationWorkspace.module.css';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const states = { upcoming: 'Upcoming', pending: 'Awaiting confirmation', confirmed: 'All confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show', all: 'All consultations' };
const labels = { pending: 'Awaiting confirmation', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };

function Schedule({ host, onChange }) {
  const [draft, setDraft] = useState(host);
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  function toggleDay(day, on) {
    const hours = { ...draft.hours };
    if (on) hours[day] = { start: '09:00', end: '17:00' };
    else delete hours[day];
    setDraft({ ...draft, hours });
  }
  function setTime(day, key, value) {
    setDraft({ ...draft, hours: { ...draft.hours, [day]: { ...draft.hours[day], [key]: value } } });
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api.platform.consultationSchedule(host.id, draft);
      onChange();
      setMessage('Schedule saved.');
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  return <form className={s.panel} onSubmit={save}>
    <h3>{host.name}</h3>
    <p className={s.muted}>{host.role}</p>
    <label className={s.check}><input type="checkbox" checked={draft.enabled}
      onChange={event => setDraft({ ...draft, enabled: event.target.checked })} /> Accept online bookings</label>
    <div className={s.hours}>
      {days.map((name, day) => <div key={name} className={s.day}>
        <label className={s.check}><input type="checkbox" checked={Boolean(draft.hours[day])}
          onChange={event => toggleDay(day, event.target.checked)} /> {name}</label>
        {draft.hours[day] && <div className={s.range}>
          <input aria-label={`${name} start`} type="time" required step={1800} value={draft.hours[day].start} onChange={event => setTime(day, 'start', event.target.value)} />
          <span>to</span>
          <input aria-label={`${name} end`} type="time" required step={1800} value={draft.hours[day].end} onChange={event => setTime(day, 'end', event.target.value)} />
        </div>}
      </div>)}
    </div>
    <label>Default meeting link <small>Optional</small>
      <input type="url" maxLength={500} placeholder="https://meet.google.com/…" value={draft.meetingUrl}
        onChange={event => setDraft({ ...draft, meetingUrl: event.target.value })} />
    </label>
    <div className={s.blocks}>
      <label>Block a date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <button type="button" className={s.button} disabled={!date} onClick={() => {
        setDraft({ ...draft, blockedDates: [...new Set([...draft.blockedDates, date])].sort() });
        setDate('');
      }}>Add block</button>
    </div>
    {draft.blockedDates.length > 0 && <ul className={s.blockList}>
      {draft.blockedDates.map(item => <li key={item}>{item} <button type="button" className={s.button}
        aria-label={`Remove block for ${item}`} onClick={() => setDraft({ ...draft, blockedDates: draft.blockedDates.filter(value => value !== item) })}>Remove</button></li>)}
    </ul>}
    <button type="submit" className={s.primary} disabled={busy}>{busy ? 'Saving…' : 'Save schedule'}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}

function Appointment({ booking, calendar, onChange, focus = false }) {
  const [notes, setNotes] = useState(booking.staff_notes);
  const [meetingUrl, setMeetingUrl] = useState('');
  const assignedHost = booking.joint ? 'both' : booking.host_id;
  const [host, setHost] = useState(assignedHost);
  const [date, setDate] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const assigned = booking.joint ? 'Shamar Baker and Jemelia Peart' : calendar.hosts.find(item => item.id === booking.host_id)?.name;
  const getSlots = useCallback((choice, day, signal) =>
    api.platform.consultationSlots(choice, day, signal, booking.id), [booking.id]);
  const started = Date.parse(booking.starts_at) <= Date.now();
  const pending = booking.status === 'pending';
  const calendarBooking = { startsAt: booking.starts_at, host: assigned, meetingUrl: booking.meeting_url };
  async function change(action) {
    if (action === 'cancel' && !window.confirm(pending ? 'Cancel this request and release the time?' : 'Cancel this consultation and notify the client?')) return;
    setBusy(true);
    setMessage('');
    try {
      await api.platform.consultationChange(booking.id, { action, notes, host, startsAt, meetingUrl, version: booking.version });
      setEditing(false);
      setStartsAt('');
      setMessage(action === 'confirm' ? 'Consultation confirmed. The client email is queued.' :
        action === 'notes' ? 'Notes saved.' : 'Consultation updated.');
      onChange();
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  return <details className={s.appointment} open={focus || undefined}>
    <summary>
      <span><strong>{booking.client_name}</strong><small>{booking.topic} · {assigned}</small></span>
      <span>{dateLabel(booking.starts_at)}<small>{timeLabel(booking.starts_at)} · {labels[booking.status]}</small></span>
    </summary>
    <div className={s.appointmentBody}>
      <div className={s.contact}><a href={`mailto:${booking.email}`}>{booking.email}</a>
        {booking.company && <span>{booking.company}</span>}
        {booking.meeting_url && booking.status === 'confirmed' && <a href={booking.meeting_url} target="_blank" rel="noreferrer">Open meeting link ↗</a>}
        {booking.status === 'confirmed' && <a href={addToCalendar(calendarBooking, calendar.duration)} target="_blank" rel="noreferrer">Add to Google Calendar ↗</a>}
      </div>
      {booking.details && <p className={s.details}>{booking.details}</p>}
      {booking.email_status && <small>{{
        sent: 'Email accepted by the provider', pending: 'Email queued', sending: 'Sending email',
        failed: 'Email attempt failed', cancelled: 'Older email superseded'
      }[booking.email_status]}</small>}
      {pending && <form className={s.slotEditor} onSubmit={event => { event.preventDefault(); change('confirm'); }}>
        <h3 className={s.approvalHeading}>Confirm this request</h3>
        <a className={s.button} href={addToCalendar(calendarBooking, calendar.duration, booking)}
          target="_blank" rel="noreferrer">Open Google Calendar to create a Meet link ↗</a>
        <p className={s.muted}>The date, time, and client details are filled in. In Google Calendar, add Google Meet video conferencing and save the event. Copy the joining link and paste it below.</p>
        {started && <p role="status">This time has passed. Reschedule the request before confirming.</p>}
        <label>Google Meet link<input type="url" value={meetingUrl} required placeholder="https://meet.google.com/abc-defg-hij"
          onChange={event => setMeetingUrl(event.target.value)} /></label>
        <button type="submit" className={s.primary} disabled={busy || started || !meetingUrl.trim()}>Confirm &amp; email client</button>
      </form>}
      <label>Internal notes<textarea maxLength={4000} rows={3} value={notes} onChange={event => setNotes(event.target.value)} /></label>
      <div className={s.actions}>
        <button type="button" className={s.button} disabled={busy || notes === booking.staff_notes} onClick={() => change('notes')}>Save notes</button>
        {(booking.status === 'confirmed' || pending) && <>
          <button type="button" className={s.button} disabled={busy} onClick={() => {
            setEditing(!editing);
            setHost(assignedHost);
            setDate(jamaicaDate(booking.starts_at));
            setStartsAt('');
          }}>Reschedule or reassign</button>
          <button type="button" className={s.button} disabled={busy} onClick={() => change('cancel')}>Cancel</button>
          {started && !pending && <><button type="button" className={s.button} disabled={busy} onClick={() => change('complete')}>Mark completed</button>
            <button type="button" className={s.button} disabled={busy} onClick={() => change('no_show')}>Mark no-show</button></>}
        </>}
      </div>
      {editing && <div className={s.slotEditor}>
        <ConsultationSlots calendar={calendar} getSlots={getSlots}
          {...{ host, setHost, date, setDate, startsAt, setStartsAt }} />
        <button type="button" className={s.primary} disabled={!startsAt || busy} onClick={() => change('reschedule')}>Save new time and host</button>
      </div>}
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}

export default function ConsultationWorkspace({ requestedId }) {
  const [tab, setTab] = useState('bookings');
  const [focused, setFocused] = useState(null);
  const [focusError, setFocusError] = useState('');
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState({ status: 'upcoming', host: 'any', page: 1 });
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const link = new URL('/consultation', window.location.origin).href;
  const refresh = () => setRevision(value => value + 1);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api.platform.consultationList(filter, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, [filter, revision]);

  useEffect(() => {
    if (!requestedId) return;
    const controller = new AbortController();
    setFocusError('');
    api.platform.consultationGet(requestedId, controller.signal).then(result => {
      if (!controller.signal.aborted) setFocused(result.booking);
    }).catch(err => {
      if (!controller.signal.aborted) setFocusError(err.message);
    });
    return () => controller.abort();
  }, [requestedId, revision]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      const field = document.getElementById('consultation-link');
      field?.select();
    }
  }

  return <section className={`${pc.view} ${s.workspace}`}>
    <header className={s.heading}>
      <div><h2>Consultations</h2><p>Manage bookings and availability for Shamar and Jemelia.</p></div>
      <a className={s.button} href={link} target="_blank" rel="noreferrer">Open booking page ↗</a>
    </header>
    {error && <p role="alert" className={s.error}>{error}</p>}
    {data && <>
      <div className={s.share}>
        <label htmlFor="consultation-link">Client booking link</label>
        <div><input id="consultation-link" readOnly value={link} onFocus={event => event.target.select()} />
          <button type="button" className={s.primary} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button></div>
        {!data.hosts.some(item => item.enabled) && <small>Set and publish availability before sharing the link.</small>}
      </div>
      <div className={s.actions}>
        <button type="button" className={s.button} aria-pressed={tab === 'bookings'} onClick={() => setTab('bookings')}>Bookings</button>
        <button type="button" className={s.button} aria-pressed={tab === 'availability'} onClick={() => setTab('availability')}>Availability</button>
      </div>
      {tab === 'availability' ? <>
        <p className={s.muted}>Set weekly hours in Jamaica time and block any dates you’re away.</p>
        <div className={s.schedules}>{data.hosts.map(host => <Schedule key={host.id} host={host} onChange={refresh} />)}</div>
      </> : <>
        {focusError && <p role="alert" className={s.error}>{focusError}</p>}
        {focused && <Appointment key={focused.id} booking={focused} calendar={data} onChange={refresh} focus />}
        <div className={s.filters}>
          <label>Status<select value={filter.status} onChange={event => setFilter({ ...filter, status: event.target.value, page: 1 })}>
            {Object.entries(states).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
          <label>Consultant<select value={filter.host} onChange={event => setFilter({ ...filter, host: event.target.value, page: 1 })}>
            <option value="any">All consultations</option><option value="both">Joint meetings</option>{data.hosts.map(host => <option value={host.id} key={host.id}>{host.name}</option>)}
          </select></label>
          <button type="button" className={s.button} onClick={refresh}>Refresh</button>
        </div>
        {data.bookings.length ? <div className={s.bookings}>
          {data.bookings.filter(booking => booking.id !== focused?.id).map(booking => <Appointment key={booking.id} booking={booking} calendar={data} onChange={refresh} />)}
        </div> : <p className={s.muted}>No consultations match these filters.</p>}
        {(filter.page > 1 || data.hasMore) && <div className={s.actions}>
          <button type="button" className={s.button} disabled={filter.page <= 1} onClick={() => setFilter({ ...filter, page: filter.page - 1 })}>Previous</button>
          <button type="button" className={s.button} disabled={!data.hasMore} onClick={() => setFilter({ ...filter, page: filter.page + 1 })}>Next</button>
        </div>}
      </>}
    </>}
    {!data && !error && <p role="status">Loading consultations…</p>}
  </section>;
}
