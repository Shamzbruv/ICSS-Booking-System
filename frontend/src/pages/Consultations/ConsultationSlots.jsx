import { useEffect, useState } from 'react';
import s from './Consultations.module.css';

import { timeLabel } from './format';

export function ConsultationSlots({ calendar, getSlots, host, setHost, date, setDate, startsAt, setStartsAt, revision = 0 }) {
  const activeHosts = calendar.hosts.filter(item => item.enabled !== false);
  const bothAvailable = activeHosts.length === 2;
  const [times, setTimes] = useState([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!date) {
      setTimes([]);
      return;
    }
    const controller = new AbortController();
    setTimes([]);
    setStatus('Loading times…');
    getSlots(host, date, controller.signal).then(({ slots }) => {
      if (!controller.signal.aborted) {
        setTimes(slots);
        const noTimes = host === 'both'
          ? 'Shamar and Jemelia have no shared openings on this date. Try another day.'
          : 'No openings on this date. Try another day.';
        setStatus(slots.length ? '' : noTimes);
      }
    }).catch(error => {
      if (!controller.signal.aborted) setStatus(error.message);
    });
    return () => controller.abort();
  }, [date, host, getSlots, revision]);

  return <>
    <div className={s.formGrid}>
      <label>Consultant
        <select value={host} onChange={event => { setHost(event.target.value); setStartsAt(''); }}>
          <option value="any">First available</option>
          {activeHosts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          <option value="both" disabled={!bothAvailable}>
            {bothAvailable ? 'Shamar and Jemelia (joint meeting)' : 'Joint meeting (currently unavailable)'}
          </option>
        </select>
      </label>
      <label>Date
        <input type="date" required min={calendar.from} max={calendar.to} value={date}
          onChange={event => { setDate(event.target.value); setStartsAt(''); }} />
      </label>
    </div>
    {host === 'both' && <p className={s.muted}>{bothAvailable
      ? 'Only times when both consultants are free are shown.'
      : 'Joint bookings open when both consultants publish availability.'}</p>}
    {date && <fieldset className={s.timeField}>
      <legend>Available times <span>Jamaica time</span></legend>
      {status && <p className={s.muted} role="status">{status}</p>}
      <div className={s.times}>
        {times.map(time => <button type="button" key={time} aria-pressed={startsAt === time}
          onClick={() => setStartsAt(time)}>{timeLabel(time)}</button>)}
      </div>
    </fieldset>}
  </>;
}
