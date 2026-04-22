import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { api } from '../../api';
import s from './PublicBookingPage.module.css';

const { Responsive, WidthProvider } = ReactGridLayout;
const ResponsiveGridLayout = WidthProvider(Responsive);

export default function PublicBookingPage() {
  const { slug } = useParams();
  const [tenant, setTenant] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.publicTenant(slug),
      api.publicServices(slug)
    ])
    .then(([tenantData, servicesData]) => {
      setTenant(tenantData);
      setServices(servicesData.services || []);
    })
    .catch(err => setError('Booking page not found or currently unavailable.'))
    .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className={s.loading}>Loading Booking Page...</div>;
  if (error) return <div className={s.error}>{error}</div>;
  if (!tenant || !tenant.layout) return <div className={s.error}>No layout configured for this tenant.</div>;

  const layout = tenant.layout;

  return (
    <div className={s.pageWrapper}>
      <div className={s.container}>
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          isDraggable={false}
          isResizable={false}
          margin={[24, 24]}
        >
          {layout.map(item => (
            <div key={item.i} className={s.gridItem}>
              {item.type === 'header' && <PublicHeader props={item.props} />}
              {item.type === 'services' && <PublicServiceMenu props={item.props} services={services} />}
              {item.type === 'calendar' && <PublicCalendar props={item.props} />}
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}

// ── Internal Renderers ─────────────────────────────────────────────────────────

function PublicHeader({ props }) {
  return (
    <div className={s.header} style={{ backgroundColor: props?.bgColor || '#111318', color: props?.textColor || '#e8eaf0' }}>
      <h1>{props?.text || 'Booking Page'}</h1>
    </div>
  );
}

function PublicServiceMenu({ props, services }) {
  return (
    <div className={s.serviceMenu} style={{ backgroundColor: props?.cardColor || '#191c24' }}>
      <h2>Select a Service</h2>
      {services.length === 0 ? (
        <p className={s.muted}>No services available at this time.</p>
      ) : (
        <div className={s.serviceList}>
          {services.map(svc => (
            <div key={svc.id} className={s.serviceCard}>
              <div className={s.serviceCard__info}>
                <strong>{svc.name}</strong>
                {props?.showDesc && <p>{svc.description}</p>}
                <span className={s.duration}>⏱ {svc.duration_minutes} min</span>
              </div>
              {props?.showPrices && (
                <div className={s.serviceCard__price}>
                  {svc.currency} {svc.price}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PublicCalendar({ props }) {
  return (
    <div className={s.calendarWidget}>
      <h2 style={{ color: props?.themeColor || '#7c6ef7' }}>Select a Date & Time</h2>
      {/* Placeholder for the actual react-calendar and time slot selection logic */}
      <div className={s.mockCalendarBody}>
        [ Interactive Calendar Component ]
      </div>
    </div>
  );
}
