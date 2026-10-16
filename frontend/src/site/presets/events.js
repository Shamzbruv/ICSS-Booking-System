// Gather & Grace — warm, editorial event styling in cream and terracotta.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'events',
  label: 'Gather & Grace',
  fallback: 'linear-gradient(135deg, #f6f0ea 0%, #e3cdb8 55%, #9b6f4e 140%)',
  demo: {
    name: 'Gather & Grace Events',
    tagline: 'Celebrations designed with heart.',
    location: 'Montego Bay, St. James',
    services: [
      { name: 'Wedding Planning Consultation', description: 'Vision session, budget map and vendor shortlist.', duration_minutes: 90, price: 0 },
      { name: 'Full Wedding Package', description: 'Design, coordination and on-the-day management.', duration_minutes: 60, price: 350000 },
      { name: 'Corporate Event Styling', description: 'Launches, galas and team retreats.', duration_minutes: 60, price: 180000 },
      { name: 'Private Celebration', description: 'Birthdays, showers and anniversaries.', duration_minutes: 60, price: 95000 }
    ]
  },
  site: {
    style: {
      mode: 'light',
      colors: { background: '#fbf7f2', surface: '#ffffff', text: '#2f241f', muted: '#7a5f4c', primary: '#9b6f4e', primaryText: '#ffffff', accent: '#d8b48f', heroText: '#fffaf4' },
      headingFont: 'Playfair Display', bodyFont: 'Lato', headingCase: 'none', radius: 16, buttonShape: 'rounded', buttonStyle: 'solid'
    },
    nav: { style: 'transparent', bookLabel: 'Plan your event' },
    footer: { text: 'Weddings, celebrations and gatherings across the island.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'slideshow', overlay: 0.4, align: 'center', height: 'full',
          slides: [{ url: hero('1519167758481-83f550bb49b3') }, { url: hero('1464366400600-7168b8af9bc3') }, { url: hero('1511795409834-ef04bbd61622') }],
          eyebrow: 'Weddings · Celebrations · Corporate', headline: 'Moments worth gathering for', subheadline: 'Thoughtful design and calm coordination, from the first idea to the last dance.',
          ctaLabel: 'Book a consultation', ctaTarget: 'book', secondaryLabel: 'View our events', secondaryTarget: 'gallery'
        }),
        section('intro', 'intro', {
          eyebrow: 'Hello, friend', title: 'We plan. You celebrate.', body: 'Every gathering tells a story. We listen first, design around what matters most to you, then handle every detail so you can be fully present.',
          imageUrl: portrait('1505236858219-8359eb29e329'), imageSide: 'left', ctaLabel: 'Our approach', ctaTarget: 'about'
        }),
        section('services', 'services', { title: 'Packages', subtitle: 'Start with a complimentary consultation.', limit: 4, showDuration: false }),
        section('gallery-preview', 'gallery', { title: 'Recent celebrations', layout: 'masonry', aspect: '4/5', images: [
          { url: tile('1519167758481-83f550bb49b3') }, { url: tile('1464366400600-7168b8af9bc3') }, { url: tile('1511795409834-ef04bbd61622') }, { url: tile('1505236858219-8359eb29e329') }
        ] }),
        section('testimonials', 'testimonials', { title: 'Love notes', items: [
          { quote: 'Our wedding was more beautiful than we imagined, and we didn’t lift a finger on the day.', name: 'Tanya & Jerome', role: 'Married at Rose Hall' },
          { quote: 'Flawless corporate gala. Our guests are still talking about it.', name: 'Natalie B.', role: 'Marketing Director' }
        ] }),
        section('cta', 'cta', { title: 'Let’s plan something beautiful', text: 'Consultations are complimentary and there’s no obligation.', buttonLabel: 'Book a consultation', target: 'book', imageUrl: banner('1464366400600-7168b8af9bc3') }),
        section('contact', 'contact', { title: 'Our studio', showHours: true, hours: [{ day: 'Mon – Fri', time: '10:00 am – 6:00 pm' }, { day: 'Saturday', time: 'By appointment' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'Our approach', subtitle: 'Calm planning. Joyful days.', imageUrl: banner('1505236858219-8359eb29e329'), overlay: 0.4 }),
        section('about-story', 'intro', { eyebrow: 'Our story', title: 'Designed with heart', body: 'Gather & Grace began with one backyard wedding and a lot of string lights. Today our team designs celebrations across the island, but we still treat every event like family.', imageUrl: portrait('1511795409834-ef04bbd61622'), imageSide: 'right' }),
        section('about-stats', 'stats', { items: [{ value: '300+', label: 'Events designed' }, { value: '14', label: 'Parishes served' }, { value: '5★', label: 'Average rating' }] }),
        section('about-faq', 'faq', { items: [
          { q: 'How far ahead should we book?', a: 'Weddings 9–12 months ahead; smaller events 6–8 weeks.' },
          { q: 'Do you travel?', a: 'Yes, island-wide and for destination weddings.' }
        ] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'Our events', subtitle: 'A few of our favourite days.', imageUrl: banner('1519167758481-83f550bb49b3'), overlay: 0.4 }),
        section('gallery-main', 'gallery', { title: '', layout: 'masonry', aspect: '4/5', images: [
          { url: tile('1519167758481-83f550bb49b3') }, { url: tile('1464366400600-7168b8af9bc3') }, { url: tile('1511795409834-ef04bbd61622') },
          { url: tile('1505236858219-8359eb29e329') }, { url: tile('1519167758481-83f550bb49b3') }, { url: tile('1464366400600-7168b8af9bc3') }
        ] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Plan your event', subtitle: 'Choose a package and a consultation time.', imageUrl: banner('1511795409834-ef04bbd61622'), overlay: 0.45 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
