import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find(item => item.key === 'pastor-ministry');
const officePhoto = '/images/starter-kits/pastor-office.webp';
const tagline = 'Pastoral care for church members';
const privacyNote = 'Choose a time and tell us how to reach you. Save personal details for the conversation.';
const questions = [
  { q: 'Do I need to explain why I’m booking?', a: 'Choosing the appointment type is enough. You can share as much as you’re comfortable sharing when we speak.' },
  { q: 'How will I know where to meet?', a: 'Indicate whether you prefer to meet in person or by phone. We’ll use the contact details you provide to confirm the location or call arrangements.' },
  { q: 'Can I book again after we’ve spoken?', a: 'Yes. Choose a follow-up appointment if you’d like to reconnect, talk about what’s changed or discuss next steps.' }
];

export default {
  key: kit.key, label: 'Pastoral Care', fallback: 'linear-gradient(135deg, #18242c, #374750)',
  demo: {
    name: 'Pastor Andrew Bennett', tagline, services: kit.services,
    contact: {
      address: 'Pastoral appointments in Kingston or by phone',
      phone: '+1 (876) 555-0147',
      email: 'pastoral-care@example.com',
      hours: [{ day: 'Tue – Thu', time: 'By appointment' }]
    }
  },
  site: {
    style: {
      mode: 'light', colors: { background: '#faf7ef', surface: '#ffffff', text: '#222d35', muted: '#514d52', primary: '#324c5b', primaryText: '#ffffff', accent: '#324c5b', heroText: '#ffffff' },
      headingFont: 'Playfair Display', bodyFont: 'Inter', headingCase: 'none', radius: 14, buttonShape: 'rounded', buttonStyle: 'solid'
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
        section('home-intro', 'intro', {
          title: 'A place to talk things through',
          body: 'Church members can make time for the conversations that need more than a few minutes after service. We can talk through what’s on your mind, pray together, or follow up on a previous meeting.',
          imageUrl: officePhoto, imageSide: 'right', ctaLabel: 'What to expect', ctaTarget: 'gallery'
        }),
        section('home-services', 'services', { title: 'How can I support you?', showPrices: false, showDuration: true, ctaLabel: 'See available times' }),
        section('contact', 'contact', {
          title: 'Meeting arrangements',
          subtitle: 'You can request an in-person or phone appointment. We’ll confirm how we’ll meet after booking.',
          showMap: false
        })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'Pastoral appointments', subtitle: 'Choose a time to talk about what matters to you.', imageUrl: officePhoto, overlay: 0.68 }),
        section('about-options', 'services', { title: 'Member meetings, counseling and follow-ups', showPrices: false, showDuration: true, ctaLabel: 'See available times' }),
        section('about-next-step', 'cta', {
          title: 'Take some time for a conversation',
          text: 'You can decide what to share when we meet.',
          buttonLabel: 'See what to expect', target: 'gallery'
        })
      ], { label: 'Appointments' }),
      page('gallery', [
        section('feature-header', 'pageHeader', { title: 'What to expect', subtitle: privacyNote, imageUrl: officePhoto, overlay: 0.68 }),
        section('feature-details', 'highlights', { title: 'Before your appointment', items: [
          { title: 'Choose an appointment', text: 'Pick a member meeting, pastoral counseling, time for prayer or a follow-up.' },
          { title: 'Share your meeting preference', text: 'Choose in person or by phone and give contact details you’re comfortable using for booking messages.' },
          { title: 'Make time for the conversation', text: 'Set aside the appointment time. If we’re speaking by phone, choose a place where you feel comfortable talking.' }
        ] }),
        section('feature-faq', 'faq', { title: 'Questions about your appointment', items: questions }),
        section('feature-cta', 'cta', { title: 'Find a time that works for you', buttonLabel: 'Book an appointment', target: 'book' })
      ], { label: 'What to expect' }),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Book a pastoral appointment', subtitle: privacyNote, imageUrl: officePhoto, overlay: 0.72 }),
        section('booking-main', 'booking', { title: '' }),
        section('book-faq', 'faq', { title: 'Before we meet', items: questions })
      ], { label: 'Book an appointment' })
    ]
  }
};
