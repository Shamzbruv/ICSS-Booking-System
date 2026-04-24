// components/ui/LoadingOverlay.jsx — Full-page or inline loading state
import styles from './LoadingOverlay.module.css';

export default function LoadingOverlay({ message = 'Loading…', inline = false }) {
  return (
    <div className={`${styles.overlay} ${inline ? styles.inline : ''}`} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true">
        <div /><div /><div />
      </div>
      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}
