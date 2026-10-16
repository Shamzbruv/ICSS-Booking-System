/**
 * DemoSite — /demo/:themeKey/:page?
 *
 * A fully working sample website for any template, used by the theme picker,
 * the landing-page "See your space" section and the public builder playground.
 * Bookings are simulated (no data is written).
 *
 * Query params: ?name=Business+Name&primary=%23ff6600 personalise the demo,
 * ?preview=1 enables the builder bridge.
 */
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import TenantWebsite from '../../site/TenantWebsite';
import { PRESETS, getPreset } from '../../site/presets';
import { useNoIndex } from '../../hooks/useNoIndex';

export default function DemoSite() {
  useNoIndex();
  const { themeKey: routeKey, page } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [themeOverride, setThemeOverride] = useState(null);
  const themeKey = themeOverride || (PRESETS[routeKey] ? routeKey : 'universal');
  const preset = getPreset(themeKey);

  const primary = /^#[0-9a-f]{6}$/i.test(params.get('primary') || '') ? params.get('primary') : null;
  const name = (params.get('name') || '').slice(0, 60) || null;

  const tenant = useMemo(() => ({
    name: preset.demo.name,
    slug: `demo-${themeKey}`,
    isDemo: true,
    themeKey,
    branding: { timezone: 'America/Jamaica', location: preset.demo.location, bookingTagline: preset.demo.tagline, customPalette: {} },
    default_payment_mode: 'none',
    payment_gateways: {},
    site: null
  }), [preset, themeKey]);

  const services = useMemo(() => preset.demo.services.map((service, index) => ({
    id: `demo-${themeKey}-${index}`,
    currency: 'JMD',
    payment_mode: 'tenant_default',
    payment_requirement_type: 'none',
    ...service
  })), [preset, themeKey]);

  const switchTheme = (key) => {
    if (!PRESETS[key]) return;
    setThemeOverride(key);
    navigate(`/demo/${key}${location.search}`, { replace: true });
  };

  return (
    <TenantWebsite
      key={themeKey}
      tenant={tenant}
      services={services}
      themeKey={themeKey}
      savedSite={null}
      basePath={`/demo/${themeKey}`}
      pageParam={page}
      preview={params.get('preview') === '1'}
      overrides={{ name, primary }}
      onRequestTheme={switchTheme}
    />
  );
}
