import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

function tradePreset(kit) {
  const { key, name, art, trade, services } = kit;
  const { accent, background, font, eyebrow, headline, intro, visit } = trade;
  const nextStep = 'Choose a time to discuss the work. We’ll agree the scope, service location and price before any work begins.';
  const fallback = `linear-gradient(135deg, #17242c, ${accent})`;

  return {
    key, label: name, fallback,
    demo: { name, tagline: eyebrow, location: 'Jamaica', services: services.map(service => ({ ...service, active: true })) },
    site: {
      style: {
        mode: 'light',
        colors: { background, surface: '#ffffff', text: '#18252b', muted: '#48575e', primary: accent, primaryText: '#ffffff', accent, heroText: '#ffffff' },
        headingFont: font, bodyFont: 'Inter', headingCase: 'none', radius: 10, buttonShape: 'rounded', buttonStyle: 'solid'
      },
      brand: { tagline: eyebrow },
      nav: { style: 'solid', bookLabel: 'Book a time' },
      booking: { footerNote: nextStep },
      pages: [
        page('home', [
          section('hero', 'hero', {
            mediaType: 'image', imageUrl: art, mobileImageUrl: art.replace('.webp', '-mobile.webp'),
            overlay: 0.63, height: 'tall', align: 'left', eyebrow, headline, subheadline: intro,
            ctaLabel: 'Book a time', ctaTarget: 'book', secondaryLabel: 'See services', secondaryTarget: 'about'
          }),
          section('services', 'services', { title: 'What we can help with', showPrices: false, showDuration: true, ctaLabel: 'See available times' }),
          section('first-appointment', 'intro', {
            title: 'Tell us what you need', body: visit, imageUrl: art, imageSide: 'right',
            ctaLabel: 'How it works', ctaTarget: 'gallery'
          })
        ]),
        page('about', [
          section('services-header', 'pageHeader', { title: 'Services', subtitle: intro, imageUrl: art, overlay: 0.68 }),
          section('services-list', 'services', { title: eyebrow, subtitle: nextStep, showPrices: false, showDuration: true })
        ], { label: 'Services' }),
        page('gallery', [
          section('process-header', 'pageHeader', { title: 'How it works', subtitle: nextStep, imageUrl: art, overlay: 0.68 }),
          section('process-steps', 'highlights', { title: 'From first call to a quote', items: [
            { title: 'Describe the work', text: visit },
            { title: 'Discuss the job', text: 'Choose a time to talk. We’ll let you know if we need to see the property before quoting.' },
            { title: 'Agree the price and timing', text: 'Confirm the scope, materials and any visit fees before the work goes ahead.' }
          ] }),
          section('process-cta', 'cta', { title: 'Pick a time to talk', buttonLabel: 'Book a time', target: 'book' })
        ], { label: 'How it works' }),
        page('book', [
          section('book-header', 'pageHeader', { title: 'Book a time', subtitle: nextStep, imageUrl: art, overlay: 0.72 }),
          section('booking-main', 'booking', { title: '' })
        ])
      ]
    }
  };
}

export const TRADE_PRESETS = Object.fromEntries(kits.filter(kit => kit.trade).map(kit => [kit.key, tradePreset(kit)]));
