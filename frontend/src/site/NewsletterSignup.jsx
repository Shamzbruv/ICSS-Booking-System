import { useId, useState } from 'react';
import s from './TenantWebsite.module.css';

export default function NewsletterSignup({ tenant, preview, title, subtitle, buttonLabel }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const simulation = tenant.isDemo || preview;

  async function subscribe(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setResult(null);
    try {
      if (simulation) {
        setResult({ text: 'This is a preview. On a live site, we’ll send a confirmation link.' });
      } else {
        const response = await fetch('/api/v1/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: tenant.slug, email: fields.get('email'), consent: fields.has('consent') })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Signup could not be completed.');
        setResult({ text: data.message });
      }
      form.reset();
    } catch (error) {
      setResult({ text: error.message || 'Signup could not be completed.', error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={s.newsletterSection} aria-labelledby={id}>
      <div className={`${s.container} ${s.newsletterInner}`}>
        <div>
          <h2 id={id} data-site-field="title">{title || 'Get news and updates'}</h2>
          <p data-site-field="subtitle">{subtitle || 'Sign up for updates from this business. You can unsubscribe at any time.'}</p>
        </div>
        <form onSubmit={subscribe} className={s.newsletterForm}>
          <label htmlFor={`${id}-email`}>Email address</label>
          <div className={s.newsletterInputRow}>
            <input id={`${id}-email`} name="email" type="email" autoComplete="email" maxLength={254} required />
            <button className={s.btnPrimary} disabled={busy} data-site-field="buttonLabel">{busy ? 'Sending…' : buttonLabel || 'Subscribe'}</button>
          </div>
          <label className={s.newsletterConsent}><input name="consent" type="checkbox" required /> I agree to receive newsletter emails.</label>
          {result && <p role={result.error ? 'alert' : 'status'}>{result.text}</p>}
        </form>
      </div>
    </section>
  );
}
