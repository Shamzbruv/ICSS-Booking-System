// Blush & Braids — soft blush salon with a glossy editorial feel.
import { hero, portrait, square, banner, tile, page, section } from './helpers';

export default {
  key: 'hairdresser',
  label: 'Blush & Braids',
  fallback: 'linear-gradient(135deg, #fbf1f2 0%, #eac7cd 55%, #b3546a 140%)',
  demo: {
    name: 'Blush & Braids Salon',
    tagline: 'Healthy hair, beautifully styled.',
    location: 'Half Way Tree, Kingston',
    services: [
      { name: 'Knotless Braids', description: 'Medium knotless braids, waist length.', duration_minutes: 300, price: 18000 },
      { name: 'Silk Press', description: 'Wash, deep condition and silk press.', duration_minutes: 120, price: 8500 },
      { name: 'Balayage / Highlights', description: 'Hand-painted colour with toner and gloss.', duration_minutes: 150, price: 22000 },
      { name: 'Blowout & Style', description: 'Wash, blow-dry and finish.', duration_minutes: 45, price: 5500 }
    ]
  },
  site: {
    style: {
      mode: 'light',
      colors: { background: '#fdf8f8', surface: '#ffffff', text: '#2b1a20', muted: '#7f6069', primary: '#b3546a', primaryText: '#ffffff', accent: '#e8b4a0', heroText: '#ffffff' },
      headingFont: 'DM Serif Display', bodyFont: 'Poppins', headingCase: 'none', radius: 20, buttonShape: 'pill', buttonStyle: 'solid'
    },
    nav: { style: 'transparent', bookLabel: 'Book your style' },
    footer: { text: 'Braids, colour and healthy hair care.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: hero('1560066984-138dadb4c035'), mobileImageUrl: '', overlay: 0.35, align: 'center', height: 'full',
          eyebrow: 'Hair studio', headline: 'Hair that turns heads', subheadline: 'Braids, silk presses and colour by stylists who treat your hair like their own.',
          ctaLabel: 'Book your style', ctaTarget: 'book', secondaryLabel: 'See our looks', secondaryTarget: 'gallery'
        }),
        section('services', 'services', { title: 'Signature services', subtitle: 'Consultations are always free.', limit: 6 }),
        section('gallery-preview', 'gallery', { title: 'Latest looks', layout: 'grid', aspect: '4/5', images: [
          { url: tile('1522337360788-8b13dee7a37e') }, { url: tile('1562322140-8baeececf3df') }, { url: tile('1595476108010-b4d1f102b1b1') }
        ] }),
        section('intro', 'intro', {
          eyebrow: 'Our promise', title: 'Healthy hair first', body: 'Gentle tension, quality hair and products that protect your edges. Every appointment starts with a consultation about your hair goals.',
          imageUrl: portrait('1562322140-8baeececf3df'), imageSide: 'right', ctaLabel: 'Meet the stylists', ctaTarget: 'about'
        }),
        section('testimonials', 'testimonials', { title: 'Client love', items: [
          { quote: 'My braids were neat, light and lasted 8 weeks. Booking again!', name: 'Kadian L.', role: 'Knotless braids' },
          { quote: 'The silk press was bouncy for days. Obsessed.', name: 'Renee S.', role: 'Silk press' }
        ] }),
        section('contact', 'contact', { title: 'Visit the salon', hours: [{ day: 'Tue – Sat', time: '8:00 am – 7:00 pm' }, { day: 'Sun – Mon', time: 'Closed' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'About the salon', subtitle: 'Where your hair gets the care it deserves.', imageUrl: banner('1522337360788-8b13dee7a37e'), overlay: 0.4 }),
        section('about-team', 'team', { title: 'Our stylists', members: [
          { name: 'Brianna', role: 'Founder · Braid artist', bio: 'Knotless, boho and stitch braids.', photoUrl: square('1595476108010-b4d1f102b1b1') },
          { name: 'Tashi', role: 'Colour specialist', bio: 'Balayage, gloss and colour correction.', photoUrl: square('1522337360788-8b13dee7a37e') }
        ] }),
        section('about-faq', 'faq', { items: [
          { q: 'Is hair included for braids?', a: 'Yes, premium pre-stretched braiding hair is included.' },
          { q: 'Should I arrive with washed hair?', a: 'Please arrive with clean, detangled, blow-dried hair for braiding services.' }
        ] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'Lookbook', subtitle: 'Braids, colour and silk presses.', imageUrl: banner('1560066984-138dadb4c035'), overlay: 0.35 }),
        section('gallery-main', 'gallery', { title: '', layout: 'masonry', aspect: '4/5', images: [
          { url: tile('1522337360788-8b13dee7a37e') }, { url: tile('1562322140-8baeececf3df') }, { url: tile('1595476108010-b4d1f102b1b1') },
          { url: tile('1560066984-138dadb4c035') }, { url: tile('1522337360788-8b13dee7a37e') }, { url: tile('1562322140-8baeececf3df') }
        ] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Book your style', subtitle: 'Choose a service, stylist and time.', imageUrl: banner('1595476108010-b4d1f102b1b1'), overlay: 0.4 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
