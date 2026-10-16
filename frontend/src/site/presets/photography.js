// Lumina Lens — minimal black-and-white editorial portfolio.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'photography',
  label: 'Lumina Lens',
  fallback: 'linear-gradient(135deg, #0d0d0d 0%, #2a2a2a 60%, #d9c9a8 140%)',
  demo: {
    name: 'Lumina Lens Photography',
    tagline: 'Light, captured honestly.',
    location: 'Kingston & island-wide',
    services: [
      { name: 'Portrait Session', description: '60 minutes, 2 looks, 25 edited images.', duration_minutes: 60, price: 35000 },
      { name: 'Couple / Engagement', description: '90 minutes on location, 40 edited images.', duration_minutes: 90, price: 55000 },
      { name: 'Brand & Product Shoot', description: 'Half-day studio session for your business.', duration_minutes: 240, price: 95000 },
      { name: 'Discovery Call', description: 'Plan your shoot, locations and styling.', duration_minutes: 20, price: 0 }
    ]
  },
  site: {
    style: {
      mode: 'dark',
      colors: { background: '#0d0d0d', surface: '#171717', text: '#f2f0ec', muted: '#a09c94', primary: '#f2f0ec', primaryText: '#0d0d0d', accent: '#d9c9a8', heroText: '#ffffff' },
      headingFont: 'Cormorant Garamond', bodyFont: 'Space Grotesk', headingCase: 'none', radius: 0, buttonShape: 'square', buttonStyle: 'outline'
    },
    nav: { style: 'transparent', bookLabel: 'Book a shoot' },
    footer: { text: 'Portraits, couples and brand photography.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: hero('1516035069371-29a1b244cc32'), overlay: 0.35, align: 'center', height: 'full',
          eyebrow: 'Photography studio', headline: 'Light, captured honestly', subheadline: 'Portraits, couples and brand stories with a quiet, timeless eye.',
          ctaLabel: 'Book a shoot', ctaTarget: 'book', secondaryLabel: 'View portfolio', secondaryTarget: 'gallery'
        }),
        section('gallery-preview', 'gallery', { title: 'Selected work', layout: 'masonry', aspect: '4/5', images: [
          { url: tile('1452587925148-ce544e77e70d') }, { url: tile('1502920917128-1aa500764cbd') }, { url: tile('1554080353-a576cf803bda') },
          { url: tile('1516035069371-29a1b244cc32') }, { url: tile('1452587925148-ce544e77e70d') }, { url: tile('1502920917128-1aa500764cbd') }
        ] }),
        section('intro', 'intro', {
          eyebrow: 'Hello', title: 'Unposed, unhurried, unmistakably you', body: 'I guide gently and let the real moments happen. Every session is planned around light, location and the story you want to tell.',
          imageUrl: portrait('1554080353-a576cf803bda'), imageSide: 'left', ctaLabel: 'About me', ctaTarget: 'about'
        }),
        section('services', 'services', { title: 'Sessions', subtitle: 'Every session includes a private online gallery.', limit: 4 }),
        section('testimonials', 'testimonials', { title: 'Kind words', items: [
          { quote: 'We cried when we saw our engagement photos. Absolutely stunning.', name: 'Kerry-Ann & Paul', role: 'Engagement session' },
          { quote: 'Our brand photos lifted our whole website.', name: 'Island Roots Co.', role: 'Brand shoot' }
        ] }),
        section('cta', 'cta', { title: 'Let’s make something timeless', text: 'Limited sessions each month.', buttonLabel: 'Check availability', target: 'book', imageUrl: banner('1502920917128-1aa500764cbd') })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'About', subtitle: 'The person behind the lens.', imageUrl: banner('1554080353-a576cf803bda'), overlay: 0.4 }),
        section('about-story', 'intro', { eyebrow: 'Photographer', title: 'Ten years of chasing light', body: 'From golden-hour beaches to minimal studio portraits, my work is about honesty, texture and connection. Based in Kingston, available island-wide.', imageUrl: portrait('1516035069371-29a1b244cc32'), imageSide: 'right' }),
        section('about-faq', 'faq', { items: [
          { q: 'When will I receive my photos?', a: 'Sneak peeks in 48 hours; full galleries within 2 weeks.' },
          { q: 'Do you help with styling?', a: 'Yes — every booking includes a styling and location guide.' }
        ] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'Portfolio', imageUrl: banner('1452587925148-ce544e77e70d'), overlay: 0.4 }),
        section('gallery-main', 'gallery', { title: '', layout: 'masonry', aspect: '4/5', images: [
          { url: tile('1452587925148-ce544e77e70d') }, { url: tile('1502920917128-1aa500764cbd') }, { url: tile('1554080353-a576cf803bda') },
          { url: tile('1516035069371-29a1b244cc32') }, { url: tile('1452587925148-ce544e77e70d') }, { url: tile('1502920917128-1aa500764cbd') },
          { url: tile('1554080353-a576cf803bda') }, { url: tile('1516035069371-29a1b244cc32') }, { url: tile('1452587925148-ce544e77e70d') }
        ] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Book a shoot', subtitle: 'Choose a session and a date.', imageUrl: banner('1516035069371-29a1b244cc32'), overlay: 0.45 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
