// src/pages/OnboardingWizard/OnboardingWizard.jsx
//
// Multi-step onboarding. Persists progress to localStorage so the user
// can safely close the tab and return exactly where they left off.
//
// Steps:
//   0 → Business Basics (name, owner, email, password)
//   1 → Choose Plan
//   2 → Choose Theme (redirects to ThemeSelector page)
//   3 → PayPal Subscription Checkout
//   4 → Success / Provisioning Wait

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './OnboardingWizard.module.css';
import { api } from '../../api';

const PLANS = [
  { id: 'starter',    label: 'Starter',    price: 'Free', tagline: 'Up to 50 bookings/mo' },
  { id: 'pro',        label: 'Pro',         price: '$49/mo', tagline: '500 bookings + branding' },
  { id: 'enterprise', label: 'Enterprise',  price: '$199/mo', tagline: 'Unlimited + API access' },
];

const TOTAL_STEPS = 4;

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
  const submit = () => {
    if (!data.businessName || !data.ownerName || !data.email || !data.password) {
      return setErr('All fields are required.');
    }
    if (data.password.length < 8) return setErr('Password must be at least 8 characters.');
    setErr('');
    onNext();
  };
  return (
    <>
      <h1 className={s.wizard__title}>Start your free trial</h1>
      <p className={s.wizard__subtitle}>No credit card required. 7 days free on any plan.</p>
      <div className={s.wizard__field}>
        <label className={s.wizard__label}>Business Name</label>
        <input value={data.businessName} onChange={e => onChange('businessName', e.target.value)} placeholder="e.g. Luxe Hair Studio" />
      </div>
      <div className={s.wizard__field}>
        <label className={s.wizard__label}>Your Name</label>
        <input value={data.ownerName} onChange={e => onChange('ownerName', e.target.value)} placeholder="e.g. Jordan Clarke" />
      </div>
      <div className={s.wizard__field}>
        <label className={s.wizard__label}>Email Address</label>
        <input type="email" value={data.email} onChange={e => onChange('email', e.target.value)} placeholder="you@example.com" />
      </div>
      <div className={s.wizard__field}>
        <label className={s.wizard__label}>Password</label>
        <input type="password" value={data.password} onChange={e => onChange('password', e.target.value)} placeholder="Min 8 characters" />
      </div>
      {err && <p className={s.wizard__error}>{err}</p>}
      <div className={s.wizard__actions}>
        <button className={`${s.btn} ${s['btn--primary']}`} onClick={submit}>Continue →</button>
      </div>
    </>
  );
}

// ── Step 1: Plan Selection ───────────────────────────────────────────────────
function StepPlan({ data, onChange, onNext, onBack }) {
  return (
    <>
      <h1 className={s.wizard__title}>Choose your plan</h1>
      <p className={s.wizard__subtitle}>You can upgrade or downgrade at any time.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLANS.map(p => (
          <label key={p.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderRadius: 'var(--radius-md)',
            border: `1px solid ${data.planId === p.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: data.planId === p.id ? 'rgba(124,110,247,0.08)' : 'var(--color-surface-2)',
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}>
            <span>
              <input type="radio" name="plan" value={p.id} checked={data.planId === p.id}
                onChange={() => onChange('planId', p.id)} style={{ display: 'none' }} />
              <strong style={{ display: 'block', marginBottom: 2 }}>{p.label}</strong>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{p.tagline}</span>
            </span>
            <span style={{ fontWeight: 700, color: data.planId === p.id ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
              {p.price}
            </span>
          </label>
        ))}
      </div>
      <div className={s.wizard__actions}>
        <button className={`${s.btn} ${s['btn--ghost']}`} onClick={onBack}>← Back</button>
        <button className={`${s.btn} ${s['btn--primary']}`} onClick={onNext} disabled={!data.planId}>Choose Theme →</button>
      </div>
    </>
  );
}

// ── Step 2: Theme Selection (delegates to ThemeSelector page) ────────────────
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

// ── Step 3: PayPal Checkout ──────────────────────────────────────────────────
function StepPayPal({ data, onNext }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [signupToken, setSignupToken] = useState(null);

  const startSubscription = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await api.createPendingSignup({
        tenant_name:     data.businessName,
        admin_email:     data.email,
        admin_password:  data.password,
        theme_id:        data.themeId || null,
        plan_id:         data.planId,
      });
      setSignupToken(res.signup_token);
      localStorage.setItem('icss_signup_token', res.signup_token);
      // In production: load PayPal JS SDK and call paypal.Buttons() here.
      // For now, simulate a successful subscription initiation for development.
      setTimeout(() => onNext(), 1500);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className={s.wizard__title}>Start your free trial</h1>
      <p className={s.wizard__subtitle}>Your 7-day trial begins now. You will only be billed after it ends.</p>
      <div style={{ padding: '24px', textAlign: 'center', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Plan: <strong style={{ color: 'var(--color-text)' }}>{data.planId}</strong>
        </p>
        {/* PayPal Smart Buttons mount here in production */}
        <div id="paypal-button-container" />
        <button className={`${s.btn} ${s['btn--primary']}`} onClick={startSubscription} disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Connecting to PayPal…' : '🅿️ Activate Trial with PayPal'}
        </button>
      </div>
      {err && <p className={s.wizard__error}>{err}</p>}
    </>
  );
}

// ── Step 4: Success ──────────────────────────────────────────────────────────
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

export default function OnboardingWizard() {
  const navigate = useNavigate();

  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem(PERSIST_KEY);
    return saved ? JSON.parse(saved).step ?? 0 : 0;
  });

  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(PERSIST_KEY);
    return saved ? JSON.parse(saved).data : {
      businessName: '', ownerName: '', email: '', password: '',
      planId: 'pro', themeId: '', themeName: '',
    };
  });

  // Persist progress across sessions
  useEffect(() => {
    // Don't persist password in plaintext beyond step 0
    const safeSave = { ...data, password: data.password ? '***' : '' };
    localStorage.setItem(PERSIST_KEY, JSON.stringify({ step, data: safeSave }));
  }, [step, data]);

  // Receive theme choice coming back from ThemeSelector
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const themeId = params.get('theme_id');
    const themeName = params.get('theme_name');
    if (themeId) {
      setData(d => ({ ...d, themeId, themeName: decodeURIComponent(themeName || '') }));
      setStep(2);
    }
  }, []);

  const onChange = (key, value) => setData(d => ({ ...d, [key]: value }));
  const onNext = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const onBack = () => setStep(s => Math.max(s - 1, 0));

  const renderStep = () => {
    switch (step) {
      case 0: return <StepBasics data={data} onChange={onChange} onNext={onNext} />;
      case 1: return <StepPlan data={data} onChange={onChange} onNext={onNext} onBack={onBack} />;
      case 2: return <StepTheme data={data} onNext={onNext} onBack={onBack} navigate={navigate} />;
      case 3: return <StepPayPal data={data} onNext={onNext} />;
      case 4: return <StepSuccess navigate={navigate} />;
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
