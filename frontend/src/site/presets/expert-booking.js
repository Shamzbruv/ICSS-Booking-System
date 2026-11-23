import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find(item => item.key === 'expert-booking');
const tagline = 'Consultations by appointment';

export default {
  key: kit.key,
  label: kit.name,
  fallback: 'linear-gradient(135deg, #0e263b, #16665d)',
  demo: {
    name: 'Andre Reid Advisory',
    tagline: 'Tech strategy, software and practical advice',
    location: 'Kingston, Jamaica · Online consultations',
    services: kit.services.map((service, index) => ({
      ...service, active: true, price: [0, 4500, 7500][index]
    }))
  },
  site: {
    enabled: false,
    style: {
      colors: { background: '#f3f7f8', surface: '#fff', text: '#122837', muted: '#486475', primary: '#12665c', primaryText: '#fff', accent: '#12665c' },
      headingFont: 'Manrope', bodyFont: 'Inter', radius: 12
    },
    brand: { tagline },
    nav: { style: 'solid', bookLabel: 'Book a consultation' },
    booking: { footerNote: 'When booking, share a brief description of what you’d like to cover.' },
    pages: [
      page('home', [
        section('home-intro', 'intro', {
          title: 'Book time for expert advice',
          body: 'Choose the session that fits what you’re working on and tell me what you’d like to discuss.',
          ctaLabel: 'See available times', ctaTarget: 'book'
        })
      ]),
      page('book', [
        section('booking-main', 'booking', { title: 'Book a consultation' })
      ], { label: 'Book a consultation' })
    ]
  }
};
