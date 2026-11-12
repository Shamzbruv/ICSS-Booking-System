import { useEffect, useState } from 'react';
import s from './Consultations.module.css';

import { timeLabel } from './format';

export function ConsultationSlots({ calendar, getSlots, host, setHost, date, setDate, startsAt, setStartsAt, revision = 0 }) {
  const [times, setTimes] = useState([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    setTimes([]);
    setStatus('Loading times…');
    getSlots(host, date, controller.signal).then(({ slots }) => {
      if (!controller.signal.aborted) {
        setTimes(slots);
        setStatus(slots.length ? '' : 'No openings on this date. Try another day.');
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
          {calendar.hosts.filter(item => item.enabled !== false).map(item =>
            <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>Date
        <input type="date" required min={calendar.from} max={calendar.to} value={date}
          onChange={event => { setDate(event.target.value); setStartsAt(''); }} />
      </label>
    </div>
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
