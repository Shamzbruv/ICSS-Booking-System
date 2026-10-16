/**
 * Website schema — the single source of truth for tenant websites.
 *
 * The public site renders from it, and the admin Website Builder (vanilla JS,
 * admin/js/siteBuilder.js) receives SECTION_TYPES / MEDIA_GUIDE / FONT_OPTIONS
 * from the live-preview iframe over postMessage, so the builder's forms are
 * always in sync with what the site can actually render.
 */

// ── Media guidance shown next to every upload field ──────────────────────────
export const MEDIA_GUIDE = {
  heroImage: {
    ratio: '16:9 landscape',
    size: '1920 × 1080 px (minimum 1600 × 900)',
    format: 'JPG or WebP · under 500 KB',
    tip: 'Keep faces and text-safe space in the centre — edges are cropped on phones.'
  },
  heroMobileImage: {
    ratio: '9:16 portrait (optional)',
    size: '1080 × 1920 px',
    format: 'JPG or WebP · under 400 KB',
    tip: 'Shown instead of the desktop image on phones for a perfect portrait crop.'
  },
  heroVideo: {
    ratio: '16:9 landscape',
    size: '1920 × 1080 px or 1280 × 720 px',
    format: 'MP4 (H.264) · 8–20 second seamless loop · no sound · under 15 MB (40 MB max)',
    tip: 'Videos autoplay muted. Phones on data saver show the poster image instead, so always add one.'
  },
  poster: {
    ratio: '16:9 landscape',
    size: '1920 × 1080 px',
    format: 'JPG or WebP · under 300 KB',
    tip: 'Use the first frame of your video so the switch from image to video is seamless.'
  },
  bannerImage: {
    ratio: '21:9 wide banner',
    size: '2400 × 1000 px',
    format: 'JPG or WebP · under 450 KB',
    tip: 'Text sits on top, so calmer images with soft detail work best.'
  },
  featureImage: {
    ratio: '4:5 portrait',
    size: '1200 × 1500 px',
    format: 'JPG or WebP · under 350 KB',
    tip: 'Portrait photos of your space, team or work look best next to text.'
  },
  galleryImage: {
    ratio: '4:5 portrait or 1:1 square (keep them consistent)',
    size: '1200–1600 px on the long edge',
    format: 'JPG or WebP · under 400 KB each',
    tip: 'Upload 6, 9 or 12 photos so the grid stays even on every screen.'
  },
  teamPhoto: {
    ratio: '1:1 square',
    size: '800 × 800 px',
    format: 'JPG or WebP · under 200 KB',
    tip: 'Head-and-shoulders shots with similar lighting look the most polished.'
  },
  logo: {
    ratio: 'Square 1:1 or wide 3:1',
    size: '512 × 512 px or 900 × 300 px',
    format: 'PNG with transparent background · under 150 KB',
    tip: 'A light logo suits dark themes; a dark logo suits light themes.'
  },
  music: {
    ratio: 'Audio',
    size: '1–3 minutes, seamless loop',
    format: 'MP3 · 128–192 kbps · under 5 MB (12 MB max)',
    tip: 'Browsers block sound until a visitor taps, so the site shows a "Play music" button. Only use music you own or have a licence for.'
  }
};

// ── Fonts (Google Fonts, loaded on demand) ───────────────────────────────────
export const FONT_OPTIONS = [
  'Inter', 'Manrope', 'Poppins', 'Montserrat', 'Plus Jakarta Sans', 'DM Sans', 'Jost', 'Nunito Sans', 'Lato', 'Space Grotesk',
  'Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Libre Baskerville', 'Lora', 'Fraunces', 'Italiana',
  'Oswald', 'Bebas Neue', 'Barlow Condensed', 'Anton'
];

export const PAGE_IDS = ['home', 'about', 'gallery', 'book'];
export const PAGE_LABELS = { home: 'Home', about: 'About', gallery: 'Gallery', book: 'Book' };

// Field helpers keep SECTION_TYPES compact.
const text = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra });
const area = (key, label, extra = {}) => ({ key, label, type: 'textarea', ...extra });
const media = (key, label, accept, guide, extra = {}) => ({ key, label, type: 'media', accept, guide, ...extra });
const select = (key, label, options, extra = {}) => ({ key, label, type: 'select', options, ...extra });
const toggle = (key, label, extra = {}) => ({ key, label, type: 'toggle', ...extra });
const range = (key, label, min, max, step, extra = {}) => ({ key, label, type: 'range', min, max, step, ...extra });
const target = (key, label) => select(key, label, [
  { value: 'book', label: 'Booking page' }, { value: 'about', label: 'About page' },
  { value: 'gallery', label: 'Gallery page' }, { value: 'home', label: 'Home page' }, { value: 'contact', label: 'Contact section' }
]);
const list = (key, label, itemLabel, fields, extra = {}) => ({ key, label, type: 'list', itemLabel, fields, ...extra });

// ── Section catalogue ────────────────────────────────────────────────────────
export const SECTION_TYPES = {
  hero: {
    label: 'Hero banner', icon: '🖼️', description: 'Full-width opening banner with photo, video or slideshow background.',
    fields: [
      select('mediaType', 'Background', [
        { value: 'image', label: 'Photo' }, { value: 'video', label: 'Video' },
        { value: 'slideshow', label: 'Photo slideshow' }, { value: 'color', label: 'Colour / gradient only' }
      ]),
      media('imageUrl', 'Background photo', 'image', 'heroImage', { showIf: { mediaType: ['image', 'video'] } }),
      media('mobileImageUrl', 'Phone photo (optional)', 'image', 'heroMobileImage', { showIf: { mediaType: ['image'] } }),
      media('videoUrl', 'Background video', 'video', 'heroVideo', { showIf: { mediaType: ['video'] } }),
      media('posterUrl', 'Video poster image', 'image', 'poster', { showIf: { mediaType: ['video'] } }),
      list('slides', 'Slideshow photos', 'Slide', [media('url', 'Photo', 'image', 'heroImage')], { showIf: { mediaType: ['slideshow'] } }),
      range('overlay', 'Darken background', 0, 0.9, 0.05),
      text('eyebrow', 'Small heading'),
      text('headline', 'Headline'),
      area('subheadline', 'Sub-headline'),
      text('ctaLabel', 'Main button text'),
      target('ctaTarget', 'Main button opens'),
      text('secondaryLabel', 'Second button text (optional)'),
      target('secondaryTarget', 'Second button opens'),
      select('align', 'Text alignment', [{ value: 'center', label: 'Centre' }, { value: 'left', label: 'Left' }]),
      select('height', 'Height', [{ value: 'full', label: 'Full screen' }, { value: 'tall', label: 'Tall' }, { value: 'medium', label: 'Medium' }])
    ]
  },
  pageHeader: {
    label: 'Page header', icon: '🏷️', description: 'Compact banner for inner pages.',
    fields: [
      text('title', 'Title'), area('subtitle', 'Subtitle'),
      media('imageUrl', 'Background photo', 'image', 'bannerImage'),
      range('overlay', 'Darken background', 0, 0.9, 0.05)
    ]
  },
  intro: {
    label: 'Text + image', icon: '📝', description: 'Tell your story next to a photo.',
    fields: [
      text('eyebrow', 'Small heading'), text('title', 'Title'), area('body', 'Text', { rows: 6 }),
      media('imageUrl', 'Photo', 'image', 'featureImage'),
      select('imageSide', 'Photo position', [{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }]),
      text('ctaLabel', 'Button text (optional)'), target('ctaTarget', 'Button opens')
    ]
  },
  highlights: {
    label: 'Highlights', icon: '✨', description: 'Three or four reasons to choose you.',
    fields: [
      text('title', 'Title'), area('subtitle', 'Subtitle'),
      list('items', 'Highlights', 'Highlight', [text('icon', 'Emoji / icon'), text('title', 'Title'), area('text', 'Text')])
    ]
  },
  services: {
    label: 'Services menu', icon: '📋', description: 'Your live services, prices and durations (managed on the Services page).',
    fields: [
      text('title', 'Title'), area('subtitle', 'Subtitle'),
      range('limit', 'How many to show', 2, 12, 1), toggle('showPrices', 'Show prices'), toggle('showDuration', 'Show duration'),
      text('ctaLabel', 'Button text')
    ]
  },
  gallery: {
    label: 'Gallery', icon: '🖼', description: 'Photo grid with full-screen viewer.',
    fields: [
      text('title', 'Title'), area('subtitle', 'Subtitle'),
      select('layout', 'Layout', [{ value: 'grid', label: 'Even grid' }, { value: 'masonry', label: 'Masonry' }, { value: 'carousel', label: 'Swipe carousel' }]),
      select('aspect', 'Photo shape', [{ value: '4/5', label: 'Portrait 4:5' }, { value: '1/1', label: 'Square 1:1' }, { value: '3/2', label: 'Landscape 3:2' }]),
      list('images', 'Photos', 'Photo', [media('url', 'Photo', 'image', 'galleryImage'), text('caption', 'Caption')])
    ]
  },
  testimonials: {
    label: 'Testimonials', icon: '💬', description: 'Reviews from happy clients.',
    fields: [
      text('title', 'Title'),
      list('items', 'Reviews', 'Review', [area('quote', 'Quote'), text('name', 'Name'), text('role', 'Detail (e.g. "Regular client")')])
    ]
  },
  team: {
    label: 'Team', icon: '👥', description: 'Introduce the people behind the business.',
    fields: [
      text('title', 'Title'), area('subtitle', 'Subtitle'),
      list('members', 'Team members', 'Member', [media('photoUrl', 'Photo', 'image', 'teamPhoto'), text('name', 'Name'), text('role', 'Role'), area('bio', 'Short bio')])
    ]
  },
  stats: {
    label: 'Numbers', icon: '🔢', description: 'Big numbers that build trust.',
    fields: [list('items', 'Numbers', 'Number', [text('value', 'Value (e.g. 10+)'), text('label', 'Label')])]
  },
  video: {
    label: 'Video', icon: '🎬', description: 'Feature an MP4, YouTube or Vimeo video.',
    fields: [
      text('title', 'Title'), area('subtitle', 'Subtitle'),
      media('videoUrl', 'Video file or YouTube / Vimeo link', 'video', 'heroVideo', { allowExternal: true }),
      media('posterUrl', 'Cover image', 'image', 'poster')
    ]
  },
  faq: {
    label: 'FAQ', icon: '❓', description: 'Answer common questions.',
    fields: [text('title', 'Title'), list('items', 'Questions', 'Question', [text('q', 'Question'), area('a', 'Answer')])]
  },
  cta: {
    label: 'Call to action', icon: '📣', description: 'Bold banner that drives bookings.',
    fields: [
      text('title', 'Title'), area('text', 'Text'), text('buttonLabel', 'Button text'), target('target', 'Button opens'),
      media('imageUrl', 'Background photo (optional)', 'image', 'bannerImage')
    ]
  },
  contact: {
    label: 'Contact & hours', icon: '📍', description: 'Address, phone, WhatsApp, hours and map.',
    fields: [
      text('title', 'Title'), area('subtitle', 'Subtitle'),
      toggle('showMap', 'Show map'), toggle('showHours', 'Show opening hours'),
      list('hours', 'Opening hours', 'Day', [text('day', 'Day(s)'), text('time', 'Hours')])
    ]
  },
  booking: {
    label: 'Booking widget', icon: '📅', description: 'Your live booking calendar and checkout.',
    fields: [text('title', 'Title'), area('subtitle', 'Subtitle')]
  }
};

export const SECTION_DEFAULTS = {
  hero: { mediaType: 'image', overlay: 0.45, align: 'center', height: 'full', ctaLabel: 'Book an appointment', ctaTarget: 'book', secondaryTarget: 'about', slides: [] },
  pageHeader: { overlay: 0.5 },
  intro: { imageSide: 'right', ctaTarget: 'book' },
  highlights: { items: [] },
  services: { title: 'Services', limit: 6, showPrices: true, showDuration: true, ctaLabel: 'Book now' },
  gallery: { title: 'Gallery', layout: 'grid', aspect: '4/5', images: [] },
  testimonials: { title: 'What clients say', items: [] },
  team: { title: 'Meet the team', members: [] },
  stats: { items: [] },
  video: { title: '' },
  faq: { title: 'Frequently asked questions', items: [] },
  cta: { title: 'Ready when you are', buttonLabel: 'Book now', target: 'book' },
  contact: { title: 'Visit us', showMap: true, showHours: true, hours: [] },
  booking: { title: 'Book your appointment' }
};

// ── Global (non-section) settings the builder edits ──────────────────────────
export const GLOBAL_FIELDS = {
  brand: [
    media('logoUrl', 'Logo', 'image', 'logo'),
    text('name', 'Business name (leave blank to use your account name)'),
    text('tagline', 'Tagline'),
    toggle('showNameWithLogo', 'Show name next to logo')
  ],
  nav: [
    select('style', 'Menu style', [{ value: 'transparent', label: 'Transparent over hero' }, { value: 'solid', label: 'Solid bar' }]),
    text('bookLabel', 'Book button text'),
    toggle('sticky', 'Stick to top while scrolling')
  ],
  announcement: [
    toggle('enabled', 'Show announcement bar'), text('text', 'Message'), text('linkLabel', 'Link text'), target('target', 'Link opens')
  ],
  contact: [
    text('phone', 'Phone'), text('whatsapp', 'WhatsApp number (with country code, e.g. 18765551234)'),
    text('email', 'Email'), area('address', 'Address'), text('mapQuery', 'Map search (defaults to address)')
  ],
  social: [
    text('instagramUrl', 'Instagram link'), text('facebookUrl', 'Facebook link'), text('tiktokUrl', 'TikTok link'),
    text('youtubeUrl', 'YouTube link'), text('xUrl', 'X / Twitter link')
  ],
  music: [
    toggle('enabled', 'Play theme music'),
    media('url', 'Music file', 'audio', 'music'),
    text('title', 'Track name (shown on the player)'),
    range('volume', 'Volume', 0.05, 1, 0.05),
    toggle('autoplay', 'Try to start automatically (falls back to a play button)')
  ],
  seo: [
    text('title', 'Browser tab / Google title'), area('description', 'Google description (150 characters)')
  ],
  footer: [area('text', 'Footer text')]
};

export const STYLE_FIELDS = [
  { key: 'colors.background', label: 'Page background', type: 'color' },
  { key: 'colors.surface', label: 'Cards & panels', type: 'color' },
  { key: 'colors.text', label: 'Main text', type: 'color' },
  { key: 'colors.muted', label: 'Secondary text', type: 'color' },
  { key: 'colors.primary', label: 'Brand / button colour', type: 'color' },
  { key: 'colors.primaryText', label: 'Button text', type: 'color' },
  { key: 'colors.accent', label: 'Accent / highlight', type: 'color' },
  { key: 'colors.heroText', label: 'Text over photos', type: 'color' },
  { key: 'headingFont', label: 'Heading font', type: 'select', options: FONT_OPTIONS.map((f) => ({ value: f, label: f })) },
  { key: 'bodyFont', label: 'Body font', type: 'select', options: FONT_OPTIONS.map((f) => ({ value: f, label: f })) },
  { key: 'headingCase', label: 'Heading style', type: 'select', options: [{ value: 'none', label: 'Normal' }, { value: 'uppercase', label: 'UPPERCASE' }] },
  { key: 'radius', label: 'Corner roundness', type: 'range', min: 0, max: 32, step: 2 },
  { key: 'buttonShape', label: 'Button shape', type: 'select', options: [{ value: 'rounded', label: 'Rounded' }, { value: 'pill', label: 'Pill' }, { value: 'square', label: 'Square' }] },
  { key: 'buttonStyle', label: 'Button style', type: 'select', options: [{ value: 'solid', label: 'Solid' }, { value: 'outline', label: 'Outline' }] },
  { key: 'animations', label: 'Scroll animations', type: 'toggle' },
  { key: 'syncBookingColors', label: 'Booking widget follows brand colour', type: 'toggle' }
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge(base, override) {
  if (!isPlainObject(base)) return override === undefined ? base : override;
  if (!isPlainObject(override)) return override === undefined ? { ...base } : override;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return out;
}

export function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

let idCounter = 0;
export function makeSectionId(type) {
  idCounter += 1;
  return `${type}-${Date.now().toString(36)}${idCounter}`;
}

const BASE_SITE = {
  enabled: true,
  layoutMode: 'pages',
  style: {
    mode: 'light',
    colors: {
      background: '#ffffff', surface: '#f6f6f8', text: '#16161d', muted: '#5d6070',
      primary: '#5b4ff5', primaryText: '#ffffff', accent: '#f5b84f', heroText: '#ffffff'
    },
    headingFont: 'Plus Jakarta Sans', bodyFont: 'Inter', headingCase: 'none',
    radius: 14, buttonShape: 'rounded', buttonStyle: 'solid', animations: true, syncBookingColors: true
  },
  brand: { logoUrl: '', name: '', tagline: '', showNameWithLogo: true },
  nav: { style: 'transparent', bookLabel: 'Book now', sticky: true },
  announcement: { enabled: false, text: '', linkLabel: 'Book now', target: 'book' },
  contact: { phone: '', whatsapp: '', email: '', address: '', mapQuery: '' },
  social: {},
  music: { enabled: false, url: '', title: '', volume: 0.35, autoplay: true },
  seo: { title: '', description: '' },
  footer: { text: '' },
  pages: []
};

function normalizeSections(sections, presetSections = []) {
  return (sections || [])
    .filter((section) => section && SECTION_TYPES[section.type])
    .map((section) => {
      const presetMatch = presetSections.find((p) => p.id === section.id) || presetSections.find((p) => p.type === section.type);
      return {
        id: section.id || makeSectionId(section.type),
        type: section.type,
        visible: section.visible !== false,
        props: deepMerge(deepMerge(SECTION_DEFAULTS[section.type] || {}, presetMatch && !section.props ? presetMatch.props : {}), section.props || {})
      };
    });
}

/**
 * Resolve the complete website document:
 *   BASE_SITE  ←  theme preset  ←  tenant's saved site
 * Pages/sections from the saved site replace the preset's (so deleting a
 * section sticks), while every section's props are completed with defaults.
 */
export function resolveSite(tenant, preset, saved) {
  const presetSite = preset?.site || {};
  const base = deepMerge(BASE_SITE, { ...presetSite, pages: undefined });
  const merged = deepMerge(base, saved ? { ...saved, pages: undefined } : {});

  const presetPages = presetSite.pages || [];
  const sourcePages = saved?.pages?.length ? saved.pages : presetPages;
  const pages = PAGE_IDS.map((id) => {
    const page = sourcePages.find((p) => p.id === id);
    const presetPage = presetPages.find((p) => p.id === id) || {};
    if (!page) return { id, label: PAGE_LABELS[id], visible: id === 'home' || id === 'book', sections: normalizeSections(presetPage.sections || []) };
    return {
      id,
      label: page.label || presetPage.label || PAGE_LABELS[id],
      visible: id === 'home' || id === 'book' ? true : page.visible !== false,
      sections: normalizeSections(page.sections, presetPage.sections)
    };
  });

  // The Book page always contains the booking widget.
  const bookPage = pages.find((p) => p.id === 'book');
  if (!bookPage.sections.some((s) => s.type === 'booking')) {
    bookPage.sections.push({ id: 'booking-main', type: 'booking', visible: true, props: { ...SECTION_DEFAULTS.booking } });
  }
  bookPage.sections.forEach((s) => { if (s.type === 'booking') s.visible = true; });

  // Order pages: keep saved order but Home first and Book last.
  const order = (saved?.pages?.length ? saved.pages.map((p) => p.id) : presetPages.map((p) => p.id)).filter((id) => PAGE_IDS.includes(id));
  pages.sort((a, b) => {
    if (a.id === 'home') return -1;
    if (b.id === 'home') return 1;
    if (a.id === 'book') return 1;
    if (b.id === 'book') return -1;
    return (order.indexOf(a.id) + 99) % 100 - (order.indexOf(b.id) + 99) % 100;
  });

  merged.pages = pages;
  merged.brand = { ...merged.brand, name: merged.brand.name || tenant?.name || '' };
  if (!merged.contact.address && tenant?.branding?.location) merged.contact = { ...merged.contact, address: tenant.branding.location };
  if (!merged.brand.logoUrl && tenant?.branding?.logoUrl) merged.brand = { ...merged.brand, logoUrl: tenant.branding.logoUrl };
  if (!merged.brand.tagline && tenant?.branding?.bookingTagline) merged.brand = { ...merged.brand, tagline: tenant.branding.bookingTagline };
  return merged;
}

/** The catalogue the builder needs, posted from the preview iframe. */
export function builderCatalog() {
  return {
    sectionTypes: SECTION_TYPES,
    sectionDefaults: SECTION_DEFAULTS,
    globalFields: GLOBAL_FIELDS,
    styleFields: STYLE_FIELDS,
    mediaGuide: MEDIA_GUIDE,
    pageIds: PAGE_IDS,
    pageLabels: PAGE_LABELS
  };
}

export function hexToRgba(hex, alpha) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!match) return `rgba(0,0,0,${alpha})`;
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export function isSafeMediaUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  if (/^\/media\/[0-9a-f-]{36}$/i.test(value)) return true;
  return /^https?:\/\//i.test(value);
}

export function youtubeOrVimeoEmbed(url) {
  const value = String(url || '');
  const yt = value.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1`;
  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

/** CSS custom properties for a resolved site style. */
export function siteCssVars(style) {
  const c = style.colors || {};
  return {
    '--site-bg': c.background,
    '--site-surface': c.surface,
    '--site-text': c.text,
    '--site-muted': c.muted,
    '--site-primary': c.primary,
    '--site-primary-text': c.primaryText,
    '--site-accent': c.accent,
    '--site-hero-text': c.heroText,
    '--site-border': hexToRgba(c.text, 0.12),
    '--site-primary-soft': hexToRgba(c.primary, 0.12),
    '--site-radius': `${Number(style.radius ?? 14)}px`,
    '--site-btn-radius': style.buttonShape === 'pill' ? '999px' : style.buttonShape === 'square' ? '0px' : `${Math.max(6, Number(style.radius ?? 14) * 0.6)}px`,
    '--site-heading-font': `'${style.headingFont}', Georgia, serif`,
    '--site-body-font': `'${style.bodyFont}', system-ui, sans-serif`,
    '--site-heading-case': style.headingCase === 'uppercase' ? 'uppercase' : 'none',
    '--site-heading-spacing': style.headingCase === 'uppercase' ? '0.04em' : '-0.02em'
  };
}
