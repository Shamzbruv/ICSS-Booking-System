import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find(item => item.key === 'pastor-ministry');
const officePhoto = '/images/starter-kits/pastor-office.webp';
const tagline = 'Pastoral care for church members';
const privacyNote = 'Use the form to choose a time and tell us how to reach you. Save personal details for the conversation.';

export default {
  key: kit.key, label: 'Pastoral Care', fallback: 'linear-gradient(135deg, #18242c, #374750)',
  demo: { name: 'Pastor Andrew Bennett', tagline, services: kit.services },
  site: {
    style: {
      mode: 'light', colors: { background: '#faf7ef', surface: '#ffffff', text: '#222d35', muted: '#514d52', primary: '#324c5b', primaryText: '#ffffff', accent: '#324c5b', heroText: '#ffffff' },
      headingFont: 'Playfair Display', bodyFont: 'Inter', headingCase: 'none', radius: 10, buttonShape: 'rounded', buttonStyle: 'solid'
    },
    brand: { tagline },
    nav: { style: 'solid', bookLabel: 'Book an appointment' },
    booking: { footerNote: privacyNote },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: kit.art, mobileImageUrl: '/images/starter-kits/pastor-ministry-mobile.webp',
          overlay: 0.59, height: 'tall', align: 'left', eyebrow: 'Pastoral care', headline: 'Book time with your pastor.',
          subheadline: 'Schedule a member meeting, pastoral counseling, time for prayer, or a follow-up conversation.',
          ctaLabel: 'Book an appointment', ctaTarget: 'book', secondaryLabel: 'See appointment types', secondaryTarget: 'about'
        }),
        section('home-services', 'services', { title: 'How can I support you?', showPrices: false, showDuration: true, ctaLabel: 'See available times' }),
        section('home-intro', 'intro', {
          title: 'A place to talk things through',
          body: 'Church members can make time for the conversations that need more than a few minutes after service. We can talk through what’s on your mind, pray together, or follow up on a previous meeting.',
          imageUrl: officePhoto, imageSide: 'right', ctaLabel: 'What to expect', ctaTarget: 'gallery'
        })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'Pastoral appointments', subtitle: 'Choose the conversation that fits what you need today.', imageUrl: officePhoto, overlay: 0.68 }),
        section('about-options', 'services', { title: 'Member meetings, counseling and follow-ups', showPrices: false, showDuration: true, ctaLabel: 'See available times' })
      ], { label: 'Appointments' }),
      page('gallery', [
        section('feature-header', 'pageHeader', { title: 'What to expect', subtitle: privacyNote, imageUrl: officePhoto, overlay: 0.68 }),
        section('feature-details', 'highlights', { title: 'Before your appointment', items: [
          { title: 'Pick the type of conversation', text: 'Choose a member meeting, pastoral counseling, prayer or a follow-up appointment.' },
          { title: 'Tell us how to reach you', text: 'Choose a preference for meeting in person or by phone. Use contact details you’re comfortable receiving a booking message on.' },
          { title: 'Save your story for the meeting', text: 'The form only needs the information required to schedule your appointment. Bring up any personal details when you speak with the pastor.' }
        ] }),
        section('feature-cta', 'cta', { title: 'Find a time that works for you', buttonLabel: 'Book an appointment', target: 'book' })
      ], { label: 'What to expect' }),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Book a pastoral appointment', subtitle: privacyNote, imageUrl: officePhoto, overlay: 0.72 }),
        section('booking-main', 'booking', { title: '' })
      ], { label: 'Book an appointment' })
    ]
  }
};
