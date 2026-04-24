// components/ui/Modal.jsx — Premium modal / bottom-sheet
// On mobile: slides up as a bottom sheet
// On desktop: centered dialog with backdrop
import { useEffect, useRef } from 'react';
import styles from './Modal.module.css';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',       // 'sm' | 'md' | 'lg' | 'full'
  footer,
  closeOnBackdrop = true,
}) {
  const dialogRef = useRef(null);

  // Trap focus inside modal when open
  useEffect(() => {
    if (!isOpen) return;
    const el = dialogRef.current;
    if (!el) return;

    // Lock body scroll
    document.body.classList.add('modal-open');

    // Focus first focusable element
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();

    // Trap focus
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const esc = (e) => { if (e.key === 'Escape') onClose(); };

    el.addEventListener('keydown', trap);
    el.addEventListener('keydown', esc);
    return () => {
      el.removeEventListener('keydown', trap);
      el.removeEventListener('keydown', esc);
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={closeOnBackdrop ? (e => { if (e.target === e.currentTarget) onClose(); }) : undefined}
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div
        ref={dialogRef}
        className={`${styles.panel} ${styles[size]}`}
        tabIndex={-1}
      >
        {/* Header */}
        <div className={styles.header}>
          {title && <h2 id="modal-title" className={styles.title}>{title}</h2>}
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>{children}</div>

        {/* Footer */}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
