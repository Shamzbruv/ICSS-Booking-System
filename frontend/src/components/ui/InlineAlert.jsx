// components/ui/InlineAlert.jsx — Form-level alerts and validation messages
import styles from './InlineAlert.module.css';

export default function InlineAlert({ type = 'error', children, className = '' }) {
  if (!children) return null;
  const ICONS = { error: '✕', warning: '⚠', success: '✓', info: 'ℹ' };
  return (
    <div className={`${styles.alert} ${styles[type]} ${className}`} role="alert">
      <span className={styles.icon} aria-hidden="true">{ICONS[type]}</span>
      <span className={styles.text}>{children}</span>
    </div>
  );
}
