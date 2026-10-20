// GreenScape — warm editorial garden design with forest green and sand.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'landscaping',
  label: 'GreenScape Landscaping',
  fallback: 'linear-gradient(135deg, #173c2e, #527b51 65%, #d7c59a)',
  demo: {
    name: 'GreenScape Landscaping', tagline: 'A little more life outdoors.', location: 'Kingston & St. Andrew, Jamaica',
    services: [
      { name: 'Garden Consultation', description: 'A site visit to discuss your space, priorities and a tailored quote.', duration_minutes: 45, price: 2500 },
      { name: 'Lawn Care Visit', description: 'Mowing, edging and a tidy finish for a small residential lawn.', duration_minutes: 90, price: 6000 },
      { name: 'Garden Refresh', description: 'Weeding, pruning and care for existing garden beds.', duration_minutes: 120, price: 9500 },
      { name: 'Landscape Planning Session', description: 'Discuss planting, layout and the next steps for your outdoor space.', duration_minutes: 60, price: 5000 }
    ]
  },
  site: {
    style: { mode: 'light', colors: { background: '#f7f5ed', surface: '#eeeee2', text: '#193b2d', muted: '#607364', primary: '#24553e', primaryText: '#ffffff', accent: '#b98b45', heroText: '#ffffff' }, headingFont: 'DM Serif Display', bodyFont: 'Manrope', headingCase: 'none', radius: 8, buttonShape: 'square', buttonStyle: 'solid' },
    nav: { style: 'transparent', bookLabel: 'Plan a visit' },
    announcement: { enabled: true, text: 'Good gardens begin with a conversation.', linkLabel: 'Book a consultation', target: 'book' },
    brand: { tagline: 'A little more life outdoors.' },
    footer: { text: 'Garden design, lawn care and thoughtful maintenance. Make room for the outdoors.' },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: hero('1558904541-efa843a96f01'), overlay: 0.5, align: 'left', height: 'full', eyebrow: 'Landscaping · Garden care · Outdoor living', headline: 'Your outdoors.\nBeautifully alive.', subheadline: 'From a tidy lawn to a garden you love spending time in, let’s bring your outdoor space to life.', ctaLabel: 'Plan my garden', ctaTarget: 'book', secondaryLabel: 'Explore our work', secondaryTarget: 'gallery' }),
        section('intro', 'intro', { eyebrow: 'Room to grow', title: 'Thoughtful care, from the ground up.', body: 'A welcoming garden should work for your home and your everyday life. We start by listening, then plan practical planting and maintenance around your space.', imageUrl: portrait('1416879595882-3373a0480b5b'), imageSide: 'right', ctaLabel: 'Meet GreenScape', ctaTarget: 'about' }),
        section('services', 'services', { title: 'Find the right care for your space', subtitle: 'Book a visit or start with a consultation for larger projects.', limit: 6, showPrices: true, showDuration: true }),
        section('highlights', 'highlights', { title: 'A clear path to a greener space', items: [{ icon: '🌱', title: 'Start with your space', text: 'Tell us what you have in mind and what your garden needs.' }, { icon: '📐', title: 'Make a practical plan', text: 'Agree the scope, timing and cost before the work begins.' }, { icon: '✂️', title: 'Keep it cared for', text: 'Discuss ongoing visits that suit your garden and routine.' }] }),
        section('home-gallery', 'gallery', { title: 'Spaces with a little more life', layout: 'grid', aspect: '3/2', images: [{ url: tile('1558904541-efa843a96f01'), caption: 'Garden inspiration' }, { url: tile('1416879595882-3373a0480b5b'), caption: 'Planting details' }, { url: tile('1585320806297-9794b3e4eeae'), caption: 'Thoughtful greenery' }] }),
        section('cta', 'cta', { title: 'Something good is growing.', text: 'Let’s talk about what your outdoor space could become.', buttonLabel: 'Book a site visit', target: 'book', imageUrl: banner('1558904541-efa843a96f01') }),
        section('contact', 'contact', { title: 'Let’s talk gardens', hours: [{ day: 'Monday – Friday', time: '8:00 am – 5:00 pm' }, { day: 'Saturday', time: '8:00 am – 1:00 pm' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'Care for every corner.', subtitle: 'Practical landscaping with a personal touch.', imageUrl: banner('1558904541-efa843a96f01'), overlay: 0.5 }),
        section('about-story', 'intro', { eyebrow: 'Our approach', title: 'Good spaces start with listening.', body: 'Whether you want a fresh start or regular care, we work with the space you have. Share your ideas, maintenance needs and budget, and we’ll talk through a sensible next step.', imageUrl: portrait('1416879595882-3373a0480b5b'), imageSide: 'left' }),
        section('about-faq', 'faq', { title: 'Before your first visit', items: [{ q: 'Can I book a consultation first?', a: 'Yes. A consultation helps us understand your space before recommending a scope of work.' }, { q: 'What should I share before a visit?', a: 'Include your service address, access instructions and a short description of the garden or lawn.' }, { q: 'Do larger projects need a separate quote?', a: 'Yes. We discuss the scope, materials and price before starting a larger landscaping project.' }] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'Outdoor inspiration', subtitle: 'Gardens, greenery and the details that make a space.', imageUrl: banner('1558904541-efa843a96f01'), overlay: 0.45 }),
        section('gallery-main', 'gallery', { title: 'A closer look', layout: 'masonry', aspect: '4/5', images: [{ url: tile('1558904541-efa843a96f01'), caption: 'Garden spaces' }, { url: tile('1416879595882-3373a0480b5b'), caption: 'Planting inspiration' }, { url: tile('1585320806297-9794b3e4eeae'), caption: 'Green details' }] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Make room for greener days.', subtitle: 'Choose a service and a time for your next visit.', imageUrl: banner('1558904541-efa843a96f01'), overlay: 0.6 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
