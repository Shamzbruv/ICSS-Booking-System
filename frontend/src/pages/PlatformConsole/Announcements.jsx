import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import s from './PlatformConsole.module.css';

const emptyDraft = { title: '', body: '' };

export default function Announcements() {
  const [draft, setDraft] = useState(emptyDraft);
  const [announcements, setAnnouncements] = useState(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(null);
  const retry = useRef(null);

  useEffect(() => {
    let active = true;
    api.platform.listAnnouncements().then(result => {
      if (active) setAnnouncements(result.announcements);
    }).catch(error => {
      if (active) setNotice({ error: true, text: error.message });
    });
    return () => { active = false; };
  }, []);

  async function refresh() {
    const result = await api.platform.listAnnouncements();
    setAnnouncements(result.announcements);
  }

  async function publish(event) {
    event.preventDefault();
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (pending || !title || !body || !window.confirm('Publish this update to all tenant dashboards?')) return;
    const signature = JSON.stringify([title, body]);
    if (retry.current?.signature !== signature) retry.current = { signature, id: crypto.randomUUID() };
    setPending(true);
    setNotice(null);
    try {
      await api.platform.publishAnnouncement({ title, body, requestId: retry.current.id });
      retry.current = null;
      setDraft(emptyDraft);
      setNotice({ text: 'Published to tenant dashboards.' });
      await refresh();
    } catch (error) {
      setNotice({ error: true, text: error.message });
    } finally {
      setPending(false);
    }
  }

  async function withdraw(announcement) {
    if (pending || !window.confirm(`Withdraw “${announcement.title}” from tenant dashboards?`)) return;
    setPending(true);
    setNotice(null);
    try {
      await api.platform.withdrawAnnouncement(announcement.id);
      setNotice({ text: 'Announcement withdrawn.' });
      await refresh();
    } catch (error) {
      setNotice({ error: true, text: error.message });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={s.view}>
      <div className={s.view__header}>
        <div>
          <h2 className={s.view__title}>Update announcements</h2>
          <p className={s.chartHint}>Publish a pop-up that tenant teams can dismiss after reading.</p>
        </div>
      </div>
      <div className={s.section}>
        <div className={s.announcementComposer}>
          <form className={s.announcementForm} onSubmit={publish}>
            <label>Update title<input className={s.loginInput} value={draft.title} maxLength={100} required onChange={event => setDraft({ ...draft, title:event.target.value })} /></label>
            <label>Message<textarea className={s.loginInput} rows={7} value={draft.body} maxLength={2000} required onChange={event => setDraft({ ...draft, body:event.target.value })} /></label>
            <button className={s.btnPrimary} type="submit" disabled={pending || !draft.title.trim() || !draft.body.trim()}>Publish to all tenants</button>
          </form>
          <div className={s.announcementPreview}>
            <h3>Tenant preview</h3>
            <div>
              <p className={s.muted}>ICSS Bookings update</p>
              <strong>{draft.title.trim() || 'Update title'}</strong>
              <p className={s.announcementText}>{draft.body.trim() || 'Your message will appear here.'}</p>
            </div>
          </div>
        </div>
        {notice && <p className={s.announcementStatus} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      </div>
      <div className={s.section}>
        <h3 className={s.section__title}>Published updates</h3>
        {announcements?.length ? (
          <ul className={s.announcementHistory}>
            {announcements.map(item => (
              <li key={item.id}>
                <div>
                  <h4>{item.title}</h4>
                  <p className={s.muted}>{new Date(item.published_at).toLocaleString()}{item.author_name ? ` · ${item.author_name}` : ''}{item.withdrawn_at ? ' · Withdrawn' : ' · Active'}</p>
                  <p className={s.announcementText}>{item.body}</p>
                </div>
                {!item.withdrawn_at && <button className={s.btnGhost} type="button" disabled={pending} onClick={() => withdraw(item)}>Withdraw</button>}
              </li>
            ))}
          </ul>
        ) : <div className={s.empty}>{announcements ? 'No updates have been published.' : notice?.error ? 'Announcement history is unavailable.' : 'Loading updates…'}</div>}
      </div>
    </div>
  );
}
