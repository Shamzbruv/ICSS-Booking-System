import { useState, useEffect } from 'react';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import s from './EditorCanvas.module.css';
import { api } from '../../api';

const { Responsive, WidthProvider } = ReactGridLayout;
const ResponsiveGridLayout = WidthProvider(Responsive);

// Default layout items with type and props
const DEFAULT_LAYOUT = [
  { i: 'header_1', type: 'header', x: 0, y: 0, w: 12, h: 2, static: false, minH: 2, maxH: 4, props: { text: 'Your Business Name', bgColor: '#111318', textColor: '#e8eaf0' } },
  { i: 'services_1', type: 'services', x: 0, y: 2, w: 8, h: 4, minW: 4, minH: 3, props: { showPrices: true, showDesc: true, cardColor: '#191c24' } },
  { i: 'calendar_1', type: 'calendar', x: 8, y: 2, w: 4, h: 4, minW: 3, minH: 4, props: { themeColor: '#7c6ef7' } },
];

export default function EditorCanvas() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);

  useEffect(() => {
    api.me().then(user => {
      if (user.tenant_slug) {
        setTenantSlug(user.tenant_slug);
        return api.getLayout(user.tenant_slug);
      }
    })
    .then(data => {
      if (data && data.layout && data.layout.length > 0) setLayout(data.layout);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  const onLayoutChange = (newLayout) => {
    // React-Grid-Layout's onLayoutChange only provides structural data (i, x, y, w, h).
    // We must merge it back with our custom fields (type, props).
    setLayout(prev => newLayout.map(item => {
      const existing = prev.find(p => p.i === item.i);
      return existing ? { ...existing, ...item } : item;
    }));
  };

  const onDrop = (currentLayout, layoutItem, e) => {
    const type = e.dataTransfer.getData('text/plain');
    if (!type) return;

    const id = `${type}_${Date.now()}`;
    let defaultProps = {};
    let minW = 2, minH = 2;

    if (type === 'header') {
      defaultProps = { text: 'New Header', bgColor: '#111318', textColor: '#e8eaf0' };
      minH = 2;
    } else if (type === 'services') {
      defaultProps = { showPrices: true, showDesc: true, cardColor: '#191c24' };
      minW = 4; minH = 3;
    } else if (type === 'calendar') {
      defaultProps = { themeColor: '#7c6ef7' };
      minW = 3; minH = 4;
    }

    const newItem = {
      ...layoutItem,
      i: id,
      type,
      props: defaultProps,
      minW, minH
    };

    setLayout(prev => [...prev, newItem]);
    setSelectedItemId(id);
  };

  const saveLayout = async () => {
    if (!tenantSlug) return;
    setSaving(true);
    try {
      await api.saveLayout(tenantSlug, { layout });
      alert('Layout saved successfully!');
    } catch (err) {
      alert('Failed to save layout: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedProp = (key, value) => {
    setLayout(prev => prev.map(item => {
      if (item.i === selectedItemId) {
        return { ...item, props: { ...item.props, [key]: value } };
      }
      return item;
    }));
  };

  const deleteSelected = () => {
    setLayout(prev => prev.filter(item => item.i !== selectedItemId));
    setSelectedItemId(null);
  };

  const selectedItem = layout.find(item => item.i === selectedItemId);

  return (
    <div className={s.editorLayout}>
      <aside className={s.sidebar}>
        <div className={s.sidebar__header}>Components</div>
        <div className={s.sidebar__list}>
          <div className={s.componentBox} draggable="true" onDragStart={e => e.dataTransfer.setData('text/plain', 'header')}>
            Banner & Header
          </div>
          <div className={s.componentBox} draggable="true" onDragStart={e => e.dataTransfer.setData('text/plain', 'services')}>
            Service Menu
          </div>
          <div className={s.componentBox} draggable="true" onDragStart={e => e.dataTransfer.setData('text/plain', 'calendar')}>
            Booking Calendar
          </div>
        </div>
        <div className={s.sidebar__actions}>
          <button className={s.btnSave} onClick={saveLayout} disabled={saving}>
            {saving ? 'Saving...' : 'Save Layout'}
          </button>
        </div>
      </aside>

      <main className={s.canvas}>
        <div className={s.canvas__toolbar}>
          <h2>Drag & Drop Booking Page Editor</h2>
          <div className={s.deviceToggle}>
            <button className={s.active}>Desktop</button>
            <button>Mobile (Auto-Stack)</button>
          </div>
        </div>
        
        {loading ? (
          <div className={s.loading}>Loading editor...</div>
        ) : (
          <div className={s.gridContainer} onClick={(e) => {
            // Deselect if clicking directly on the container background
            if (e.target === e.currentTarget) setSelectedItemId(null);
          }}>
            <ResponsiveGridLayout
              className="layout"
              layouts={{ lg: layout }}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
              rowHeight={60}
              onLayoutChange={onLayoutChange}
              isDroppable={true}
              onDrop={onDrop}
              isBounded={true}
            >
              {layout.map((item) => (
                <div 
                  key={item.i} 
                  data-grid={item} 
                  className={`${s.gridItem} ${selectedItemId === item.i ? s['gridItem--selected'] : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItemId(item.i);
                  }}
                  style={item.type === 'header' ? { backgroundColor: item.props?.bgColor } : {}}
                >
                  <span className={s.gridItem__label}>{item.type?.toUpperCase()}</span>
                  
                  {item.type === 'header' && (
                    <div className={s.mockHeader} style={{ color: item.props?.textColor }}>
                      {item.props?.text}
                    </div>
                  )}
                  {item.type === 'services' && (
                    <div className={s.mockList} style={{ backgroundColor: item.props?.cardColor, padding: '20px', borderRadius: '8px', width: '90%' }}>
                      <strong>Service Menu</strong>
                      <br/>
                      {item.props?.showDesc && <span>Includes full breakdown. </span>}
                      {item.props?.showPrices && <strong>$50.00</strong>}
                    </div>
                  )}
                  {item.type === 'calendar' && (
                    <div className={s.mockCal} style={{ color: item.props?.themeColor }}>📅</div>
                  )}
                </div>
              ))}
            </ResponsiveGridLayout>
          </div>
        )}
      </main>

      <aside className={s.propertiesPanel}>
        <div className={s.propertiesPanel__header}>
          Properties
          {selectedItem && (
            <button onClick={() => setSelectedItemId(null)} style={{cursor: 'pointer', color: 'var(--color-text-muted)'}}>✕</button>
          )}
        </div>
        <div className={s.propertiesPanel__body}>
          {!selectedItem ? (
            <div className={s.emptyState}>Select a component on the canvas to edit its properties.</div>
          ) : (
            <>
              <div className={s.propGroup}>
                <label>Component ID</label>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{selectedItem.i}</div>
              </div>

              {selectedItem.type === 'header' && (
                <>
                  <div className={s.propGroup}>
                    <label>Header Text</label>
                    <input className={s.propInput} type="text" value={selectedItem.props?.text || ''} 
                           onChange={e => updateSelectedProp('text', e.target.value)} />
                  </div>
                  <div className={s.propGroup}>
                    <label>Background Color</label>
                    <input className={s.propInput + ' ' + s.propColor} type="color" value={selectedItem.props?.bgColor || '#111318'} 
                           onChange={e => updateSelectedProp('bgColor', e.target.value)} />
                  </div>
                  <div className={s.propGroup}>
                    <label>Text Color</label>
                    <input className={s.propInput + ' ' + s.propColor} type="color" value={selectedItem.props?.textColor || '#e8eaf0'} 
                           onChange={e => updateSelectedProp('textColor', e.target.value)} />
                  </div>
                </>
              )}

              {selectedItem.type === 'services' && (
                <>
                  <label className={s.toggleLabel}>
                    <input type="checkbox" checked={selectedItem.props?.showDesc} 
                           onChange={e => updateSelectedProp('showDesc', e.target.checked)} />
                    Show Descriptions
                  </label>
                  <label className={s.toggleLabel}>
                    <input type="checkbox" checked={selectedItem.props?.showPrices} 
                           onChange={e => updateSelectedProp('showPrices', e.target.checked)} />
                    Show Prices
                  </label>
                  <div className={s.propGroup} style={{marginTop: 12}}>
                    <label>Card Background Color</label>
                    <input className={s.propInput + ' ' + s.propColor} type="color" value={selectedItem.props?.cardColor || '#191c24'} 
                           onChange={e => updateSelectedProp('cardColor', e.target.value)} />
                  </div>
                </>
              )}

              {selectedItem.type === 'calendar' && (
                <div className={s.propGroup}>
                  <label>Calendar Theme Accent</label>
                  <input className={s.propInput + ' ' + s.propColor} type="color" value={selectedItem.props?.themeColor || '#7c6ef7'} 
                         onChange={e => updateSelectedProp('themeColor', e.target.value)} />
                </div>
              )}

              <button className={s.btnDanger} onClick={deleteSelected}>
                🗑 Delete Component
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
