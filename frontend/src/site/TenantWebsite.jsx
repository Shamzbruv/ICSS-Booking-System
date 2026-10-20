/**
 * TenantWebsite — the public multi-page website every tenant gets:
 *   /:slug          Home
 *   /:slug/about    About
 *   /:slug/gallery  Gallery
 *   /:slug/book     Booking (the industry booking widget)
 *
 * When loaded with ?preview=1 inside the admin Website Builder, the page
 * accepts draft settings over postMessage (same-origin only) so tenants see
 * every change instantly before publishing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import s from './TenantWebsite.module.css';
import { SiteSection } from './SiteSections';
import { MusicPlayer, SmartImage } from './SiteMedia';
import { bookingBranding, builderCatalog, FONT_OPTIONS, hexToRgba, isSafeMediaUrl, PAGE_IDS, resolveSite, SECTION_TYPES, siteCssVars } from './siteSchema';
import { getPreset } from './presets';
import { getBookingTheme } from '../themes/registry';

const HERO_TYPES = new Set(['hero', 'pageHeader']);

function useGoogleFonts(fonts) {
  const key = fonts.filter((font) => FONT_OPTIONS.includes(font)).sort().join('|');
  useEffect(() => {
    if (!key) return;
    const families = key.split('|').map((font) => `family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;500;600;700`).join('&');
    const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    let link = document.getElementById('icss-site-fonts');
    if (!link) {
      link = document.createElement('link');
      link.id = 'icss-site-fonts';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [key]);
}

function useSeo(site, tenantName) {
  useEffect(() => {
    const title = site.seo?.title || [site.brand?.name || tenantName, site.brand?.tagline].filter(Boolean).join(' — ');
    if (title) document.title = title;
    const description = site.seo?.description || site.brand?.tagline;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description.slice(0, 300);
    }
  }, [site.seo?.title, site.seo?.description, site.brand?.name, site.brand?.tagline, tenantName]);
}

function useReveal(rootRef, enabled, deps) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const nodes = [...root.querySelectorAll('[data-reveal]')];
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!enabled || reduced || typeof IntersectionObserver === 'undefined') {
      nodes.forEach((node) => node.setAttribute('data-reveal', 'shown'));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.setAttribute('data-reveal', 'shown');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    nodes.forEach((node) => { if (node.getAttribute('data-reveal') !== 'shown') observer.observe(node); });
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function SocialLinks({ social }) {
  const links = [
    ['instagramUrl', 'Instagram'], ['facebookUrl', 'Facebook'], ['tiktokUrl', 'TikTok'], ['youtubeUrl', 'YouTube'], ['xUrl', 'X']
  ].filter(([key]) => isSafeMediaUrl(social?.[key]));
  if (!links.length) return null;
  return (
    <div className={s.socialLinks}>
      {links.map(([key, label]) => <a key={key} href={social[key]} target="_blank" rel="noreferrer">{label}</a>)}
    </div>
  );
}

export default function TenantWebsite({ tenant, services, themeKey, savedSite, basePath, pageParam, preview = false, overrides = {}, onRequestTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [musicCommand, setMusicCommand] = useState(null);
  const [editMode, setEditMode] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const preset = getPreset(themeKey);
  const site = useMemo(() => {
    const resolved = resolveSite(tenant, preset, draft ?? savedSite);
    if (overrides.name) resolved.brand = { ...resolved.brand, name: overrides.name };
    if (overrides.primary) resolved.style = { ...resolved.style, colors: { ...resolved.style.colors, primary: overrides.primary } };
    return resolved;
  }, [tenant, preset, draft, savedSite, overrides.name, overrides.primary]);

  const visiblePages = site.pages.filter((page) => page.visible);
  const requestedPage = PAGE_IDS.includes(pageParam) ? pageParam : 'home';
  const currentPage = site.pages.find((page) => page.id === requestedPage && (page.visible || preview)) || site.pages[0];
  const onePage = site.layoutMode === 'onepage';

  useGoogleFonts([site.style.headingFont, site.style.bodyFont]);
  useSeo(site, tenant.name);

  // ── Builder bridge (preview only) ─────────────────────────────────────────
  const latest = useRef({});
  latest.current = { tenant, preset, savedSite, currentPage, themeKey };
  useEffect(() => {
    if (!preview || window.parent === window) return undefined;
    const parentWindow = window.parent;
    const send = (message) => parentWindow.postMessage(message, window.location.origin);
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== parentWindow) return;
      const data = event.data || {};
      switch (data.type) {
        case 'icss:site-edit-mode':
          setEditMode(data.editing !== false);
          break;
        case 'icss:site-update':
          if (data.site && typeof data.site === 'object') setDraft(data.site);
          break;
        case 'icss:site-navigate':
          if (PAGE_IDS.includes(data.page)) latest.current.navigateTo?.(data.page);
          break;
        case 'icss:site-highlight':
          setHighlightId(data.sectionId || null);
          break;
        case 'icss:site-music':
          setMusicCommand({ play: Boolean(data.play), at: Date.now() });
          break;
        case 'icss:site-request-defaults': {
          const { tenant: t, preset: p } = latest.current;
          send({ type: 'icss:site-defaults', defaults: resolveSite(t, p, null), requestId: data.requestId });
          break;
        }
        case 'icss:site-resolve': {
          const { tenant: t, preset: p } = latest.current;
          send({ type: 'icss:site-resolved', resolved: resolveSite(t, p, data.site || null), requestId: data.requestId });
          break;
        }
        case 'icss:site-theme':
          if (onRequestTheme && data.themeKey) onRequestTheme(data.themeKey);
          break;
        default:
      }
    };
    window.addEventListener('message', onMessage);
    const { tenant: t, preset: p, savedSite: saved, currentPage: page } = latest.current;
    send({
      type: 'icss:site-ready',
      themeKey,
      themeLabel: p.label,
      resolved: resolveSite(t, p, saved),
      defaults: resolveSite(t, p, null),
      catalog: builderCatalog(),
      page: page.id,
      serviceCount: services.length
    });
    return () => window.removeEventListener('message', onMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, themeKey]);

  useEffect(() => {
    if (preview && window.parent !== window) window.parent.postMessage({ type: 'icss:site-page', page: currentPage.id }, window.location.origin);
  }, [preview, currentPage.id]);

  useEffect(() => {
    if (!highlightId || !rootRef.current) return;
    const node = rootRef.current.querySelector(`[data-section-id="${CSS.escape(highlightId)}"]`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [highlightId, currentPage.id]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const searchFor = useCallback((serviceId) => {
    const params = new URLSearchParams();
    const current = new URLSearchParams(location.search);
    ['preview', 'name', 'primary'].forEach((key) => { if (current.get(key)) params.set(key, current.get(key)); });
    if (serviceId) params.set('service', serviceId);
    const text = params.toString();
    return text ? `?${text}` : '';
  }, [location.search]);

  const navigateTo = useCallback((pageId, { serviceId, hash } = {}) => {
    setMenuOpen(false);
    if (onePage) {
      const node = document.getElementById(hash || `page-${pageId}`);
      node?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const path = pageId === 'home' ? basePath : `${basePath}/${pageId}`;
    navigate(`${path}${searchFor(serviceId)}`);
    if (hash) window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 120);
  }, [basePath, navigate, onePage, searchFor]);

  latest.current.navigateTo = navigateTo;

  const resolveTarget = useCallback((target) => {
    if (target === 'contact') return { page: 'home', hash: 'contact' };
    const page = site.pages.find((p) => p.id === target);
    if (page && (page.visible || preview)) return { page: target };
    return { page: target === 'book' ? 'book' : 'home' };
  }, [site.pages, preview]);

  const SiteLink = useMemo(() => function SiteLinkInner({ target, serviceId, className, children, field, globalField }) {
    const { page, hash } = resolveTarget(target);
    const href = onePage ? `#${hash || `page-${page}`}` : `${page === 'home' ? basePath : `${basePath}/${page}`}${hash ? `#${hash}` : ''}`;
    return (
      <a data-site-global={globalField} data-site-field={field} href={href} className={className} onClick={(event) => { event.preventDefault(); navigateTo(page, { serviceId, hash }); }}>
        {children}
      </a>
    );
  }, [resolveTarget, onePage, basePath, navigateTo]);

  useEffect(() => {
    if (!onePage && !highlightId) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage.id, onePage]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  // ── Booking widget (themed per template) ──────────────────────────────────
  const BookingTheme = getBookingTheme(themeKey);
  const preselectServiceId = new URLSearchParams(location.search).get('service');
  const bookingTenant = useMemo(() => {
    const colors = site.style.colors;
    const sync = site.style.syncBookingColors ? {
      accent: colors.primary,
      accentStrong: colors.primary,
      strongBg: colors.primary,
      buttonText: colors.primaryText,
      accentSoft: hexToRgba(colors.primary, 0.12),
      accentBorder: hexToRgba(colors.primary, 0.22),
      cardSelectedBorder: hexToRgba(colors.primary, 0.45)
    } : {};
    return {
      ...tenant,
      name: site.brand.name || tenant.name,
      embedInSite: true,
      preselectServiceId,
      bookingPolicy: site.policies?.bookingTerms || '',
      branding: { ...tenant.branding, ...bookingBranding(site), customPalette: { ...sync, ...(tenant.branding?.customPalette || {}) } }
    };
  }, [tenant, site, preselectServiceId]);
  const renderBooking = useCallback(() => {
    const Widget = getBookingTheme(themeKey);
    return <Widget tenant={bookingTenant} services={services} />;
  }, [themeKey, bookingTenant, services]);

  const sectionsToRender = onePage
    ? visiblePages.flatMap((page) => page.sections
      .filter((section) => section.visible || preview)
      .filter((section) => page.id === 'home' || section.type !== 'pageHeader')
      .map((section, index) => ({ ...section, ownerPage: page.id, anchor: index === 0 ? `page-${page.id}` : undefined, hiddenSection: !section.visible })))
    : currentPage.sections.filter((section) => section.visible || preview).map((section) => ({ ...section, hiddenSection: !section.visible }));

  useReveal(rootRef, site.style.animations !== false, [currentPage.id, sectionsToRender.length, onePage, site.style.animations]);

  const handleGlobalEdit = preview && editMode ? (event) => {
    const global = event.target.closest('[data-site-global]')?.dataset.siteGlobal;
    if (!global) return;
    event.preventDefault();
    event.stopPropagation();
    window.parent.postMessage({ type: 'icss:site-select-global', field: global }, window.location.origin);
  } : undefined;

  // Legacy "booking page only" mode.
  if (site.enabled === false) {
    return <div ref={rootRef} className={s.site} data-site-editing={preview && editMode ? 'true' : undefined} onClickCapture={handleGlobalEdit}>
      <BookingTheme tenant={{ ...bookingTenant, embedInSite: false }} services={services} />
    </div>;
  }

  const firstSection = sectionsToRender[0];
  const navOverHero = site.nav.style === 'transparent' && firstSection && HERO_TYPES.has(firstSection.type);
  const navSolid = !navOverHero || scrolled || menuOpen;
  const brandName = site.brand.name || tenant.name;
  const ctx = { tenant, services, site, preset, fallback: preset.fallback, SiteLink, renderBooking };
  const announcement = site.announcement?.enabled && site.announcement.text;

  const postSelect = (section, field) => {
    window.parent.postMessage({ type: 'icss:site-select', sectionId: section.id, page: section.ownerPage || currentPage.id, field }, window.location.origin);
  };

  return (
    <div ref={rootRef} data-site-editing={preview && editMode ? 'true' : undefined}
      onClickCapture={handleGlobalEdit} className={`${s.site} ${site.style.mode === 'dark' ? s.siteDark : ''} ${site.style.buttonStyle === 'outline' ? s.btnOutline : ''}`} style={siteCssVars(site.style)}>
      <a href="#main" className={s.skipLink}>Skip to content</a>
      {announcement && (
        <div data-site-global="announcement.text" className={s.announcement}>
          <span>{site.announcement.text}</span>
          {site.announcement.linkLabel && <SiteLink target={site.announcement.target || 'book'} className={s.announcementLink}>{site.announcement.linkLabel} →</SiteLink>}
        </div>
      )}

      <header className={`${s.nav} ${navSolid ? s.navSolid : s.navClear} ${site.nav.sticky !== false ? s.navSticky : ''} ${navOverHero ? s.navOverlay : ''}`}>
        <div className={`${s.container} ${s.navInner}`}>
          <SiteLink globalField="brand.name" target="home" className={s.navBrand}>
            {isSafeMediaUrl(site.brand.logoUrl) && <span data-site-global="brand.logoUrl"><SmartImage src={site.brand.logoUrl} alt={brandName} className={s.navLogo} eager /></span>}
            {(site.brand.showNameWithLogo !== false || !isSafeMediaUrl(site.brand.logoUrl)) && <span>{brandName}</span>}
          </SiteLink>
          <nav className={s.navLinks} aria-label="Main">
            {visiblePages.filter((page) => page.id !== 'book').map((page) => (
              <SiteLink key={page.id} target={page.id} className={`${s.navLink} ${!onePage && currentPage.id === page.id ? s.navLinkActive : ''}`}>{page.label}</SiteLink>
            ))}
          </nav>
          <div className={s.navActions}>
            <SiteLink globalField="nav.bookLabel" target="book" className={`${s.btnPrimary} ${s.navBook}`}>{site.nav.bookLabel || 'Book now'}</SiteLink>
            <button type="button" className={s.menuButton} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      <div className={`${s.mobileMenu} ${menuOpen ? s.mobileMenuOpen : ''}`} aria-hidden={!menuOpen}>
        <nav aria-label="Mobile">
          {visiblePages.map((page) => (
            <SiteLink key={page.id} target={page.id} className={s.mobileMenuLink}>{page.id === 'book' ? (site.nav.bookLabel || page.label) : page.label}</SiteLink>
          ))}
        </nav>
        {site.contact.phone && <a className={s.mobileMenuMeta} href={`tel:${site.contact.phone.replace(/[^+0-9]/g, '')}`}>{site.contact.phone}</a>}
        <SocialLinks social={site.social} />
      </div>

      <main id="main" className={s.main}>
        {preview && !currentPage.visible && (
          <div className={s.previewNotice}>This page is hidden. Visitors can't see it until you switch it on in Pages.</div>
        )}
        {sectionsToRender.map((section) => (
          <div
            key={section.id}
            id={section.anchor}
            data-section-id={section.id}
            onClickCapture={preview && editMode ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              const field = event.target.closest('[data-site-field]')?.dataset.siteField;
              const background = section.type === 'hero' ? (section.props.mediaType === 'video' ? 'videoUrl' : section.props.mediaType === 'slideshow' ? 'slides' : section.props.mediaType === 'color' ? 'mediaType' : 'imageUrl') : ['pageHeader', 'cta'].includes(section.type) ? 'imageUrl' : undefined;
              postSelect(section, field || background);
            } : undefined}
            data-reveal={HERO_TYPES.has(section.type) ? 'shown' : 'pending'}
            className={`${s.sectionShell} ${highlightId === section.id ? s.sectionHighlighted : ''} ${section.hiddenSection ? s.sectionHidden : ''}`}
          >
            {preview && editMode && (
              <button type="button" className={s.editTag} style={HERO_TYPES.has(section.type) ? { top: 'calc(var(--nav-h) + 10px)' } : undefined} onClick={() => postSelect(section)}>
                ✎ Edit {SECTION_TYPES[section.type]?.label || section.type}{section.hiddenSection ? ' · hidden' : ''}
              </button>
            )}
            <SiteSection section={section} ctx={ctx} />
          </div>
        ))}
      </main>

      <footer data-site-global="footer.text" className={s.footer}>
        <div className={`${s.container} ${s.footerGrid}`}>
          <div>
            <p className={s.footerBrand}>{brandName}</p>
            {site.brand.tagline && <p className={s.footerTagline}>{site.brand.tagline}</p>}
            {site.footer?.text && <p className={s.footerText}>{site.footer.text}</p>}
            <SocialLinks social={site.social} />
          </div>
          <nav className={s.footerLinks} aria-label="Footer">
            {visiblePages.map((page) => <SiteLink key={page.id} target={page.id}>{page.label}</SiteLink>)}
          </nav>
          <div className={s.footerContact}>
            {site.contact.address && <p>{site.contact.address}</p>}
            {site.contact.phone && <a href={`tel:${site.contact.phone.replace(/[^+0-9]/g, '')}`}>{site.contact.phone}</a>}
            {site.contact.email && <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>}
          </div>
        </div>
        <div className={`${s.container} ${s.footerBottom}`}>
          <span>© {new Date().getFullYear()} {brandName}</span>
          <a href="https://icssbookings.com" target="_blank" rel="noreferrer">Powered by ICSS Bookings</a>
        </div>
      </footer>

      {currentPage.id !== 'book' && (
        <div className={s.mobileBookBar}>
          <SiteLink target="book" className={s.btnPrimary}>{site.nav.bookLabel || 'Book now'}</SiteLink>
        </div>
      )}

      {site.music?.enabled && isSafeMediaUrl(site.music.url) && (
        <MusicPlayer music={site.music} suppressAutoplay={preview} command={musicCommand} />
      )}
    </div>
  );
}
