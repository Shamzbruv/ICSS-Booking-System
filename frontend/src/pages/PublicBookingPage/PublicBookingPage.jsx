/**
 * PublicBookingPage — Customer-facing booking wizard.
 *
 * Decoupled from the admin editor layout. Uses tenant branding for
 * appearance (name, accent color, logo) but always renders a fixed,
 * reliable 4-step booking flow.
 *
 * Steps:
 *   1 — Select a Service
 *   2 — Pick Date & Time
 *   3 — Enter your Details
 *   4 — Payment / Confirmation
 *
 * WiPay return path:  /:slug?booking=<id>&transaction_id=<txn>
 * On load if those params are present, skip to verification state.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams }  from 'react-router-dom';
import { api }        from '../../api';
import s              from './PublicBookingPage.module.css';

import ThemeBarber from '../../themes/ThemeBarber';
import ThemeSpa from '../../themes/ThemeSpa';
import ThemeMechanic from '../../themes/ThemeMechanic';
import ThemeEvents from '../../themes/ThemeEvents';
import ThemeFitness from '../../themes/ThemeFitness';
import ThemeHairdresser from '../../themes/ThemeHairdresser';
import ThemeHealth from '../../themes/ThemeHealth';
import ThemeLaw from '../../themes/ThemeLaw';
import ThemeNailTech from '../../themes/ThemeNailTech';
import ThemePhotography from '../../themes/ThemePhotography';
import ThemeUniversal from '../../themes/ThemeUniversal';

const STEPS = ['Service', 'Date & Time', 'Your Details', 'Confirm'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function buildAccentVars(tenant) {
  const accent = tenant?.branding?.accent_color || '#7c6ef7';
  return { '--accent': accent, '--accent-dim': `${accent}22` };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepBar({ step }) {
  return (
    <div className={s.stepBar}>
      {STEPS.map((label, i) => (
        <div key={i} className={`${s.stepBar__item} ${i < step ? s['stepBar__item--done'] : i === step ? s['stepBar__item--active'] : ''}`}>
          <div className={s.stepBar__dot}>{i < step ? '✓' : i + 1}</div>
          <span className={s.stepBar__label}>{label}</span>
          {i < STEPS.length - 1 && <div className={s.stepBar__line} />}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Service Selection ─────────────────────────────────────────────────

function StepService({ services, onSelect }) {
  return (
    <div className={s.step}>
      <h2 className={s.step__title}>Select a Service</h2>
      {services.length === 0 ? (
        <div className={s.empty}>No services are currently available. Please check back soon.</div>
      ) : (
        <div className={s.serviceGrid}>
          {services.map(svc => (
            <button key={svc.id} className={s.serviceCard} onClick={() => onSelect(svc)}>
              <div className={s.serviceCard__name}>{svc.name}</div>
              {svc.description && <div className={s.serviceCard__desc}>{svc.description}</div>}
              <div className={s.serviceCard__meta}>
                <span className={s.pill}>⏱ {svc.duration_minutes} min</span>
                {svc.price > 0 && <span className={s.pill}>{svc.currency} {Number(svc.price).toLocaleString()}</span>}
                {svc.price == 0 && <span className={`${s.pill} ${s['pill--free']}`}>Free</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 2: Date + Time ───────────────────────────────────────────────────────

function MonthCalendar({ slug, serviceId, onConfirm }) {
  const today    = new Date();
  const maxDate  = new Date();
  maxDate.setDate(today.getDate() + 30);

  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots]         = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  const canPrevMonth = viewMonth > today.getMonth() || viewYear > today.getFullYear();
  const goNextMonth  = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null); setSlots([]); setSelectedSlot(null);
  };
  const goPrevMonth  = () => {
    if (!canPrevMonth) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null); setSlots([]); setSelectedSlot(null);
  };

  const selectDay = useCallback(async (day) => {
    const d = new Date(viewYear, viewMonth, day);
    if (d < today || d > maxDate) return;
    const iso = isoDate(d);
    setSelectedDate(iso);
    setSelectedSlot(null);
    setSlots([]);
    setLoadingSlots(true);
    try {
      const res = await api.publicAvailability(slug, iso, serviceId);
      setSlots(res.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [viewYear, viewMonth, slug, serviceId]);

  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  return (
    <div className={s.step}>
      <h2 className={s.step__title}>Pick a Date & Time</h2>

      {/* Calendar grid */}
      <div className={s.calendar}>
        <div className={s.calendar__nav}>
          <button className={s.calendar__navBtn} onClick={goPrevMonth} disabled={!canPrevMonth}>‹</button>
          <span className={s.calendar__month}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button className={s.calendar__navBtn} onClick={goNextMonth}>›</button>
        </div>

        <div className={s.calendar__grid}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} className={s.calendar__dow}>{d}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const d   = new Date(viewYear, viewMonth, day);
            const iso = isoDate(d);
            const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const isFuture = d > maxDate;
            const isDisabled = isPast || isFuture;
            const isSelected = selectedDate === iso;
            return (
              <button
                key={iso}
                className={`${s.calendar__day} ${isDisabled ? s['calendar__day--disabled'] : ''} ${isSelected ? s['calendar__day--selected'] : ''}`}
                onClick={() => !isDisabled && selectDay(day)}
                disabled={isDisabled}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className={s.slots}>
          <h3 className={s.slots__title}>Available Times</h3>
          {loadingSlots ? (
            <div className={s.slots__loading}>Checking availability…</div>
          ) : slots.length === 0 ? (
            <div className={s.empty}>No times available on this date.</div>
          ) : (
            <div className={s.slots__grid}>
              {slots.map(slot => (
                <button
                  key={slot.time}
                  className={`${s.slotChip} ${!slot.available ? s['slotChip--disabled'] : ''} ${selectedSlot?.time === slot.time ? s['slotChip--selected'] : ''}`}
                  onClick={() => slot.available && setSelectedSlot(slot)}
                  disabled={!slot.available}
                  title={!slot.available ? (slot.adminReason || slot.reason) : slot.label}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedDate && selectedSlot && (
        <div className={s.step__actions}>
          <button className={s.btnPrimary} onClick={() => onConfirm(selectedDate, selectedSlot)}>
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Customer Details ──────────────────────────────────────────────────

function StepDetails({ service, date, slot, onSubmit, submitting, error }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.phone) return;
    onSubmit(form);
  };

  const prettyDate = date ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';

  return (
    <div className={s.step}>
      <h2 className={s.step__title}>Your Details</h2>

      {/* Summary */}
      <div className={s.bookingSummary}>
        <div className={s.bookingSummary__row}>
          <span>Service</span><strong>{service?.name}</strong>
        </div>
        <div className={s.bookingSummary__row}>
          <span>Date</span><strong>{prettyDate}</strong>
        </div>
        <div className={s.bookingSummary__row}>
          <span>Time</span><strong>{slot?.label}</strong>
        </div>
        {service?.price > 0 && (
          <div className={s.bookingSummary__row}>
            <span>Price</span><strong>{service.currency} {Number(service.price).toLocaleString()}</strong>
          </div>
        )}
      </div>

      <div className={s.formGrid}>
        <div className={s.formField}>
          <label>Full Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Jordan Clarke" />
        </div>
        <div className={s.formField}>
          <label>Email Address *</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" />
        </div>
        <div className={s.formField}>
          <label>Phone Number *</label>
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 876 000 0000" />
        </div>
        <div className={`${s.formField} ${s['formField--full']}`}>
          <label>Notes <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything the team should know…" rows={3} />
        </div>
      </div>

      {error && <div className={s.errorBanner}>{error}</div>}

      <div className={s.step__actions}>
        <button
          className={s.btnPrimary}
          onClick={handleSubmit}
          disabled={submitting || !form.name || !form.email || !form.phone}
        >
          {submitting ? 'Booking…' : 'Book Now →'}
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Confirmation / Payment ────────────────────────────────────────────

function StepConfirm({ result, slug }) {
  const { booking, checkoutUrl, bankInstructions } = result;

  if (checkoutUrl) {
    // WiPay — auto-redirect; show a spinner while the browser navigates
    useEffect(() => { window.location.href = checkoutUrl; }, []);
    return (
      <div className={s.step}>
        <div className={s.successIcon}>💳</div>
        <h2 className={s.step__title}>Redirecting to Payment…</h2>
        <p className={s.step__sub}>You will be redirected to complete your payment securely.</p>
      </div>
    );
  }

  if (bankInstructions) {
    return (
      <div className={s.step}>
        <div className={s.successIcon}>🏦</div>
        <h2 className={s.step__title}>Almost There!</h2>
        <p className={s.step__sub}>Your slot is being held. Complete the bank transfer below to confirm your booking.</p>
        <div className={s.bankBox}>
          <h3>Bank Transfer Details</h3>
          <pre className={s.bankBox__text}>{bankInstructions}</pre>
        </div>
        <p className={s.step__sub} style={{ marginTop: 16, opacity: 0.6 }}>
          Your reference number: <strong>#{booking?.id?.slice(0, 8).toUpperCase()}</strong><br/>
          We'll confirm your booking once payment is received.
        </p>
      </div>
    );
  }

  // Confirmed immediately (no-payment or already confirmed)
  return (
    <div className={s.step}>
      <div className={s.successIcon}>🎉</div>
      <h2 className={s.step__title}>Booking Confirmed!</h2>
      <p className={s.step__sub}>We look forward to seeing you.</p>
      <div className={s.bookingSummary} style={{ maxWidth: 380, margin: '24px auto 0' }}>
        <div className={s.bookingSummary__row}><span>Ref</span><strong>#{booking?.id?.slice(0, 8).toUpperCase()}</strong></div>
        <div className={s.bookingSummary__row}><span>Email</span><strong>{booking?.email}</strong></div>
        <div className={s.bookingSummary__row}><span>Status</span><strong style={{ color: 'var(--accent)' }}>Confirmed ✓</strong></div>
      </div>
    </div>
  );
}

// ── WiPay Return Handler ──────────────────────────────────────────────────────

function WiPayReturn({ slug }) {
  const params   = new URLSearchParams(window.location.search);
  const bookingId = params.get('booking');
  const txnId    = params.get('transaction_id');

  const [status, setStatus] = useState('verifying'); // verifying | confirmed | failed | pending
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    if (!bookingId || !txnId) { setStatus('failed'); return; }
    api.publicVerifyPayment(slug, bookingId, txnId)
      .then(res => {
        setBooking(res.booking);
        setStatus(res.booking?.status === 'confirmed' ? 'confirmed' : 'pending');
      })
      .catch(() => setStatus('failed'));
  }, []);

  const icons   = { verifying: '⏳', confirmed: '🎉', failed: '❌', pending: '⏳' };
  const titles  = { verifying: 'Verifying Payment…', confirmed: 'Payment Confirmed!', failed: 'Verification Failed', pending: 'Payment Pending' };
  const messages = {
    verifying: 'Please wait while we verify your payment.',
    confirmed: 'Your booking is confirmed. See you soon!',
    failed:    'We could not verify your payment. Please contact us with your booking reference.',
    pending:   'Payment received. Your booking is pending manual confirmation.',
  };

  return (
    <div className={s.centreWrap}>
      <div className={s.resultCard}>
        <div className={s.successIcon}>{icons[status]}</div>
        <h2 className={s.step__title}>{titles[status]}</h2>
        <p className={s.step__sub}>{messages[status]}</p>
        {booking && <p style={{ opacity: 0.5, fontSize: 13, marginTop: 12 }}>Ref: #{booking.id?.slice(0, 8).toUpperCase()}</p>}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PublicBookingPage() {
  const { slug }  = useParams();
  const params    = new URLSearchParams(window.location.search);
  const isWiPayReturn = params.has('booking') && params.has('transaction_id');

  const [tenant,   setTenant]   = useState(null);
  const [services, setServices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [pageError, setPageError] = useState(null);

  // Booking state
  const [step,     setStep]     = useState(0);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate,    setSelectedDate]    = useState(null);
  const [selectedSlot,    setSelectedSlot]    = useState(null);
  const [bookingResult,   setBookingResult]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    Promise.all([api.publicTenant(slug), api.publicServices(slug)])
      .then(([t, s]) => {
        setTenant(t);
        setServices(s.services || []);
      })
      .catch(() => setPageError('This booking page is not available. Please check the link and try again.'))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSelectService = (svc) => {
    setSelectedService(svc);
    setStep(1);
  };

  const handleDateTimeConfirm = (date, slot) => {
    setSelectedDate(date);
    setSelectedSlot(slot);
    setStep(2);
  };

  const handleDetailsSubmit = async (form) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.publicCreateBooking(slug, {
        name:       form.name,
        email:      form.email,
        phone:      form.phone,
        notes:      form.notes,
        date:       selectedDate,
        time:       selectedSlot.time,
        service_id: selectedService.id,
      });
      setBookingResult(res);
      setStep(3);
    } catch (err) {
      setSubmitError(err.message || 'Could not complete your booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => setStep(s => Math.max(s - 1, 0));

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className={s.fullscreen}>
      <div className={s.spinner} />
      <p>Loading…</p>
    </div>
  );

  if (pageError) return (
    <div className={s.fullscreen}>
      <div className={s.errorIcon}>⚠️</div>
      <p>{pageError}</p>
    </div>
  );

  // WiPay redirect-back — bypass the wizard and go straight to verification
  if (isWiPayReturn) {
    return (
      <div className={s.page} style={buildAccentVars(tenant)}>
        <PageHeader tenant={tenant} />
        <WiPayReturn slug={slug} />
      </div>
    );
  }

  // --- THEME ROUTER ---
  if (tenant.themeName === 'Iron & Blade') {
    return <ThemeBarber tenant={tenant} services={services} />;
  }
  if (tenant.themeName === 'Botanica Spa') {
    return <ThemeSpa tenant={tenant} services={services} />;
  }
  if (tenant.themeName === 'Pro Auto Care') {
    return <ThemeMechanic tenant={tenant} services={services} />;
  }
  if (tenant.themeName === 'Gather & Grace') {
    return <ThemeEvents tenant={tenant} services={services} />;
  }
  if (tenant.themeName === 'Pulse Studio') {
    return <ThemeFitness tenant={tenant} services={services} />;
  }
  if (tenant.themeName === 'Blush & Braids') {
    return <ThemeHairdresser tenant={tenant} services={services} />;
  }
  if (tenant.themeName === 'Serenity Health') {
    return <ThemeHealth tenant={tenant} services={services} />;
  }
  if (tenant.themeName === 'Meridian Law') {
    return <ThemeLaw tenant={tenant} services={services} />;
  }
  if (tenant.themeName === 'Polished & Pure') {
    return <ThemeNailTech tenant={tenant} services={services} />;
  }
  if (tenant.themeName === 'Lumina Lens') {
    return <ThemePhotography tenant={tenant} services={services} />;
  }

  // Fallback to Universal theme
  return <ThemeUniversal tenant={tenant} services={services} />;
}

// ── Page Header (tenant branding) ─────────────────────────────────────────────

function PageHeader({ tenant }) {
  const name  = tenant?.name || 'Book an Appointment';
  const logo  = tenant?.branding?.logo_url;
  const tagline = tenant?.branding?.tagline || '';

  return (
    <header className={s.pageHeader}>
      {logo && <img src={logo} alt={name} className={s.pageHeader__logo} />}
      <h1 className={s.pageHeader__name}>{name}</h1>
      {tagline && <p className={s.pageHeader__tagline}>{tagline}</p>}
    </header>
  );
}
