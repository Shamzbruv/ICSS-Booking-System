import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './CustomerReviews.module.css';

async function reviewRequest(slug, query = '', body) {
  const response = await fetch(`/api/v1/reviews${query}`, {
    method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: { 'X-Tenant-Slug': slug, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Reviews are temporarily unavailable.');
  return data;
}
function Review({ review }) {
  return <article className={styles.review}>
    <div className={styles.stars} aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
    <p className={styles.comment}>{review.comment}</p>
    <strong>{review.display_name}</strong>
    <small>Verified booking · {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</small>
  </article>;
}

export default function CustomerReviews({ tenant, preview = false }) {
  const location = useLocation();
  const token = new URLSearchParams(location.hash.slice(1)).get('review') || '';
  const demo = Boolean(tenant.isDemo || preview), slug = tenant.slug;
  const [summary, setSummary] = useState({ count: 0, average: 0 });
  const [reviews, setReviews] = useState([]), [allReviews, setAllReviews] = useState([]), [cursor, setCursor] = useState(null);
  const [modal, setModal] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(''), [comment, setComment] = useState(''), [consent, setConsent] = useState(false), [success, setSuccess] = useState('');
  const dialog = useRef(null), opener = useRef(null), listBusy = useRef(false), requestVersion = useRef(0);
  const load = useCallback(async () => {
    if (demo || !slug) { setLoading(false); return; }
    setLoading(true);
    try { const data = await reviewRequest(slug, '?limit=3'); setSummary(data.summary); setReviews(data.reviews); setError(''); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [slug, demo]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (token && !demo) setModal('write'); }, [token, demo]);
  useEffect(() => {
    const node = dialog.current;
    if (modal) { opener.current = document.activeElement; if (!node.open) node.showModal(); }
    else if (node.open) { node.close(); opener.current?.focus?.(); }
  }, [modal]);
  const openList = async () => {
    setModal('list'); setError(''); setAllReviews(reviews); setCursor(null);
    const version = ++requestVersion.current;
    listBusy.current = true; setLoading(true);
    try { const data = await reviewRequest(slug, '?limit=20'); if (requestVersion.current === version) { setAllReviews(data.reviews); setCursor(data.nextCursor); } }
    catch (err) { setError(err.message); } finally { listBusy.current = false; setLoading(false); }
  };
  const more = async () => {
    if (!cursor || listBusy.current) return;
    listBusy.current = true; setLoading(true);
    try {
      const data = await reviewRequest(slug, `?limit=20&before=${encodeURIComponent(cursor)}`);
      setAllReviews(previous => [...previous, ...data.reviews.filter(r => !previous.some(p => p.id === r.id))]); setCursor(data.nextCursor); setError('');
    } catch (err) { setError(err.message); } finally { listBusy.current = false; setLoading(false); }
  };
  const submit = async event => {
    event.preventDefault(); if (saving || demo || !token) return;
    setSaving(true); setError('');
    try {
      await reviewRequest(slug, '', { token, rating: Number(rating), comment, publishConsent: consent });
      setSuccess('Thank you. Your review has been published.'); setModal(''); await load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <section className={styles.section} aria-labelledby="customer-review-heading" id="customer-reviews">
    <div className={styles.header}><div><p className={styles.eyebrow}>From our customers</p><h2 id="customer-review-heading">Ratings & reviews</h2>
      {summary.count > 0 ? <p><strong>{summary.average.toFixed(1)} / 5</strong> · {summary.count} verified {summary.count === 1 ? 'review' : 'reviews'}</p> : <p>{demo ? 'Verified customer reviews will appear here on your live website.' : 'Be the first to share your experience after your visit.'}</p>}
    </div><button type="button" className={styles.button} onClick={() => { setError(''); setModal('write'); }}>Write a review</button></div>
    {success && <p role="status">{success}</p>}
    {!modal && error && <p role="alert">{error} <button type="button" onClick={load}>Try again</button></p>}
    {loading && !modal && <p role="status">Loading reviews…</p>}
    <div className={styles.grid}>{reviews.slice(0, 3).map(review => <Review key={review.id} review={review} />)}</div>
    {summary.count > 3 && <button type="button" className={styles.button} onClick={openList}>See more reviews ({summary.count})</button>}
    <dialog className={styles.dialog} ref={dialog} onCancel={() => setModal('')} aria-labelledby="review-dialog-title">
      <header className={styles.dialogHeader}><h2 id="review-dialog-title">{modal === 'list' ? 'Customer reviews' : 'Share your experience'}</h2><button type="button" className={styles.close} aria-label="Close reviews" onClick={() => setModal('')}>×</button></header>
      <div className={styles.dialogBody} onScroll={modal === 'list' ? e => { const node = e.currentTarget; if (node.scrollHeight - node.scrollTop - node.clientHeight < 120) more(); } : undefined}>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {modal === 'list' ? <>{allReviews.map(review => <Review key={review.id} review={review} />)}{cursor && <button type="button" className={styles.button} disabled={loading} onClick={more}>{loading ? 'Loading…' : 'Load more reviews'}</button>}{loading && !cursor && <p role="status">Loading…</p>}</> :
          (!token || demo) ? <p>After your appointment is marked completed, your email will include a private link to rate your visit and leave a review. This helps keep ratings based on verified bookings. If you booked by phone, ask the business to include your email when making the booking.</p> :
            <form onSubmit={submit} className={styles.form}>
              <p>Your review helps other customers choose with confidence. Please keep personal or sensitive information out of your comment.</p>
              <label htmlFor="review-rating">Your rating</label><select id="review-rating" required value={rating} onChange={e => setRating(e.target.value)}><option value="">Choose a rating</option>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} {value === 1 ? 'star' : 'stars'}</option>)}</select>
              <label htmlFor="review-comment">Your experience</label><textarea id="review-comment" required maxLength={1200} rows={5} value={comment} onChange={e => setComment(e.target.value)} /><small>{comment.length} / 1,200 characters</small>
              <label className={styles.consent}><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />I agree to publish my rating and comment with my first name and last initial.</label>
              <button className={styles.button} disabled={saving || !rating || !comment.trim() || !consent}>{saving ? 'Publishing…' : 'Publish review'}</button>
              <small>One review per completed booking. Using this invitation again updates your review.</small>
            </form>}
      </div>
    </dialog>
  </section>;
}
