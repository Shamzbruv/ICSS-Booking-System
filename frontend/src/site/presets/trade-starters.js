import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };
import { TRADE_CONTENT } from './trade-content.js';

function tradePreset(kit) {
  const { key, name, art, trade, services } = kit;
  const { accent, background, font, eyebrow, headline, intro, visit } = trade;
  const { title, scope, assessment, questions, contact } = TRADE_CONTENT[key];
  const bookLabel = 'Request a quote';
  const nextStep = 'Choose a time to discuss the work. We’ll agree on the service location, scope and price before any work begins.';
  const appointments = { showPrices: false, showDuration: true, ctaLabel: 'See available times' };
  const fallback = `linear-gradient(135deg, #17242c, ${accent})`;

  return {
    key, label: name, fallback,
    demo: {
      name, tagline: eyebrow,
      services: services.map(service => ({ ...service, active: true })),
      contact: { ...contact, hours: [{ day: 'Mon – Fri', time: '8:00 am – 5:00 pm' }, { day: 'Sat', time: 'By appointment' }] }
    },
    site: {
      style: {
        mode: 'light',
        colors: { background, surface: '#ffffff', text: '#18252b', muted: '#48575e', primary: accent, primaryText: '#ffffff', accent, heroText: '#ffffff' },
        headingFont: font, bodyFont: 'Inter', headingCase: 'none', radius: 14, buttonShape: 'rounded', buttonStyle: 'solid'
      },
      brand: { tagline: eyebrow },
      nav: { style: 'solid', bookLabel },
      booking: { footerNote: 'Share your parish and community. You can confirm the exact address with the business directly.' },
      pages: [
        page('home', [
          section('hero', 'hero', {
            mediaType: 'image', imageUrl: art, mobileImageUrl: art.replace('.webp', '-mobile.webp'),
            overlay: 0.59, height: 'tall', align: 'left', eyebrow, headline, subheadline: intro,
            ctaLabel: bookLabel, ctaTarget: 'book', secondaryLabel: 'See services', secondaryTarget: 'about'
          }),
          section('work-overview', 'highlights', { title, items: scope }),
          section('home-cta', 'cta', { title: 'Tell us what you’re working on', text: 'Have your parish and community on hand when choosing a time to talk.', buttonLabel: 'See how it works', target: 'gallery' }),
          section('contact', 'contact', {
            title: 'Service area and contact',
            subtitle: 'Ask about travel to your community and available times when you book.',
            showMap: false
          })
        ]),
        page('about', [
          section('services-header', 'pageHeader', { title, subtitle: intro, imageUrl: art, overlay: 0.68 }),
          section('work-details', 'highlights', { title: 'Types of work', items: scope }),
          section('services-list', 'services', { title: 'Book a call or assessment', subtitle: nextStep, ...appointments })
        ], { label: 'Services' }),
        page('gallery', [
          section('process-header', 'pageHeader', { title: 'How quotes and visits work', subtitle: nextStep, imageUrl: art, overlay: 0.68 }),
          section('process-steps', 'highlights', { title: 'From first enquiry to a quote', items: [
            { title: 'Describe the work', text: visit },
            { title: 'Discuss the job', text: assessment },
            { title: 'Agree on scope and timing', text: 'We’ll discuss the work, materials and any visit fees with you before the job goes ahead.' }
          ] }),
          section('process-faq', 'faq', { title: 'Before you book', items: questions }),
          section('process-cta', 'cta', { title: 'Ready to discuss your job?', buttonLabel: bookLabel, target: 'book' })
        ], { label: 'How it works' }),
        page('book', [
          section('book-header', 'pageHeader', { title: 'Book a call or assessment', subtitle: nextStep, imageUrl: art, overlay: 0.72 }),
          section('booking-main', 'booking', { title: '' }),
          section('book-faq', 'faq', { title: 'Helpful booking details', items: questions })
        ], { label: 'Request a quote' })
      ]
    }
  };
}

export const TRADE_PRESETS = Object.fromEntries(kits.filter(kit => kit.trade).map(kit => [kit.key, tradePreset(kit)]));
