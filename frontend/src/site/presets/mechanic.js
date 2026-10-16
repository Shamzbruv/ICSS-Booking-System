// Pro Auto Care — industrial, high-contrast workshop with safety orange.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'mechanic',
  label: 'Pro Auto Care',
  fallback: 'linear-gradient(135deg, #15181d 0%, #2b3038 55%, #f2711c 140%)',
  demo: {
    name: 'Pro Auto Care',
    tagline: 'Honest repairs. Straight answers.',
    location: 'Spanish Town Road, Kingston',
    services: [
      { name: 'Oil Change & Inspection', description: 'Synthetic oil, filter and 30-point inspection.', duration_minutes: 45, price: 9500 },
      { name: 'Full Diagnostics', description: 'Computer scan, road test and written report.', duration_minutes: 90, price: 12000 },
      { name: 'Brake Service', description: 'Pads, rotor check and brake fluid top-up.', duration_minutes: 120, price: 22000 },
      { name: 'A/C Recharge', description: 'Leak test and refrigerant recharge.', duration_minutes: 60, price: 11000 }
    ]
  },
  site: {
    style: {
      mode: 'dark',
      colors: { background: '#121417', surface: '#1c2026', text: '#f1f3f5', muted: '#9aa3ad', primary: '#f2711c', primaryText: '#ffffff', accent: '#ffc53d', heroText: '#ffffff' },
      headingFont: 'Barlow Condensed', bodyFont: 'Inter', headingCase: 'uppercase', radius: 4, buttonShape: 'square', buttonStyle: 'solid'
    },
    nav: { style: 'solid', bookLabel: 'Book service' },
    announcement: { enabled: true, text: 'Same-day diagnostics when you book before 10 am', linkLabel: 'Book now', target: 'book' },
    footer: { text: 'Certified technicians · Genuine parts · Written warranty.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: hero('1487754180451-c456f719a1fc'), overlay: 0.6, align: 'left', height: 'tall',
          eyebrow: 'Certified auto repair', headline: 'Fixed right.\nThe first time.', subheadline: 'Diagnostics, servicing and repairs with upfront quotes and no surprises.',
          ctaLabel: 'Book a service', ctaTarget: 'book', secondaryLabel: 'Why choose us', secondaryTarget: 'about'
        }),
        section('highlights', 'highlights', { title: 'Why drivers trust us', items: [
          { icon: '🔧', title: 'Certified techs', text: 'ASE-trained technicians on every job.' },
          { icon: '🧾', title: 'Upfront quotes', text: 'Approve every cost before we start.' },
          { icon: '🛡️', title: '12-month warranty', text: 'Parts and labour, guaranteed.' },
          { icon: '⏱️', title: 'On time', text: 'Text updates the moment your car is ready.' }
        ] }),
        section('services', 'services', { title: 'Service menu', subtitle: 'Book online and skip the wait at the counter.', limit: 6 }),
        section('stats', 'stats', { items: [{ value: '15k+', label: 'Vehicles serviced' }, { value: '98%', label: 'Same-day turnaround' }, { value: '12 mo', label: 'Warranty' }] }),
        section('cta', 'cta', { title: 'Check engine light on?', text: 'Book a full diagnostic and get a written report the same day.', buttonLabel: 'Book diagnostics', target: 'book', imageUrl: banner('1625047509248-ec889cbff17f') }),
        section('contact', 'contact', { title: 'Visit the workshop', hours: [{ day: 'Mon – Fri', time: '7:30 am – 6:00 pm' }, { day: 'Saturday', time: '8:00 am – 2:00 pm' }, { day: 'Sunday', time: 'Closed' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'About Pro Auto Care', subtitle: 'Family-run, technician-led.', imageUrl: banner('1619642751034-765dfdf7c58e'), overlay: 0.6 }),
        section('about-story', 'intro', { eyebrow: 'Since 2008', title: 'Straight answers, every time', body: 'We explain what your car needs, what can wait, and what it will cost before a single bolt turns. That honesty is why most of our work comes from referrals.', imageUrl: portrait('1580273916550-e323be2ae537') }),
        section('about-faq', 'faq', { items: [
          { q: 'Can I wait while you work?', a: 'Yes, for services under 90 minutes. Our lounge has Wi-Fi and coffee.' },
          { q: 'Do you use genuine parts?', a: 'OEM or OEM-equivalent parts with a 12-month warranty.' }
        ] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'The workshop', subtitle: 'Clean bays, modern equipment.', imageUrl: banner('1487754180451-c456f719a1fc'), overlay: 0.6 }),
        section('gallery-main', 'gallery', { title: '', layout: 'grid', aspect: '3/2', images: [
          { url: tile('1625047509248-ec889cbff17f') }, { url: tile('1619642751034-765dfdf7c58e') }, { url: tile('1580273916550-e323be2ae537') },
          { url: tile('1487754180451-c456f719a1fc') }, { url: tile('1625047509248-ec889cbff17f') }, { url: tile('1619642751034-765dfdf7c58e') }
        ] })
      ], { visible: false }),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Book a service', subtitle: 'Pick a service and drop-off time.', imageUrl: banner('1625047509248-ec889cbff17f'), overlay: 0.65 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
