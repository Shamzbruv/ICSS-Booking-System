// Botanica Spa — airy botanical calm with sage and linen tones.
import { hero, portrait, square, banner, tile, page, section } from './helpers';

export default {
  key: 'spa',
  label: 'Botanica Spa',
  fallback: 'linear-gradient(135deg, #e9efe6 0%, #c9d8c5 55%, #6f8f6b 140%)',
  demo: {
    name: 'Botanica Spa',
    tagline: 'Slow down. Breathe in. Leave renewed.',
    location: 'Ocho Rios, St. Ann',
    services: [
      { name: 'Signature Botanical Facial', description: 'Cleanse, exfoliate, mask and lymphatic massage.', duration_minutes: 75, price: 12500 },
      { name: 'Aromatherapy Massage', description: 'Full-body massage with custom essential oils.', duration_minutes: 90, price: 15000 },
      { name: 'Hot Stone Ritual', description: 'Warm basalt stones melt tension from head to toe.', duration_minutes: 80, price: 14000 },
      { name: 'Couples Retreat', description: 'Side-by-side massages with herbal tea service.', duration_minutes: 90, price: 27000 }
    ]
  },
  site: {
    style: {
      mode: 'light',
      colors: { background: '#f7f6f1', surface: '#ffffff', text: '#2c3a2b', muted: '#6e7a6b', primary: '#6f8f6b', primaryText: '#ffffff', accent: '#c7a37a', heroText: '#ffffff' },
      headingFont: 'Cormorant Garamond', bodyFont: 'Jost', headingCase: 'none', radius: 22, buttonShape: 'pill', buttonStyle: 'solid'
    },
    nav: { style: 'transparent', bookLabel: 'Reserve a ritual' },
    footer: { text: 'A sanctuary for rest and renewal.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: hero('1544161515-4ab6ce6db874'), overlay: 0.35, align: 'center', height: 'full',
          eyebrow: 'Day spa & wellness', headline: 'Rest is a ritual', subheadline: 'Botanical facials, massage and body therapies designed to quiet the mind.',
          ctaLabel: 'Reserve a ritual', ctaTarget: 'book', secondaryLabel: 'Our philosophy', secondaryTarget: 'about'
        }),
        section('highlights', 'highlights', { title: 'The Botanica way', items: [
          { icon: '🌿', title: 'Plant-based', text: 'Locally sourced oils, clays and botanicals.' },
          { icon: '🕯️', title: 'Unhurried', text: 'Every treatment includes time to arrive and unwind.' },
          { icon: '💧', title: 'Restorative', text: 'Hydrotherapy and tea lounge after every visit.' }
        ] }),
        section('intro', 'intro', {
          eyebrow: 'Welcome', title: 'A sanctuary minutes from the sea', body: 'Step out of the noise and into a space of linen, light and greenery. Our therapists tailor every treatment to how you feel today.',
          imageUrl: portrait('1540555700478-4be289fbecef'), imageSide: 'right', ctaLabel: 'Explore treatments', ctaTarget: 'book'
        }),
        section('services', 'services', { title: 'Treatments', subtitle: 'Each ritual begins with a consultation and ends with herbal tea.', limit: 4 }),
        section('gallery-preview', 'gallery', { title: 'Inside the spa', layout: 'carousel', aspect: '4/5', images: [
          { url: tile('1600334089648-b0d9d3028eb2') }, { url: tile('1570172619644-dfd03ed5d881') }, { url: tile('1544161515-4ab6ce6db874') }, { url: tile('1540555700478-4be289fbecef') }
        ] }),
        section('testimonials', 'testimonials', { title: 'Kind words', items: [
          { quote: 'I floated out of the aromatherapy massage. Pure calm from the moment I arrived.', name: 'Simone R.', role: 'Spa member' },
          { quote: 'The facial left my skin glowing for a week.', name: 'Alicia M.', role: 'Visiting from Toronto' }
        ] }),
        section('contact', 'contact', { title: 'Visit the sanctuary', hours: [{ day: 'Mon – Sat', time: '9:00 am – 8:00 pm' }, { day: 'Sunday', time: '10:00 am – 6:00 pm' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'Our philosophy', subtitle: 'Nature-led care for body and mind.', imageUrl: banner('1600334089648-b0d9d3028eb2'), overlay: 0.35 }),
        section('about-story', 'intro', { eyebrow: 'Our roots', title: 'Grown from the garden', body: 'Botanica began in a small garden studio. We still blend our own oils from island herbs and flowers, and every therapist trains in mindful touch.', imageUrl: portrait('1570172619644-dfd03ed5d881'), imageSide: 'left' }),
        section('about-team', 'team', { title: 'Our therapists', members: [
          { name: 'Nadine', role: 'Lead therapist', bio: 'Massage and hot stone specialist.', photoUrl: square('1540555700478-4be289fbecef') },
          { name: 'Keisha', role: 'Skin specialist', bio: 'Facials and botanical skincare.', photoUrl: square('1570172619644-dfd03ed5d881') }
        ] }),
        section('about-faq', 'faq', { items: [
          { q: 'What should I bring?', a: 'Just yourself. Robes, slippers and towels are provided.' },
          { q: 'When should I arrive?', a: 'Fifteen minutes early to enjoy the tea lounge.' }
        ] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'The space', subtitle: 'Light, linen and greenery.', imageUrl: banner('1544161515-4ab6ce6db874'), overlay: 0.35 }),
        section('gallery-main', 'gallery', { title: '', layout: 'grid', aspect: '4/5', images: [
          { url: tile('1600334089648-b0d9d3028eb2') }, { url: tile('1570172619644-dfd03ed5d881') }, { url: tile('1544161515-4ab6ce6db874') },
          { url: tile('1540555700478-4be289fbecef') }, { url: tile('1600334089648-b0d9d3028eb2') }, { url: tile('1570172619644-dfd03ed5d881') }
        ] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Reserve your ritual', subtitle: 'Choose a treatment and a time that suits you.', imageUrl: banner('1540555700478-4be289fbecef'), overlay: 0.35 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
