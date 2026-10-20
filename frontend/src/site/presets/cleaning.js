// FreshStart — bright, calm blue with generous curves and clear service choices.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'cleaning',
  label: 'FreshStart Cleaning',
  fallback: 'linear-gradient(135deg, #123e61, #4599aa 70%, #d9f3ef)',
  demo: {
    name: 'FreshStart Cleaning', tagline: 'A clean space. A lighter day.', location: 'Kingston & St. Andrew, Jamaica',
    services: [
      { name: 'Standard Home Clean', description: 'Regular cleaning for a small home, with scope confirmed before arrival.', duration_minutes: 120, price: 8000 },
      { name: 'Deep Cleaning', description: 'Extra attention for kitchens, bathrooms and often-missed areas.', duration_minutes: 240, price: 16000 },
      { name: 'Move-in / Move-out Clean', description: 'An empty-property clean to prepare for the next chapter.', duration_minutes: 240, price: 20000 },
      { name: 'Office Cleaning Consultation', description: 'Discuss your workspace, service frequency and a tailored quote.', duration_minutes: 30, price: 0 }
    ]
  },
  site: {
    style: { mode: 'light', colors: { background: '#f6fbfd', surface: '#e8f5f8', text: '#16334d', muted: '#597285', primary: '#176b87', primaryText: '#ffffff', accent: '#27a899', heroText: '#ffffff' }, headingFont: 'Plus Jakarta Sans', bodyFont: 'Inter', headingCase: 'none', radius: 24, buttonShape: 'pill', buttonStyle: 'solid' },
    nav: { style: 'solid', bookLabel: 'Book a clean' },
    brand: { tagline: 'A clean space. A lighter day.' },
    announcement: { enabled: true, text: 'A fresh start for your home or workspace.', linkLabel: 'Find your clean', target: 'book' },
    footer: { text: 'Home and workplace cleaning, planned around your space and your day.' },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: hero('1581578731548-c64695cc6952'), overlay: 0.55, align: 'center', height: 'tall', eyebrow: 'Home · Office · Fresh starts', headline: 'Come home\nto a lighter day.', subheadline: 'A fresh, welcoming space without adding another task to your list. Choose your clean and book a time that suits you.', ctaLabel: 'Book my clean', ctaTarget: 'book', secondaryLabel: 'How it works', secondaryTarget: 'about' }),
        section('highlights', 'highlights', { title: 'Less to do. More room to breathe.', items: [{ icon: '🗓️', title: 'Simple online booking', text: 'Choose your service and see available appointment times.' }, { icon: '✨', title: 'The right level of clean', text: 'Standard, deep or move-out cleaning to suit your space.' }, { icon: '💬', title: 'Clear expectations', text: 'Share your priorities and confirm the scope before the visit.' }] }),
        section('services', 'services', { title: 'What kind of fresh start?', subtitle: 'Pick a service below. Larger spaces and specialist jobs may need a tailored quote.', limit: 6, showPrices: true, showDuration: true }),
        section('intro', 'intro', { eyebrow: 'A little care goes a long way', title: 'Clean spaces, made personal.', body: 'Your space has its own routine. Tell us what needs attention, how to access the property and anything we should handle with extra care.', imageUrl: portrait('1600585154340-be6161a56a0c'), imageSide: 'left', ctaLabel: 'Meet FreshStart', ctaTarget: 'about' }),
        section('home-faq', 'faq', { title: 'A few things before we arrive', items: [{ q: 'What is included in my service?', a: 'Check the service description and add your priorities when booking. We confirm the scope before the visit.' }, { q: 'Do I need to be home?', a: 'You can arrange access in advance. Include any entry instructions when booking and confirm them with the team.' }, { q: 'Can I arrange regular cleaning?', a: 'Book your next visit online and contact us to discuss an ongoing cleaning plan.' }] }),
        section('cta', 'cta', { title: 'Your next fresh start is a few clicks away.', text: 'Choose a service. Pick a time. Tell us about your space.', buttonLabel: 'Find my appointment', target: 'book' }),
        section('contact', 'contact', { title: 'Let’s make space for clean', hours: [{ day: 'Monday – Saturday', time: '8:00 am – 6:00 pm' }, { day: 'Sunday', time: 'By arrangement' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'A little care. A fresh perspective.', subtitle: 'Cleaning that fits the way you live and work.', imageUrl: banner('1581578731548-c64695cc6952'), overlay: 0.55 }),
        section('about-story', 'intro', { eyebrow: 'Our approach', title: 'Start with what matters to you.', body: 'A tidy room makes a difference, but so does a clear plan. We listen to your priorities and agree on the service, access and timing so you know what to expect.', imageUrl: portrait('1600585154340-be6161a56a0c') }),
        section('about-highlights', 'highlights', { title: 'From booking to a fresh space', items: [{ icon: '1️⃣', title: 'Choose your service', text: 'Select the level of cleaning that best fits your space.' }, { icon: '2️⃣', title: 'Share the details', text: 'Tell us your address, priorities and access instructions.' }, { icon: '3️⃣', title: 'Get ready for your visit', text: 'Confirm the scope and prepare access for the appointment.' }] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'A closer look at clean', subtitle: 'Care in the everyday details.', imageUrl: banner('1581578731548-c64695cc6952'), overlay: 0.5 }),
        section('gallery-main', 'gallery', { title: 'Fresh-space inspiration', layout: 'grid', aspect: '3/2', images: [{ url: tile('1581578731548-c64695cc6952'), caption: 'Everyday care' }, { url: tile('1584622650111-993a426fbf0a'), caption: 'Attention to detail' }, { url: tile('1600585154340-be6161a56a0c'), caption: 'A fresh start' }] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Make time for a fresh start.', subtitle: 'Choose your service and tell us about your space.', imageUrl: banner('1581578731548-c64695cc6952'), overlay: 0.6 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
