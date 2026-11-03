/**
 * PublicBookingPage — a tenant's public website (Home / About / Gallery / Book).
 *
 * Loads the tenant + services, then hands off to TenantWebsite which renders
 * the published site using the tenant's template preset. ?preview=1 enables
 * the live-preview bridge used by the admin Website Builder.
 */
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api } from '../../api';
import s from './PublicBookingPage.module.css';
import TenantWebsite from '../../site/TenantWebsite';
import { resolveThemeKey } from '../../themes/registry';

export default function PublicBookingPage() {
  const { slug, page } = useParams();
  const location = useLocation();
  const preview = new URLSearchParams(location.search).get('preview') === '1';

  const [tenant, setTenant] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPageError(null);
    Promise.all([api.publicTenant(slug), api.publicServices(slug)])
      .then(([t, svc]) => {
        if (!active) return;
        setTenant(t);
        setServices(svc.services || []);
      })
      .catch((error) => {
        if (!active) return;
        const message = error.status === 429
          ? 'Too many requests. Please wait a few minutes before trying again.'
          : 'This page could not load. Please try again.';
        setPageError(message);
        if (preview && window.parent !== window) {
          window.parent.postMessage({ type: 'icss:site-error', message }, window.location.origin);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, preview]);

  if (loading) return (
    <div className={s.fullscreen}>
      <div className={s.spinner} />
      <p>Loading…</p>
    </div>
  );

  if (pageError) return (
    <div className={s.fullscreen}>
      <div className={s.errorIcon}>⚠️</div>
      <p>{pageError}</p>
    </div>
  );

  return (
    <TenantWebsite
      tenant={tenant}
      services={services}
      themeKey={resolveThemeKey(tenant)}
      savedSite={tenant.site}
      basePath={`/${slug}`}
      pageParam={page}
      preview={preview}
    />
  );
}
