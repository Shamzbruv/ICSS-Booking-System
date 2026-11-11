import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './CustomerReviews.module.css';

async function reviewRequest(slug, query = '', { body, signal } = {}) {
  const response = await fetch(`/api/v1/reviews${query}`, {
    method: body ? 'POST' : 'GET', cache: 'no-store', signal,
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
  const [{ summary, reviews, nextCursor }, setLatest] = useState({
    summary: { count: 0, average: 0 }, reviews: [], nextCursor: null
  });
  const [olderReviews, setOlderReviews] = useState([]);
  const [olderCursor, setOlderCursor] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [modal, setModal] = useState(''), [formError, setFormError] = useState('');
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(''), [comment, setComment] = useState(''), [consent, setConsent] = useState(false), [success, setSuccess] = useState('');
  const dialog = useRef(null), opener = useRef(null), listRequest = useRef(null);

  const load = useCallback(async (signal) => {
    if (demo || !slug) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await reviewRequest(slug, '?limit=3', { signal });
      if (!signal?.aborted) { setLatest(data); setError(''); }
    } catch (err) {
      if (!signal?.aborted) setError(err.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [slug, demo]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => {
      controller.abort();
      listRequest.current?.abort();
    };
  }, [load]);
  useEffect(() => { if (token && !demo) setModal('write'); }, [token, demo]);
  useEffect(() => {
    const node = dialog.current;
    if (modal && !node.open) {
      opener.current = document.activeElement;
      node.showModal();
    } else if (!modal && node.open) {
      node.close();
      opener.current?.focus?.();
    }
  }, [modal]);

  const closeModal = () => {
    listRequest.current?.abort();
    listRequest.current = null;
    setListLoading(false);
    setModal('');
  };
  const loadOlder = async (cursor) => {
    if (!cursor || listRequest.current) return;
    const controller = new AbortController();
    listRequest.current = controller;
    setListLoading(true);
    setListError('');
    try {
      const data = await reviewRequest(slug, `?limit=20&before=${encodeURIComponent(cursor)}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setOlderReviews(previous => [...previous, ...data.reviews]);
      setOlderCursor(data.nextCursor);
    } catch (err) {
      if (!controller.signal.aborted) setListError(err.message);
    } finally {
      if (listRequest.current === controller) {
        listRequest.current = null;
        setListLoading(false);
      }
    }
  };
  const openList = () => {
    setOlderReviews([]);
    setOlderCursor(nextCursor);
    setModal('list');
    loadOlder(nextCursor);
  };
  const submit = async event => {
    event.preventDefault(); if (saving || demo || !token) return;
    setSaving(true); setFormError('');
    try {
      await reviewRequest(slug, '', { body: { token, rating: Number(rating), comment, publishConsent: consent } });
      setSuccess('Thank you. Your review has been published.'); setModal(''); await load();
    } catch (err) { setFormError(err.message); } finally { setSaving(false); }
  };
  const extraCount = summary.count - reviews.length;
  return <section className={styles.section} aria-labelledby="customer-review-heading" id="customer-reviews">
    <div className={styles.header}>
      <div>
        <h2 id="customer-review-heading">Ratings &amp; reviews</h2>
        <div className={styles.summary}>
          <span className={`${styles.stars} ${styles.averageStars}`} aria-hidden="true">
            {'☆☆☆☆☆'}
            <span style={{ width: `${summary.average * 20}%` }}>{'★★★★★'}</span>
          </span>
          <span><strong>{summary.average.toFixed(1)} out of 5</strong> · {summary.count} verified {summary.count === 1 ? 'review' : 'reviews'}</span>
        </div>
      </div>
      <button type="button" className={styles.button} onClick={() => { setFormError(''); setModal('write'); }}>Write a review</button>
    </div>
    {success && <p role="status">{success}</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => load()}>Try again</button></p>}
    {loading && <p role="status">Loading reviews…</p>}
    <div className={styles.grid}>{reviews.map(review => <Review key={review.id} review={review} />)}</div>
    {nextCursor && extraCount > 0 && <button type="button" className={styles.button} onClick={openList}>View more reviews ({extraCount})</button>}
    <dialog className={styles.dialog} ref={dialog} onCancel={event => { event.preventDefault(); closeModal(); }} aria-labelledby="review-dialog-title">
      <header className={styles.dialogHeader}>
        <h2 id="review-dialog-title">{modal === 'list' ? 'More customer reviews' : 'Share your experience'}</h2>
        <button type="button" className={styles.close} aria-label="Close reviews" onClick={closeModal}>×</button>
      </header>
      <div className={styles.dialogBody}>
        {modal === 'list' ? <>
          {olderReviews.map(review => <Review key={review.id} review={review} />)}
          {listError && <p role="alert" className={styles.error}>{listError}</p>}
          {listLoading && <p role="status">Loading reviews…</p>}
          {olderCursor && !listLoading && <button type="button" className={styles.button} onClick={() => loadOlder(olderCursor)}>{listError ? 'Try again' : 'Load more reviews'}</button>}
        </> :
          (!token || demo) ? <p>After your appointment is marked completed, your email will include a private link to rate your visit and leave a review. This helps keep ratings based on verified bookings. If you booked by phone, ask the business to include your email when making the booking.</p> :
            <form onSubmit={submit} className={styles.form}>
              {formError && <p role="alert" className={styles.error}>{formError}</p>}
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
