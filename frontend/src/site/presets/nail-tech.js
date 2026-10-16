// Elegant Nails — playful lilac and pink boutique with high-fashion type.
import { hero, portrait, square, banner, tile, page, section } from './helpers';

export default {
  key: 'nail-tech',
  label: 'Elegant Nails',
  fallback: 'linear-gradient(135deg, #fbf3fb 0%, #e9cde9 55%, #b3478f 140%)',
  demo: {
    name: 'Elegant Nails Studio',
    tagline: 'Little luxuries, perfectly polished.',
    location: 'Sovereign Centre, Kingston',
    services: [
      { name: 'Acrylic Full Set', description: 'Sculpted acrylic with shape and colour of choice.', duration_minutes: 90, price: 7500 },
      { name: 'Gel Manicure', description: 'Cuticle care, shaping and long-wear gel.', duration_minutes: 60, price: 4500 },
      { name: 'Luxury Pedicure', description: 'Soak, scrub, mask, massage and polish.', duration_minutes: 60, price: 5000 },
      { name: 'Nail Art (per set)', description: 'Chrome, French, ombré or hand-painted designs.', duration_minutes: 30, price: 2000 }
    ]
  },
  site: {
    style: {
      mode: 'light',
      colors: { background: '#fdf7fc', surface: '#ffffff', text: '#2e1a2b', muted: '#7d6079', primary: '#b3478f', primaryText: '#ffffff', accent: '#f2a7c9', heroText: '#ffffff' },
      headingFont: 'Italiana', bodyFont: 'Montserrat', headingCase: 'uppercase', radius: 24, buttonShape: 'pill', buttonStyle: 'solid'
    },
    nav: { style: 'transparent', bookLabel: 'Book your set' },
    footer: { text: 'Manicures, pedicures and nail art.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: hero('1604654894610-df63bc536371'), overlay: 0.3, align: 'center', height: 'full',
          eyebrow: 'Nail studio', headline: 'Polished to perfection', subheadline: 'Acrylics, gel and custom nail art in a calm, spotless studio.',
          ctaLabel: 'Book your set', ctaTarget: 'book', secondaryLabel: 'Nail art gallery', secondaryTarget: 'gallery'
        }),
        section('gallery-preview', 'gallery', { title: 'This week’s sets', layout: 'grid', aspect: '1/1', images: [
          { url: tile('1519014816548-bf5fe059798b') }, { url: tile('1610992015732-2449b76344bc') }, { url: tile('1632345031435-8727f6897d53') },
          { url: tile('1604654894610-df63bc536371') }, { url: tile('1519014816548-bf5fe059798b') }, { url: tile('1610992015732-2449b76344bc') }
        ] }),
        section('services', 'services', { title: 'Menu', subtitle: 'Hospital-grade sterilisation on every tool.', limit: 6 }),
        section('highlights', 'highlights', { title: 'The Elegant difference', items: [
          { icon: '💅', title: 'Long-lasting', text: 'Gel that stays glossy for 3+ weeks.' },
          { icon: '🧼', title: 'Spotless', text: 'Sterilised tools and fresh files for every client.' },
          { icon: '🎨', title: 'Custom art', text: 'Bring your inspo — we’ll bring it to life.' }
        ] }),
        section('testimonials', 'testimonials', { title: 'Happy hands', items: [
          { quote: 'My chrome set lasted a month without a single chip!', name: 'Jada C.', role: 'Gel manicure' },
          { quote: 'So relaxing and the nail art is unreal.', name: 'Monique F.', role: 'Acrylic full set' }
        ] }),
        section('contact', 'contact', { title: 'Visit the studio', hours: [{ day: 'Mon – Sat', time: '9:00 am – 7:00 pm' }, { day: 'Sunday', time: '11:00 am – 4:00 pm' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'About us', subtitle: 'A little luxury, every visit.', imageUrl: banner('1610992015732-2449b76344bc'), overlay: 0.3 }),
        section('about-story', 'intro', { eyebrow: 'Our story', title: 'Detail is everything', body: 'Elegant Nails started as a home studio and grew through word of mouth. We still obsess over clean cuticles, perfect shape and polish that lasts.', imageUrl: portrait('1632345031435-8727f6897d53'), imageSide: 'left' }),
        section('about-team', 'team', { title: 'Nail artists', members: [
          { name: 'Shantel', role: 'Lead nail artist', bio: 'Acrylic sculpting and 3D art.', photoUrl: square('1519014816548-bf5fe059798b') },
          { name: 'Gabby', role: 'Pedicure specialist', bio: 'Spa pedicures and gel toes.', photoUrl: square('1632345031435-8727f6897d53') }
        ] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'Nail art gallery', subtitle: 'Save your favourite and show us at your appointment.', imageUrl: banner('1604654894610-df63bc536371'), overlay: 0.3 }),
        section('gallery-main', 'gallery', { title: '', layout: 'grid', aspect: '1/1', images: [
          { url: tile('1519014816548-bf5fe059798b') }, { url: tile('1610992015732-2449b76344bc') }, { url: tile('1632345031435-8727f6897d53') },
          { url: tile('1604654894610-df63bc536371') }, { url: tile('1519014816548-bf5fe059798b') }, { url: tile('1610992015732-2449b76344bc') },
          { url: tile('1632345031435-8727f6897d53') }, { url: tile('1604654894610-df63bc536371') }, { url: tile('1519014816548-bf5fe059798b') }
        ] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Book your set', subtitle: 'Choose a service and a time.', imageUrl: banner('1632345031435-8727f6897d53'), overlay: 0.35 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
