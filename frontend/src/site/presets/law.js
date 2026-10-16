// Meridian Law — authoritative navy and ivory with classic serif type.
import { hero, portrait, square, banner, tile, page, section } from './helpers';

export default {
  key: 'law',
  label: 'Meridian Law',
  fallback: 'linear-gradient(135deg, #0f1b2d 0%, #1f3352 55%, #b8955a 140%)',
  demo: {
    name: 'Meridian Law Chambers',
    tagline: 'Clear counsel. Decisive advocacy.',
    location: 'Duke Street, Kingston',
    services: [
      { name: 'Initial Consultation', description: 'Review of your matter and next-step advice.', duration_minutes: 30, price: 15000 },
      { name: 'Extended Consultation', description: 'In-depth strategy session with document review.', duration_minutes: 60, price: 27500 },
      { name: 'Property Transfer Review', description: 'Title, agreement and transfer documentation.', duration_minutes: 45, price: 20000 },
      { name: 'Estate Planning Session', description: 'Wills, trusts and power of attorney.', duration_minutes: 60, price: 25000 }
    ]
  },
  site: {
    style: {
      mode: 'light',
      colors: { background: '#f8f6f1', surface: '#ffffff', text: '#0f1b2d', muted: '#566275', primary: '#1f3352', primaryText: '#ffffff', accent: '#b8955a', heroText: '#fbf8f2' },
      headingFont: 'Libre Baskerville', bodyFont: 'DM Sans', headingCase: 'none', radius: 4, buttonShape: 'square', buttonStyle: 'solid'
    },
    nav: { style: 'solid', bookLabel: 'Book consultation' },
    footer: { text: 'Attorney advertising. Prior results do not guarantee a similar outcome.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: hero('1589829545856-d10d557cf95f'), overlay: 0.6, align: 'left', height: 'tall',
          eyebrow: 'Attorneys-at-law', headline: 'Counsel you can rely on', subheadline: 'Corporate, property, family and estate law with clear advice and fixed-fee consultations.',
          ctaLabel: 'Book a consultation', ctaTarget: 'book', secondaryLabel: 'Practice areas', secondaryTarget: 'about'
        }),
        section('highlights', 'highlights', { title: 'Practice areas', items: [
          { icon: '🏛️', title: 'Corporate & commercial', text: 'Incorporations, contracts and compliance.' },
          { icon: '🏠', title: 'Property & conveyancing', text: 'Sales, transfers and title matters.' },
          { icon: '👪', title: 'Family law', text: 'Divorce, custody and agreements.' },
          { icon: '📜', title: 'Wills & estates', text: 'Planning, probate and administration.' }
        ] }),
        section('stats', 'stats', { items: [{ value: '25+', label: 'Years of practice' }, { value: '1,800', label: 'Matters resolved' }, { value: '4', label: 'Senior attorneys' }] }),
        section('services', 'services', { title: 'Consultations', subtitle: 'Fixed fees. Confidential. In person or by video.', limit: 4 }),
        section('testimonials', 'testimonials', { title: 'Client testimonials', items: [
          { quote: 'Professional, responsive and honest about our options from day one.', name: 'R. Campbell', role: 'Commercial client' },
          { quote: 'They made a stressful property transfer straightforward.', name: 'S. Edwards', role: 'Property client' }
        ] }),
        section('contact', 'contact', { title: 'Our chambers', hours: [{ day: 'Mon – Fri', time: '8:30 am – 5:00 pm' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'The firm', subtitle: 'Integrity, discretion and results.', imageUrl: banner('1505664194779-8beaceb93744'), overlay: 0.6 }),
        section('about-story', 'intro', { eyebrow: 'Since 1999', title: 'A tradition of advocacy', body: 'Meridian Law represents individuals, families and businesses across Jamaica. We pair deep legal experience with plain-language advice so you always know where you stand.', imageUrl: portrait('1450101499163-c8848c66ca85'), imageSide: 'right' }),
        section('about-team', 'team', { title: 'Our attorneys', members: [
          { name: 'Patricia Morgan', role: 'Senior Partner', bio: 'Corporate and commercial law.', photoUrl: square('1521791055366-0d553872125f') },
          { name: 'Michael Reid', role: 'Partner', bio: 'Property and conveyancing.', photoUrl: square('1450101499163-c8848c66ca85') }
        ] }),
        section('about-faq', 'faq', { items: [
          { q: 'Is my consultation confidential?', a: 'Yes. Everything you share is protected by attorney-client privilege.' },
          { q: 'What should I bring?', a: 'Any documents, letters or contracts related to your matter.' }
        ] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'Our offices', imageUrl: banner('1589829545856-d10d557cf95f'), overlay: 0.6 }),
        section('gallery-main', 'gallery', { title: '', layout: 'grid', aspect: '3/2', images: [
          { url: tile('1505664194779-8beaceb93744') }, { url: tile('1450101499163-c8848c66ca85') }, { url: tile('1521791055366-0d553872125f') }
        ] })
      ], { visible: false }),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Book a consultation', subtitle: 'Choose a consultation type and time.', imageUrl: banner('1505664194779-8beaceb93744'), overlay: 0.6 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
