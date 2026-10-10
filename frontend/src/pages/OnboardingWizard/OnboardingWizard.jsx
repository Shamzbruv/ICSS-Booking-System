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
//   2 → PayPal Subscription Checkout ($31.67/mo — 7-day free trial)
//   3 → Success / Provisioning Wait

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './OnboardingWizard.module.css';
import { api } from '../../api';


// PayPal plan config — read from Vite env so changes don't require code edits
const PAYPAL_PLAN_ID   = import.meta.env.VITE_PAYPAL_PLAN_ID   || 'P-4EC410252Y479773KNHUVB4A';
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';
const MONTHLY_PRICE_USD = Number(import.meta.env.VITE_PAYPAL_MONTHLY_PRICE_USD || 31.67).toFixed(2);
const TERMS_VERSION = '2026-05-05';
const TERMS_URL = '/terms';

const TOTAL_STEPS = 3;

function StepDots({ current }) {
  return (
    <div className={s.wizard__steps} aria-hidden="true">
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
    if (!data.businessName.trim() || !data.ownerName.trim() || !data.email.trim() || !pw) {
      return setErr('All fields are required.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return setErr('Enter a valid email address.');
    if (pw.length < 8) return setErr('Password must be at least 8 characters.');
    if (!data.termsAccepted) return setErr('You must accept the Terms & Conditions before continuing.');
    setErr('');
    // Store password into data only in memory, never in localStorage
    onChange('password', pw);
    onNext();
  };

  return (
    <>
      <h1 className={s.wizard__title}>Start your free trial</h1>
      <p className={s.wizard__subtitle}>7 days free, then {'$'}{MONTHLY_PRICE_USD} USD/month. Cancel anytime.</p>
      <div className={s.wizard__field}>
        <label className={s.wizard__label} htmlFor="business-name">Business Name</label>
        <input id="business-name" autoComplete="organization" required value={data.businessName} onChange={e => onChange('businessName', e.target.value)} placeholder="e.g. Luxe Hair Studio" />
      </div>
      <div className={s.wizard__field}>
        <label className={s.wizard__label} htmlFor="owner-name">Your Full Name</label>
        <input id="owner-name" autoComplete="name" required value={data.ownerName} onChange={e => onChange('ownerName', e.target.value)} placeholder="e.g. Jordan Clarke" />
      </div>
      <div className={s.wizard__field}>
        <label className={s.wizard__label} htmlFor="email">Email Address</label>
        <input type="email" id="email" autoComplete="email" required value={data.email} onChange={e => onChange('email', e.target.value)} placeholder="you@example.com" />
      </div>
      <div className={s.wizard__field}>
        <label className={s.wizard__label} htmlFor="password">Password</label>
        {/* Uncontrolled input — value never enters state or localStorage */}
        <input
          type="password" id="password" autoComplete="new-password" minLength={8} required
          placeholder="Min 8 characters"
          onChange={e => { passwordRef.current = e.target.value; }}
        />
      </div>
      <label className={s.wizard__consent}>
        <input
          type="checkbox"
          checked={Boolean(data.termsAccepted)}
          onChange={e => onChange('termsAccepted', e.target.checked)}
        />
        <span>
          I have read and accept the <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a> before creating my account.
        </span>
      </label>
      <p className={s.wizard__hint}>The full terms open in a new tab so you can review them before continuing.</p>
      {err && <p role="alert" className={s.wizard__error}>{err}</p>}
      <div className={s.wizard__actions}>
        <button className={`${s.btn} ${s['btn--primary']}`} onClick={submit} disabled={!data.termsAccepted}>Continue →</button>
      </div>
    </>
  );
}

// ── Step 1: Theme Selection (delegates to ThemeSelector page) ────────────────
function StepTheme({ data, onChange, onNext, onBack }) {
  const [themes,setThemes] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const loadThemes = () => { setLoading(true); setError(''); api.themes().then(result=>setThemes(result.themes||[])).catch(()=>setError('We could not load the themes. Please try again.')).finally(()=>setLoading(false)); };
  useEffect(loadThemes,[]);
  return (
    <>
      <h1 className={s.wizard__title}>Pick your starter theme</h1>
      <p className={s.wizard__subtitle}>Your theme defines your public booking page style. You can customise it fully in the editor.</p>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:16 }}>
        {loading&&<p role="status">Loading themes…</p>}
        {error&&<div role="alert"><p>{error}</p><button type="button" className={`${s.btn} ${s['btn--ghost']}`} onClick={loadThemes}>Try again</button></div>}
        {!loading&&!error&&themes.length===0&&<p>No themes are available yet. Please contact support for help.</p>}
        {themes.map(theme=><button type="button" key={theme.id} aria-pressed={data.themeId===theme.id} onClick={()=>{onChange('themeId',theme.id);onChange('themeName',theme.name)}} style={{padding:14,textAlign:'left',borderRadius:10,border:data.themeId===theme.id?'2px solid #7c6ef7':'1px solid var(--color-border)',background:'var(--color-surface-2)',color:'inherit',cursor:'pointer'}}><strong>{theme.name}</strong><br/><small>{theme.category}</small></button>)}
      </div>
      <div className={s.wizard__actions}>
        <button className={`${s.btn} ${s['btn--ghost']}`} onClick={onBack}>← Back</button>
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

    if (!data.termsAccepted) {
      setErr('You must accept the Terms & Conditions before continuing.');
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
        plan_id:          'starter',
        terms_accepted:   Boolean(data.termsAccepted),
        terms_version:    TERMS_VERSION,
      });
      setSignupToken(res.signup_token);
      localStorage.setItem('icss_signup_token', res.signup_token);
      localStorage.setItem('icss_signup_email', data.email);
      loadPayPalSDK(res.signup_token, {
        planId: res.paypal_plan_id || PAYPAL_PLAN_ID,
        clientId: res.paypal_client_id || PAYPAL_CLIENT_ID,
      });
    } catch (e) {
      setErr(e.message);
      setLoading(false);
      initiated.current = false;
    }
  };

  const loadPayPalSDK = (token, config) => {
    const clientId = config?.clientId || PAYPAL_CLIENT_ID;
    const planId = config?.planId || PAYPAL_PLAN_ID;

    // Reuse an already-loaded SDK instead of appending a second script tag
    const existing = document.getElementById('paypal-sdk-script');
    if (window.paypal && existing?.dataset.clientId === clientId) {
      renderButtons(token, planId);
      return;
    }
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id  = 'paypal-sdk-script';
    script.dataset.clientId = clientId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription`;
    script.dataset.sdkIntegrationSource = 'button-factory';
    script.async = true;
    script.onload = () => renderButtons(token, planId);
    script.onerror = () => {
      setErr('Failed to load PayPal. Please refresh and try again.');
      setLoading(false);
    };
    document.body.appendChild(script);
  };

  const renderButtons = (token, planId) => {
    setLoading(false);
    const containerId = 'paypal-button-container';
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';

    window.paypal.Buttons({
      style: { shape: 'rect', color: 'blue', layout: 'vertical', label: 'subscribe' },
      createSubscription: (_data, actions) =>
        actions.subscription.create({ plan_id: planId, custom_id: token }),
      onApprove: async (authData) => {
        try {
          await api.approvePayPalSubscription({
            signup_token: token,
            subscription_id: authData.subscriptionID
          });
        } catch (e) {
          console.warn('Manual provisioning trigger failed, relying on webhook.', e);
        }
        onNext();
      },
      onError: () => setErr('PayPal checkout encountered an error. Please try again.'),
    }).render(`#${containerId}`);
  };

  const containerId = 'paypal-button-container';

  return (
    <>
      <h1 className={s.wizard__title}>Start your free trial</h1>
      <p className={s.wizard__subtitle}>7 days free, then <strong>{'$'}{MONTHLY_PRICE_USD} USD/month</strong>. Cancel anytime.</p>
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
        <p className={s.wizard__hint} style={{ marginTop: 12 }}>
          By continuing with checkout, you confirm your acceptance of the <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a>.
        </p>
      </div>
      {err && <p role="alert" className={s.wizard__error}>{err}</p>}
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
const SAFE_FIELDS = ['businessName', 'ownerName', 'email', 'themeId', 'themeName', 'termsAccepted'];

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
        termsAccepted: Boolean(parsed.termsAccepted),
      };
    } catch {
      return { businessName: '', ownerName: '', email: '', password: '', themeId: '', themeName: '', termsAccepted: false };
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
      case 1: return <StepTheme data={data} onChange={onChange} onNext={onNext} onBack={onBack} />;
      case 2: return <StepPayPal  data={data} onNext={onNext} />;
      case 3: return <StepSuccess navigate={navigate} />;
      default: return null;
    }
  };

  return (
    <div className={s.wizard}>
      <nav className={s.wizard__nav} aria-label="Signup navigation"><a href="/">← Back to home</a><a href="/admin/login.html">Already a member? Sign in</a></nav>
      <div className={s.wizard__card}>
        <a href="/" className={s.wizard__logo} aria-label="ICSS Bookings home">
          <img src="/favicon.png" alt="" />
          <div className={s.wizard__brand}><strong>ICSS Bookings</strong><span>BY ICREATE SOLUTIONS &amp; SERVICES</span></div>
        </a>
        <StepDots current={step} />
        <p className={s['wizard__step-label']} role="status">{step < TOTAL_STEPS ? `Step ${step + 1} of 3 · ${['Your business', 'Your booking page', 'Your subscription'][step]}` : 'Setup complete'}</p>
        {renderStep()}
      </div>
      <p className={s.wizard__footer}>Built in Jamaica. Here to help.<br /><a href="https://wa.me/18765857469">Chat on WhatsApp</a> · <a href="mailto:icreatesolutions.ja@gmail.com">Email support</a></p>
    </div>
  );
}
