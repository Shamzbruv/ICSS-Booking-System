// components/ui/EmptyState.jsx — Unified empty state across all lists/tables
import styles from './EmptyState.module.css';

export default function EmptyState({ icon = '📭', title = 'Nothing here yet', description, action }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon} aria-hidden="true">{icon}</div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
