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
import careerKits from '../../site/presets/career-starter-kits.json';
import s from './DemoSite.module.css';
import { drivingLessonsJa, drivingLessonsJaSlug } from './drivingLessonsJa.js';
import { clarkiesDrivingSchool, clarkiesSlug } from './clarkiesDrivingSchool.js';
import { useNoIndex } from '../../hooks/useNoIndex';

const prospectSites = new Map([
  [drivingLessonsJaSlug, drivingLessonsJa],
  [clarkiesSlug, clarkiesDrivingSchool]
]);

export default function DemoSite() {
  useNoIndex();
  const { themeKey: routeKey, page } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [themeOverride, setThemeOverride] = useState(null);
  const prospect = prospectSites.get(routeKey);
  const themeKey = prospect ? prospect.key : themeOverride || (Object.hasOwn(PRESETS, routeKey) ? routeKey : 'universal');
  const preset = prospect || getPreset(themeKey);
  const basePath = '/demo/' + (prospect ? routeKey : themeKey);

  const primary = /^#[0-9a-f]{6}$/i.test(params.get('primary') || '') ? params.get('primary') : null;
  const name = (params.get('name') || '').slice(0, 60) || null;

  const tenant = useMemo(() => ({
    name: preset.demo.name,
    slug: `demo-${prospect ? routeKey : themeKey}`,
    isDemo: true,
    themeKey,
    branding: { timezone: 'America/Jamaica', location: preset.demo.location, bookingTagline: preset.demo.tagline, customPalette: {} },
    default_payment_mode: 'none',
    payment_gateways: {},
    site: null
  }), [preset, themeKey, prospect, routeKey]);

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

  const starter = !prospect && !params.has('preview') && careerKits.find(kit => kit.key === themeKey && !kit.retired);
  return (<>
    {prospect && <div className={s.previewBar}><span>Website preview for {preset.demo.name}</span><span>Bookings are simulated</span></div>}
    {starter && <div className={s.previewBar}><a href={starter.trade ? '/industries#trade-starters' : '/industries#new-starters'}>← Starter websites</a><span>Template preview · Bookings are simulated</span><a className={s.useStarter} href={`/onboarding?template=${themeKey}`}>Use this design →</a></div>}
    <TenantWebsite
      key={basePath}
      tenant={tenant}
      services={services}
      themeKey={themeKey}
      savedSite={prospect ? preset.site : null}
      basePath={basePath}
      pageParam={page}
      preview={!prospect && params.get('preview') === '1'}
      overrides={prospect ? undefined : { name, primary }}
      onRequestTheme={prospect ? undefined : switchTheme}
    />
  </>);
}
