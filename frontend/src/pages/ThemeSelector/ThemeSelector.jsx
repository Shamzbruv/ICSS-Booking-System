// src/pages/ThemeSelector/ThemeSelector.jsx
// Theme grid with live iFrame preview. Communicates chosen theme back to onboarding.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import s from './ThemeSelector.module.css';

export default function ThemeSelector() {
  const navigate = useNavigate();
  const [themes, setThemes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    api.themes().then(d => {
      setThemes(d.themes || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const categories = ['All', ...new Set(themes.map(t => t.category))];
  const visible = filter === 'All' ? themes : themes.filter(t => t.category === filter);

  const confirmTheme = () => {
    if (!selected) return;
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    if (from === 'onboarding') {
      navigate(`/onboarding?theme_id=${selected.id}&theme_name=${encodeURIComponent(selected.name)}`);
    } else {
      navigate('/editor');
    }
  };

  return (
    <div className={s.page}>
      {/* Sidebar */}
      <aside className={s.sidebar}>
        <div className={s.sidebar__logo} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/favicon.png" alt="ICSS Icon" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontFamily: '"Clash Display", sans-serif', fontWeight: 700, fontSize: '1.2rem', background: 'linear-gradient(135deg, #ffffff, #a5b4fc)', WebkitBackgroundClip: 'text', color: 'transparent', lineHeight: 1 }}>ICSS</span>
            <span style={{ fontSize: '0.45rem', letterSpacing: '1px', color: '#8888aa', fontWeight: 600, lineHeight: 1, marginTop: '2px' }}>BOOKING MANAGEMENT</span>
          </div>
        </div>
        <div className={s.sidebar__filters}>
          {categories.map(c => (
            <button key={c} className={`${s.filter} ${filter === c ? s['filter--active'] : ''}`}
              onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
        <div className={s.sidebar__info}>
          <p>Can't find what you need?</p>
          <button className={s.customBtn} onClick={() => navigate('/custom-theme')}>
            Request Custom Theme →
          </button>
        </div>
      </aside>

      {/* Theme Grid */}
      <main className={s.main}>
        <div className={s.header}>
          <h1 className={s.header__title}>Choose your starter theme</h1>
          <p className={s.header__sub}>All themes are fully customisable in the editor.</p>
        </div>

        {loading ? (
          <div className={s.loading}>Loading themes…</div>
        ) : (
          <div className={s.grid}>
            {visible.map(t => (
              <div key={t.id}
                className={`${s.card} ${selected?.id === t.id ? s['card--selected'] : ''}`}
                onClick={() => { setSelected(t); setPreview(t.template_path); }}
              >
                <div className={s.card__preview}>
                  {t.preview_image_url ? (
                    <img src={t.preview_image_url} alt={t.name} />
                  ) : t.template_path ? (
                    <div style={{ position: 'relative', overflow: 'hidden', background: '#fff', width: '100%', height: '100%' }}>
                      <iframe
                        src={t.template_path}
                        title={t.name}
                        style={{
                          position: 'absolute', top: 0, left: 0,
                          width: '400%', height: '400%',
                          transform: 'scale(0.25)', transformOrigin: 'top left',
                          border: 'none', pointerEvents: 'none'
                        }}
                        tabIndex={-1}
                        loading="lazy"
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.01)', zIndex: 10 }} />
                    </div>
                  ) : (
                    <div className={s.card__placeholder}>{t.category}</div>
                  )}
                  {selected?.id === t.id && <div className={s.card__badge}>✓ Selected</div>}
                </div>
                <div className={s.card__body}>
                  <strong className={s.card__name}>{t.name}</strong>
                  <span className={s.card__cat}>{t.category}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Preview Panel */}
      {preview && (
        <div className={s.previewPanel}>
          <div className={s.previewPanel__header}>
            <span>Live Preview — {selected?.name}</span>
            <button className={s.previewPanel__close} onClick={() => setPreview(null)}>✕</button>
          </div>
          <div className={s.previewPanel__device}>
            <div className={s.deviceToggle}>
              <button onClick={() => document.getElementById('previewFrame').style.width = '100%'}>🖥 Desktop</button>
              <button onClick={() => document.getElementById('previewFrame').style.width = '390px'}>📱 Mobile</button>
            </div>
            <iframe id="previewFrame" src={preview} title="Theme Preview"
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff', borderRadius: 8 }} />
          </div>
          <div className={s.previewPanel__actions}>
            <button className={s.btnGhost} onClick={() => setPreview(null)}>Back to Grid</button>
            <button className={s.btnPrimary} onClick={confirmTheme}>Use This Theme →</button>
          </div>
        </div>
      )}
    </div>
  );
}
