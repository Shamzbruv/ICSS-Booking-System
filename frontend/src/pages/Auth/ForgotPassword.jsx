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
            type="email" aria-label="Email address" autoComplete="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="text" aria-label="Business handle"
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
    minHeight: '100dvh',
    padding: '24px 16px',
    color: '#201a2d',
    colorScheme: 'light',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f5fa',
    backgroundImage: 'radial-gradient(ellipse at 50% 10%, rgba(124,110,247,0.1) 0%, transparent 80%)',
    fontFamily: "'Inter', sans-serif"
  },
  card: {
    background: '#ffffff',
    border: '1px solid #dfd9e9',
    borderRadius: '16px',
    padding: 'clamp(24px, 5vw, 36px)',
    width: '100%',
    maxWidth: '420px',
    textAlign: 'center',
    boxSizing: 'border-box'
  },
  title: {
    margin: '0 0 10px',
    color: '#201a2d',
    fontSize: '24px',
    fontWeight: '700'
  },
  subtitle: {
    margin: '0 0 24px',
    color: '#625c70',
    fontSize: '14px',
    lineHeight: '1.5'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  helper: {
    color: '#625c70',
    fontSize: '12px',
    lineHeight: '1.45',
    margin: '-6px 0 0',
    textAlign: 'left'
  },
  input: {
    background: '#fff',
    border: '1px solid #dfd9e9',
    borderRadius: '10px',
    padding: '12px 16px',
    color: '#201a2d',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  button: {
    background: '#6d28d9',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  successMessage: {
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#166534',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    textAlign: 'left'
  },
  errorMessage: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#b42318',
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
    color: '#6d28d9',
    textDecoration: 'none'
  }
};
