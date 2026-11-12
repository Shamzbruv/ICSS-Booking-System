import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNoIndex } from '../../hooks/useNoIndex';
import { api } from '../../api';
import { ConsultationSlots } from './ConsultationSlots';
import { addToCalendar, dateLabel, timeLabel } from './format';
import s from './Consultations.module.css';

const blankIntake = { name: '', email: '', company: '', topic: '', details: '' };
const statusLabels = { confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed', no_show: 'Missed' };

export default function ConsultationPage() {
  useNoIndex();
  const location = useLocation();
  const manage = location.pathname.endsWith('/manage');
  const [token, setToken] = useState(() => manage ? location.hash.slice(1) : '');
  const [calendar, setCalendar] = useState(null);
  const [booking, setBooking] = useState(null);
  const [intake, setIntake] = useState(blankIntake);
  const [host, setHost] = useState('any');
  const [date, setDate] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [revision, setRevision] = useState(0);
  const [rescheduling, setRescheduling] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const previous = document.title;
    document.title = 'Book a Consultation | iCreate Solutions & Services';
    return () => { document.title = previous; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setReady(false);
    setLoadError('');
    Promise.all([
      api.consultations.calendar(controller.signal),
      manage ? api.consultations.manage({ token: location.hash.slice(1) }, controller.signal) : null
    ]).then(([config, current]) => {
      if (controller.signal.aborted) return;
      setCalendar(config);
      setDate(config.nextDate || '');
      setBooking(current?.booking || null);
      setToken(manage ? location.hash.slice(1) : '');
      setRescheduling(false);
      setReady(true);
    }).catch(err => {
      if (!controller.signal.aborted) setLoadError(err.message);
    });
    return () => controller.abort();
  }, [manage, location.hash]);

  async function submit(action) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = action
        ? await api.consultations.manage({ token, action, host, startsAt })
        : await api.consultations.book({ ...intake, host, startsAt });
      setBooking(result.booking);
      if (result.token) setToken(result.token);
      setRescheduling(false);
      setStartsAt('');
    } catch (err) {
      setError(err.message);
      if (err.status === 409) {
        setStartsAt('');
        setRevision(value => value + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  const canManage = booking?.status === 'confirmed' && Date.parse(booking.startsAt) > Date.now();
  const intakeField = key => ({ value: intake[key], onChange: event => setIntake({ ...intake, [key]: event.target.value }) });

  return <div className={s.page}>
    <header className={s.masthead}>
      <a href="/" className={s.brand}><img src="/admin/icons/app-192-v2.png" alt="" />
        <span>iCreate <small>Solutions &amp; Services</small></span></a>
      <span className={s.mastheadNote}>Online consultations</span>
    </header>
    <main className={s.layout}>
      <div className={s.intro}>
        <span className={s.kicker}><span aria-hidden="true" /> Meet with ICSS</span>
        <h1>{manage ? 'Your consultation.' : <>Let’s talk about<br />your business.</>}</h1>
        <p>Tell us what you’re working on. We’ll talk through your goals, answer your questions, and help you decide what to do next.</p>
        <div className={s.introMeta}>
          <div><svg aria-hidden="true" width="20" height="20"><use href="/icons/ui.svg#calendar" /></svg>
            <span><strong>{calendar?.duration || 30} minutes</strong><small>Online · Jamaica time</small></span>
          </div>
          <div><svg aria-hidden="true" width="20" height="20"><use href="/icons/ui.svg#users" /></svg>
            <span><strong>Shamar Baker &amp; Jemelia Peart</strong><small>iCreate Solutions &amp; Services</small></span>
          </div>
        </div>
      </div>
      <section className={s.card} aria-busy={busy || (!ready && !loadError)}>
        {loadError && <><h2>Couldn’t open consultations</h2><p role="alert" className={s.error}>{loadError}</p>
          <Link to="/consultation">Go to the booking page</Link></>}
        {!ready && !loadError && <p role="status" className={s.muted}>Loading consultations…</p>}
        {ready && booking && !rescheduling && <>
          <span className={s.bookingStatus}>{statusLabels[booking.status]}</span>
          <h2>{booking.status === 'confirmed' ? 'You’re all set.' : 'Consultation details'}</h2>
          <div className={s.summary}>
            <strong>{booking.topic}</strong>
            <span>With {booking.host}</span>
            <span>{dateLabel(booking.startsAt)} · {timeLabel(booking.startsAt)} Jamaica time</span>
            <span>Reference {booking.reference}</span>
          </div>
          {canManage && <p className={s.muted}>{booking.meetingUrl
            ? 'Use your meeting link when it’s time to join.'
            : 'Your consultant will email you the joining details.'}</p>}
          {canManage && <div className={s.links}>
            {booking.meetingUrl && <a href={booking.meetingUrl} target="_blank" rel="noreferrer">Join consultation ↗</a>}
            <a href={addToCalendar(booking, calendar.duration)} target="_blank" rel="noreferrer">Add to Google Calendar ↗</a>
            {token && !manage && <Link to={`/consultation/manage#${token}`}>Manage booking</Link>}
            {manage && <><button type="button" onClick={() => { setRescheduling(true); setError(''); }}>Reschedule</button>
              <button type="button" disabled={busy} onClick={() => { if (window.confirm('Cancel this consultation?')) submit('cancel'); }}>Cancel consultation</button></>}
          </div>}
        </>}
        {ready && (!booking || rescheduling) && <>
          <h2>{rescheduling ? 'Choose a new time' : 'Book a consultation'}</h2>
          {!calendar.hosts.length ? <p className={s.muted}>Online booking is currently closed. Check back for new times.</p> :
            <form className={s.form} onSubmit={event => { event.preventDefault(); if (startsAt) submit(rescheduling ? 'reschedule' : ''); }}>
              <ConsultationSlots {...{ calendar, host, setHost, date, setDate, startsAt, setStartsAt, revision }} getSlots={api.consultations.slots} />
              {!rescheduling && <>
                <div className={s.formGrid}>
                  <label>Full name<input required autoComplete="name" maxLength={100} {...intakeField('name')} /></label>
                  <label>Email<input required type="email" autoComplete="email" maxLength={254} {...intakeField('email')} /></label>
                  <label>Company <span>Optional</span><input autoComplete="organization" maxLength={120} {...intakeField('company')} /></label>
                  <label>What would you like to discuss?
                    <select required {...intakeField('topic')}><option value="">Choose a topic</option>
                      {calendar.topics.map(topic => <option key={topic}>{topic}</option>)}</select>
                  </label>
                </div>
                <label>Anything we should know? <span>Optional</span><textarea rows={3} maxLength={1500}
                  placeholder="A little about your goals or what you need help with" {...intakeField('details')} /></label>
              </>}
              <button type="submit" className={s.primary} disabled={!startsAt || busy}>{busy ? 'Saving…' : rescheduling ? 'Confirm new time' : 'Confirm consultation'} <span aria-hidden="true">→</span></button>
              {rescheduling && <button type="button" className={s.secondary} disabled={busy}
                onClick={() => { setRescheduling(false); setError(''); }}>Back to consultation</button>}
            </form>}
        </>}
        {error && <p role="alert" className={s.error}>{error}</p>}
      </section>
    </main>
    <footer className={s.footer}><span>iCreate Solutions &amp; Services</span><a href="/terms#privacy">Privacy</a></footer>
  </div>;
}
