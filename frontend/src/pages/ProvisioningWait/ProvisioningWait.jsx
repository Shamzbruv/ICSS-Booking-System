import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './ProvisioningWait.module.css';

export default function ProvisioningWait() {
  const navigate = useNavigate();
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);

    // Simulate polling the backend to wait for pg-boss provisioning to finish.
    // In production, we would poll /api/v1/auth/me or a status endpoint.
    const timeout = setTimeout(() => {
      navigate('/editor'); // When done, push directly into the React Editor
    }, 4000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={s.spinner}></div>
        <h1 className={s.title}>Building your platform{dots}</h1>
        <p className={s.subtitle}>We are securing your database, configuring your selected theme, and setting up your Stripe & PayPal connections.</p>
        
        <div className={s.progressList}>
          <div className={s.item}>✓ Creating secure tenant boundary</div>
          <div className={s.item}>✓ Initialising double-entry ledger</div>
          <div className={s.item}>⚙ Applying custom theme</div>
        </div>
      </div>
    </div>
  );
}
