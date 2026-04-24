// components/ui/ConfirmDialog.jsx — Replaces window.confirm() everywhere
// Usage: <ConfirmDialog isOpen={open} onConfirm={handleDelete} onCancel={() => setOpen(false)}
//          title="Delete booking?" message="This cannot be undone." variant="danger" />
import Modal from './Modal';
import styles from './ConfirmDialog.module.css';

const VARIANT_ICONS = {
  danger:  '🗑️',
  warning: '⚠️',
  info:    'ℹ️',
};

export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'danger',   // 'danger' | 'warning' | 'info'
  loading      = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title=""
      size="sm"
      closeOnBackdrop={!loading}
      footer={
        <>
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className={`${styles.confirmBtn} ${styles[variant]}`}
            onClick={onConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? <span className={styles.spinner} /> : confirmLabel}
          </button>
        </>
      }
    >
      <div className={styles.content}>
        <div className={`${styles.iconWrap} ${styles[variant]}`}>
          {VARIANT_ICONS[variant]}
        </div>
        <h3 className={styles.title}>{title}</h3>
        {message && <p className={styles.message}>{message}</p>}
      </div>
    </Modal>
  );
}
