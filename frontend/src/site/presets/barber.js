// Iron & Blade — dark, gold-edged gentlemen's barbershop.
import { hero, portrait, square, banner, tile, page, section } from './helpers';

export default {
  key: 'barber',
  label: 'Iron & Blade',
  fallback: 'linear-gradient(135deg, #1b1d1b 0%, #3a2f1f 55%, #b49258 140%)',
  demo: {
    name: 'Iron & Blade Barbers',
    tagline: 'Sharp cuts. Hot towels. Good company.',
    location: '12 Hope Road, Kingston',
    services: [
      { name: 'Signature Haircut', description: 'Consultation, precision cut, wash and style.', duration_minutes: 45, price: 3500 },
      { name: 'Skin Fade & Blend', description: 'Zero-to-blend fade finished with a straight-razor line up.', duration_minutes: 50, price: 4000 },
      { name: 'Beard Sculpt', description: 'Shape, trim, hot towel and beard oil.', duration_minutes: 30, price: 2500 },
      { name: 'The Full Treatment', description: 'Cut, beard sculpt, hot towel shave and scalp massage.', duration_minutes: 75, price: 6500 },
      { name: 'Hot Towel Shave', description: 'Old-school straight-razor shave with steamed towels.', duration_minutes: 40, price: 3000 }
    ]
  },
  site: {
    style: {
      mode: 'dark',
      colors: { background: '#111312', surface: '#1a1d1b', text: '#f3efe6', muted: '#a99f8a', primary: '#caa86d', primaryText: '#16120c', accent: '#e4c890', heroText: '#f8f3e8' },
      headingFont: 'Oswald', bodyFont: 'Manrope', headingCase: 'uppercase', radius: 6, buttonShape: 'square', buttonStyle: 'solid'
    },
    nav: { style: 'transparent', bookLabel: 'Book a chair' },
    announcement: { enabled: true, text: 'Walk-ins welcome Tuesday to Thursday · Book ahead on weekends', linkLabel: 'Reserve', target: 'book' },
    footer: { text: 'Classic barbering, modern standards.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: hero('1503951914875-452162b0f3f1'), overlay: 0.55, align: 'left', height: 'full',
          eyebrow: 'Est. barbershop · Kingston', headline: 'Sharp cuts.\nZero shortcuts.', subheadline: 'Precision fades, beard work and hot-towel shaves from barbers who take their time.',
          ctaLabel: 'Book a chair', ctaTarget: 'book', secondaryLabel: 'See the work', secondaryTarget: 'gallery'
        }),
        section('stats', 'stats', { items: [{ value: '12+', label: 'Years behind the chair' }, { value: '4.9★', label: 'Average review' }, { value: '9k', label: 'Cuts a year' }] }),
        section('services', 'services', { title: 'The menu', subtitle: 'Every service includes a hot towel finish.', limit: 6 }),
        section('intro', 'intro', {
          eyebrow: 'The shop', title: 'Built for the regulars', body: 'Leather chairs, good music and barbers who remember how you like it. We keep appointments on time so your lunch break stays a lunch break.',
          imageUrl: portrait('1585747860715-2ba37e788b70'), imageSide: 'left', ctaLabel: 'Meet the barbers', ctaTarget: 'about'
        }),
        section('gallery-preview', 'gallery', { title: 'Fresh off the chair', layout: 'grid', aspect: '1/1', images: [
          { url: tile('1621605815971-fbc98d665033'), caption: 'Skin fade' }, { url: tile('1599351431202-1e0f0137899a'), caption: 'Beard sculpt' }, { url: tile('1503951914875-452162b0f3f1'), caption: 'Classic taper' }
        ] }),
        section('testimonials', 'testimonials', { title: 'Word on the block', items: [
          { quote: 'Best fade in the city and they actually start on time.', name: 'Andre W.', role: 'Regular since 2019' },
          { quote: 'The hot towel shave is a whole experience. Worth every dollar.', name: 'Marcus T.', role: 'First visit' }
        ] }),
        section('cta', 'cta', { title: 'Your chair is waiting', text: 'Pick a barber and a time in under a minute.', buttonLabel: 'Book now', target: 'book', imageUrl: banner('1621605815971-fbc98d665033') }),
        section('contact', 'contact', { title: 'Find the shop', hours: [{ day: 'Tue – Fri', time: '9:00 am – 7:00 pm' }, { day: 'Saturday', time: '8:00 am – 6:00 pm' }, { day: 'Sun – Mon', time: 'Closed' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'About the shop', subtitle: 'Old-school craft, new-school standards.', imageUrl: banner('1585747860715-2ba37e788b70'), overlay: 0.6 }),
        section('about-story', 'intro', { eyebrow: 'Our story', title: 'From one chair to a full crew', body: 'We started with one chair and a straight razor. Today our crew of barbers still follows the same rule: every client leaves looking sharper than they walked in.', imageUrl: portrait('1599351431202-1e0f0137899a') }),
        section('about-team', 'team', { title: 'The crew', members: [
          { name: 'Dwayne', role: 'Master barber', bio: 'Fades, tapers and razor work.', photoUrl: square('1621605815971-fbc98d665033') },
          { name: 'Kemar', role: 'Beard specialist', bio: 'Sculpting and hot-towel shaves.', photoUrl: square('1599351431202-1e0f0137899a') }
        ] }),
        section('about-faq', 'faq', { items: [
          { q: 'Do you take walk-ins?', a: 'Yes, Tuesday to Thursday when a chair is free. Weekends are booking only.' },
          { q: 'How late can I cancel?', a: 'Up to 4 hours before your appointment, free of charge.' }
        ] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'The work', subtitle: 'Cuts, fades and beard work from the shop floor.', imageUrl: banner('1503951914875-452162b0f3f1'), overlay: 0.6 }),
        section('gallery-main', 'gallery', { title: '', layout: 'masonry', aspect: '4/5', images: [
          { url: tile('1621605815971-fbc98d665033') }, { url: tile('1599351431202-1e0f0137899a') }, { url: tile('1503951914875-452162b0f3f1') },
          { url: tile('1585747860715-2ba37e788b70') }, { url: tile('1621605815971-fbc98d665033') }, { url: tile('1599351431202-1e0f0137899a') }
        ] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Book a chair', subtitle: 'Choose your service, barber and time.', imageUrl: banner('1585747860715-2ba37e788b70'), overlay: 0.65 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
