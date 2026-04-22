import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './ProvisioningWait.module.css';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60; // 2 minutes before giving up

export default function ProvisioningWait() {
  const navigate = useNavigate();
  const [dots, setDots]   = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);

    const signupToken = localStorage.getItem('icss_signup_token');
    if (!signupToken) {
      setError('No pending signup found. Please restart the onboarding flow.');
      clearInterval(dotInterval);
      return;
    }

    let attempts = 0;

    const pollInterval = setInterval(async () => {
      attempts++;

      try {
        const res = await fetch(`/api/v1/public/provisioning-status/${signupToken}`);

        if (!res.ok) return; // Keep polling on transient server errors

        const data = await res.json();

        if (data.status === 'provisioned' && data.tenant_slug) {
          clearInterval(pollInterval);
          clearInterval(dotInterval);

          // Store slug so the editor can use it immediately without waiting for api.me()
          localStorage.setItem('icss_tenant_slug', data.tenant_slug);
          // Clean up provisioning tokens — they are single-use
          localStorage.removeItem('icss_signup_token');
          localStorage.removeItem('icss_onboarding');

          // Navigate into the editor — EditorCanvas.jsx already reads icss_tenant_slug
          // via api.me() which returns the tenant context from the JWT
          navigate('/editor');

        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          clearInterval(dotInterval);
          setError('Provisioning failed. Please contact support@icssbookings.com.');

        } else if (attempts >= MAX_POLL_ATTEMPTS) {
          clearInterval(pollInterval);
          clearInterval(dotInterval);
          setError('Setup is taking longer than expected. Please check back in a few minutes or contact support.');
        }
      } catch {
        // Network error — keep polling silently
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(dotInterval);
      clearInterval(pollInterval);
    };
  }, [navigate]);

  return (
    <div className={s.page}>
      <div className={s.card}>
        {error ? (
          <>
            <h1 className={s.title} style={{ color: '#ff4b4b' }}>Setup Encountered a Problem</h1>
            <p className={s.subtitle} style={{ color: '#ff4b4b' }}>{error}</p>
          </>
        ) : (
          <>
            <div className={s.spinner}></div>
            <h1 className={s.title}>Building your platform{dots}</h1>
            <p className={s.subtitle}>
              We are securing your database, configuring your selected theme, and setting up
              your booking system. This usually takes under 30 seconds.
            </p>
          </>
        )}

        <div className={s.progressList}>
          <div className={s.item}>✓ Creating secure tenant boundary</div>
          <div className={s.item}>✓ Initialising double-entry ledger</div>
          <div className={s.item}>⚙ Applying custom theme</div>
        </div>
      </div>
    </div>
  );
}
