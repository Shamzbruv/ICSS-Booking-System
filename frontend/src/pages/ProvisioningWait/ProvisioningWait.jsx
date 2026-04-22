import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './ProvisioningWait.module.css';

export default function ProvisioningWait() {
  const navigate = useNavigate();
  const [dots, setDots] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);

    const signupToken = localStorage.getItem('icss_signup_token');
    if (!signupToken) {
      setError('No pending signup found.');
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/public/provisioning-status/${signupToken}`);
        if (!res.ok) return; // Keep polling on transient errors
        const data = await res.json();
        
        if (data.status === 'provisioned' && data.tenant_slug) {
            clearInterval(pollInterval);
            clearInterval(interval);
            // Store slug for the editor to pick up, then redirect to the tenant dashboard
            localStorage.setItem('icss_tenant_slug', data.tenant_slug);
            localStorage.removeItem('icss_signup_token');
            navigate('/editor');
        } else if (data.status === 'failed') {
            clearInterval(pollInterval);
            clearInterval(interval);
            setError('Provisioning failed. Please contact support.');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
    };
  }, [navigate]);

  return (
    <div className={s.page}>
      <div className={s.card}>
        {error ? (
            <h1 className={s.title} style={{ color: '#ff4b4b' }}>Provisioning Failed</h1>
        ) : (
            <>
                <div className={s.spinner}></div>
                <h1 className={s.title}>Building your platform{dots}</h1>
            </>
        )}
        
        {error ? (
           <p className={s.subtitle} style={{ color: '#ff4b4b' }}>{error}</p>
        ) : (
           <p className={s.subtitle}>We are securing your database, configuring your selected theme, and setting up your connections.</p>
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
