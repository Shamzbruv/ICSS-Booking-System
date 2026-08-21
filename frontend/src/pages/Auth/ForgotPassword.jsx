import { useState } from 'react';
import { api } from '../../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await api.forgotPassword(email, tenantSlug);
      setMessage(res.message);
    } catch (err) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Reset Password</h2>
        <p style={styles.subtitle}>Enter your tenant email address and we'll send you a secure reset link.</p>
        
        {message && <div style={styles.successMessage}>{message}</div>}
        {error && <div style={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="text"
            placeholder="Business handle (recommended)"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            autoComplete="organization"
            style={styles.input}
          />
          <p style={styles.helper}>Use the handle from your public booking link. It is required when the same email manages more than one business.</p>
          <button type="submit" disabled={loading || message} style={styles.button}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        <div style={styles.footer}>
          <a href="/admin/login.html" style={styles.link}>Return to Login</a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#08090e',
    backgroundImage: 'radial-gradient(ellipse at 50% 10%, rgba(124,110,247,0.1) 0%, transparent 80%)',
    fontFamily: "'Inter', sans-serif"
  },
  card: {
    background: '#111218',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    textAlign: 'center',
    boxSizing: 'border-box'
  },
  title: {
    margin: '0 0 10px',
    color: '#e4e4f0',
    fontSize: '24px',
    fontWeight: '700'
  },
  subtitle: {
    margin: '0 0 24px',
    color: '#71717a',
    fontSize: '14px',
    lineHeight: '1.5'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  helper: {
    color: '#a1a1aa',
    fontSize: '12px',
    lineHeight: '1.45',
    margin: '-6px 0 0',
    textAlign: 'left'
  },
  input: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '12px 16px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  button: {
    background: '#7c6ef7',
    color: '#fff',
    border: 'none',
    borderRadius: '30px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  successMessage: {
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#4ade80',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    textAlign: 'left'
  },
  errorMessage: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    textAlign: 'left'
  },
  footer: {
    marginTop: '24px',
    fontSize: '14px'
  },
  link: {
    color: '#7c6ef7',
    textDecoration: 'none'
  }
};
