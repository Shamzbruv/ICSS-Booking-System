/**
 * ImpersonationBanner — Sticky top bar shown during any impersonation session.
 * Owner's main session is unaffected.
 */

import { useState, useEffect } from 'react';
import { useConsole } from './ConsoleContext';
import s from './PlatformConsole.module.css';

export default function ImpersonationBanner() {
  const { impSession, isReadOnly, endImpersonation, elevateImpersonation } = useConsole();
  const [timeLeft, setTimeLeft]   = useState('');
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason]       = useState('');
  const [elevating, setElevating] = useState(false);

  useEffect(() => {
    if (!impSession) return;
    const tick = () => {
      const diff = new Date(impSession.expires_at) - Date.now();
      if (diff <= 0) { endImpersonation(); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [impSession]);

  if (!impSession) return null;

  const handleElevate = async () => {
    if (!reason.trim()) return;
    setElevating(true);
    try { await elevateImpersonation(reason); setShowModal(false); setReason(''); }
    catch (e) { alert(e.message); }
    finally { setElevating(false); }
  };

  return (
    <>
      <div className={`${s.impBanner} ${!isReadOnly ? s['impBanner--edit'] : ''}`}>
        <span className={s.impBanner__icon}>{isReadOnly ? '👁' : '✏️'}</span>
        <span className={s.impBanner__text}>
          {isReadOnly ? 'Viewing' : '⚠️ EDITING'} as{' '}
          <strong>{impSession.tenant?.name}</strong>
          {' '}— {isReadOnly ? 'Read-Only Mode' : 'Edit Mode Enabled'}
        </span>
        <span className={s.impBanner__timer}>⏱ {timeLeft}</span>
        {isReadOnly && (
          <button className={s.impBanner__btn} onClick={() => setShowModal(true)}>
            Enable Edit Mode
          </button>
        )}
        <button className={`${s.impBanner__btn} ${s['impBanner__btn--end']}`} onClick={endImpersonation}>
          End Session
        </button>
      </div>

      {showModal && (
        <div className={s.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h3 className={s.modal__title}>⚠️ Enable Edit Mode</h3>
            <p className={s.modal__sub}>
              You are about to gain write access to <strong>{impSession.tenant?.name}</strong>.
              Edit mode expires in 15 minutes. All actions will be logged.
            </p>
            <div className={s.formField}>
              <label>Reason for edit access *</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Fixing broken service config at client request..."
                rows={3}
              />
            </div>
            <div className={s.modal__actions}>
              <button className={s.btnGhost} onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className={`${s.btnPrimary} ${s['btnPrimary--danger']}`}
                onClick={handleElevate}
                disabled={elevating || !reason.trim()}
              >
                {elevating ? 'Enabling…' : 'Enable Edit Mode'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
