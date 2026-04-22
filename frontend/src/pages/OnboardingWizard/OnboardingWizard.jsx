// src/pages/OnboardingWizard/OnboardingWizard.jsx
//
// Multi-step onboarding. Persists progress to localStorage so the user
// can safely close the tab and return exactly where they left off.
//
// IMPORTANT: password is NEVER persisted to localStorage.
// If the user refreshes mid-flow, they must re-enter it at Step 0.
//
// Steps:
//   0 → Business Basics (name, owner, email, password)
//   1 → Choose Theme (redirects to ThemeSelector page)
//   2 → PayPal Subscription Checkout ($35.50/mo — 7-day free trial)
//   3 → Success / Provisioning Wait

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './OnboardingWizard.module.css';
import { api } from '../../api';

// PayPal plan config — read from Vite env so changes don't require code edits
const PAYPAL_PLAN_ID   = import.meta.env.VITE_PAYPAL_PLAN_ID   || 'P-4EC410252Y479773KNHUVB4A';
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

const TOTAL_STEPS = 3;

function StepDots({ current }) {
  return (
    <div className={s.wizard__steps}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`${s['wizard__step-dot']} ${i < current ? s['wizard__step-dot--done'] : i === current ? s['wizard__step-dot--active'] : ''}`}
        />
      ))}
    </div>
  );
}

// ── Step 0: Business Basics ──────────────────────────────────────────────────
function StepBasics({ data, onChange, onNext }) {
  const [err, setErr] = useState('');

  // password is in a ref to keep it out of localStorage persistence entirely
  const passwordRef = useRef('');

  const submit = () => {
    const pw = passwordRef.current;
    if (!data.businessName || !data.ownerName || !data.email || !pw) {
      return setErr('All fields are required.');
    }
    if (pw.length < 8) return setErr('Password must be at least 8 characters.');
    setErr('');
    // Store password into data only in memory, never in localStorage
    onChange('password', pw);
    onNext();
  };

  return (
    <>
      <h1 className={s.wizard__title}>Start your free trial</h1>
      <p className={s.wizard__subtitle}>7 days free, then $35.50 USD/month. Cancel anytime.</p>
      <div className={s.wizard__field}>
        <label className={s.wizard__label}>Business Name</label>
        <input value={data.businessName} onChange={e => onChange('businessName', e.target.value)} placeholder="e.g. Luxe Hair Studio" />
      </div>
      <div className={s.wizard__field}>
        <label className={s.wizard__label}>Your Full Name</label>
        <input value={data.ownerName} onChange={e => onChange('ownerName', e.target.value)} placeholder="e.g. Jordan Clarke" />
      </div>
      <div className={s.wizard__field}>
        <label className={s.wizard__label}>Email Address</label>
        <input type="email" value={data.email} onChange={e => onChange('email', e.target.value)} placeholder="you@example.com" />
      </div>
      <div className={s.wizard__field}>
        <label className={s.wizard__label}>Password</label>
        {/* Uncontrolled input — value never enters state or localStorage */}
        <input
          type="password"
          placeholder="Min 8 characters"
          onChange={e => { passwordRef.current = e.target.value; }}
        />
      </div>
      {err && <p className={s.wizard__error}>{err}</p>}
      <div className={s.wizard__actions}>
        <button className={`${s.btn} ${s['btn--primary']}`} onClick={submit}>Continue →</button>
      </div>
    </>
  );
}

// ── Step 1: Theme Selection (delegates to ThemeSelector page) ────────────────
function StepTheme({ data, onNext, onBack, navigate }) {
  return (
    <>
      <h1 className={s.wizard__title}>Pick your starter theme</h1>
      <p className={s.wizard__subtitle}>Your theme defines your public booking page style. You can customise it fully in the editor.</p>
      <div style={{ padding: '20px', textAlign: 'center', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 8 }}>
        {data.themeId ? (
          <p style={{ color: 'var(--color-success)' }}>✓ Theme selected: <strong>{data.themeName}</strong></p>
        ) : (
          <p style={{ color: 'var(--color-text-muted)' }}>No theme selected yet.</p>
        )}
      </div>
      <div className={s.wizard__actions}>
        <button className={`${s.btn} ${s['btn--ghost']}`} onClick={onBack}>← Back</button>
        <button className={`${s.btn} ${s['btn--ghost']}`} style={{ flex: 1 }} onClick={() => navigate('/themes?from=onboarding')}>
          Browse Themes
        </button>
        <button className={`${s.btn} ${s['btn--primary']}`} onClick={onNext} disabled={!data.themeId}>
          Launch Subscription →
        </button>
      </div>
    </>
  );
}

// ── Step 2: PayPal Checkout ──────────────────────────────────────────────────
function StepPayPal({ data, onNext }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [signupToken, setSignupToken] = useState(null);

  // Guard against firing twice in StrictMode
  const initiated = useRef(false);

  const startSubscription = async () => {
    if (initiated.current) return;
    initiated.current = true;
    setLoading(true);
    setErr('');

    // Require password to be present — it won't be if the user refreshed after Step 0
    if (!data.password) {
      setErr('Session expired. Please go back and re-enter your password.');
      setLoading(false);
      initiated.current = false;
      return;
    }

    try {
      const res = await api.createPendingSignup({
        tenant_name:      data.businessName,
        admin_email:      data.email,
        admin_password:   data.password,
        admin_owner_name: data.ownerName,
        theme_id:         data.themeId || null,
        plan_id:          'monthly',
      });
      setSignupToken(res.signup_token);
      localStorage.setItem('icss_signup_token', res.signup_token);
      loadPayPalSDK(res.signup_token);
    } catch (e) {
      setErr(e.message);
      setLoading(false);
      initiated.current = false;
    }
  };

  const loadPayPalSDK = (token) => {
    // Reuse an already-loaded SDK instead of appending a second script tag
    if (window.paypal) {
      renderButtons(token);
      return;
    }
    const existing = document.getElementById('paypal-sdk-script');
    if (existing) { existing.onload = () => renderButtons(token); return; }

    const script = document.createElement('script');
    script.id  = 'paypal-sdk-script';
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
    script.dataset.sdkIntegrationSource = 'button-factory';
    script.async = true;
    script.onload = () => renderButtons(token);
    script.onerror = () => {
      setErr('Failed to load PayPal. Please refresh and try again.');
      setLoading(false);
    };
    document.body.appendChild(script);
  };

  const renderButtons = (token) => {
    setLoading(false);
    const containerId = `paypal-button-container-${PAYPAL_PLAN_ID}`;
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';

    window.paypal.Buttons({
      style: { shape: 'rect', color: 'blue', layout: 'vertical', label: 'subscribe' },
      createSubscription: (_data, actions) =>
        actions.subscription.create({ plan_id: PAYPAL_PLAN_ID, custom_id: token }),
      onApprove: () => onNext(),
      onError: () => setErr('PayPal checkout encountered an error. Please try again.'),
    }).render(`#${containerId}`);
  };

  const containerId = `paypal-button-container-${PAYPAL_PLAN_ID}`;

  return (
    <>
      <h1 className={s.wizard__title}>Start your free trial</h1>
      <p className={s.wizard__subtitle}>7 days free, then <strong>$35.50 USD/month</strong>. Cancel anytime.</p>
      <div style={{ padding: '24px', textAlign: 'center', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          ICSS Booking Management — Monthly Plan
        </p>
        {/* PayPal Smart Buttons mount here once SDK loads */}
        <div id={containerId} style={{ marginTop: 8 }} />
        {!signupToken && (
          <button
            className={`${s.btn} ${s['btn--primary']}`}
            onClick={startSubscription}
            disabled={loading}
            style={{ width: '100%', marginTop: 12 }}
          >
            {loading ? 'Connecting to PayPal…' : '🅿️ Proceed to Payment'}
          </button>
        )}
      </div>
      {err && <p className={s.wizard__error}>{err}</p>}
    </>
  );
}

// ── Step 3: Success ──────────────────────────────────────────────────────────
function StepSuccess({ navigate }) {
  useEffect(() => {
    const t = setTimeout(() => navigate('/provisioning'), 2000);
    return () => clearTimeout(t);
  }, [navigate]);
  return (
    <div style={{ textAlign: 'center' }}>
      <div className={s['wizard__success-icon']}>🎉</div>
      <h1 className={s.wizard__title}>You're in!</h1>
      <p className={s.wizard__subtitle}>We're building your booking platform in the background. This takes about 10 seconds.</p>
    </div>
  );
}

// ── Main Wizard Shell ────────────────────────────────────────────────────────
const PERSIST_KEY = 'icss_onboarding';

// Fields safe to persist across refreshes (password is explicitly excluded)
const SAFE_FIELDS = ['businessName', 'ownerName', 'email', 'themeId', 'themeName'];

export default function OnboardingWizard() {
  const navigate = useNavigate();

  const [step, setStep] = useState(() => {
    try {
      const saved = localStorage.getItem(PERSIST_KEY);
      return saved ? (JSON.parse(saved).step ?? 0) : 0;
    } catch { return 0; }
  });

  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(PERSIST_KEY);
      const parsed = saved ? JSON.parse(saved).data : {};
      return {
        businessName: parsed.businessName || '',
        ownerName:    parsed.ownerName    || '',
        email:        parsed.email        || '',
        password:     '', // Never restored from storage
        themeId:      parsed.themeId      || '',
        themeName:    parsed.themeName    || '',
      };
    } catch {
      return { businessName: '', ownerName: '', email: '', password: '', themeId: '', themeName: '' };
    }
  });

  // Persist only safe fields — password is never written
  useEffect(() => {
    const safeSave = Object.fromEntries(SAFE_FIELDS.map(k => [k, data[k]]));
    localStorage.setItem(PERSIST_KEY, JSON.stringify({ step, data: safeSave }));
  }, [step, data]);

  // Receive theme choice coming back from ThemeSelector
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const themeId   = params.get('theme_id');
    const themeName = params.get('theme_name');
    if (themeId) {
      setData(d => ({ ...d, themeId, themeName: decodeURIComponent(themeName || '') }));
      setStep(1);
    }
  }, []);

  const onChange = (key, value) => setData(d => ({ ...d, [key]: value }));
  const onNext   = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const onBack   = () => setStep(s => Math.max(s - 1, 0));

  const renderStep = () => {
    switch (step) {
      case 0: return <StepBasics  data={data} onChange={onChange} onNext={onNext} />;
      case 1: return <StepTheme   data={data} onNext={onNext} onBack={onBack} navigate={navigate} />;
      case 2: return <StepPayPal  data={data} onNext={onNext} />;
      case 3: return <StepSuccess navigate={navigate} />;
      default: return null;
    }
  };

  return (
    <div className={s.wizard}>
      <div className={s.wizard__card}>
        <div className={s.wizard__logo} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/favicon.png" alt="ICSS Icon" style={{ width: '42px', height: '42px', borderRadius: '12px', objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontFamily: '"Clash Display", sans-serif', fontWeight: 700, fontSize: '1.5rem', background: 'linear-gradient(135deg, #ffffff, #a5b4fc)', WebkitBackgroundClip: 'text', color: 'transparent', lineHeight: 1 }}>ICSS</span>
            <span style={{ fontSize: '0.55rem', letterSpacing: '1.5px', color: '#a1a1aa', fontWeight: 600, lineHeight: 1, marginTop: '2px' }}>BOOKING MANAGEMENT</span>
          </div>
        </div>
        <StepDots current={step} />
        {renderStep()}
      </div>
    </div>
  );
}
