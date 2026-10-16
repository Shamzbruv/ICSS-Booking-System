// Serenity Health — clean clinical whites with calming teal.
import { hero, portrait, square, banner, tile, page, section } from './helpers';

export default {
  key: 'health',
  label: 'Serenity Health',
  fallback: 'linear-gradient(135deg, #f2f8f8 0%, #cfe7e6 55%, #1f8a8a 140%)',
  demo: {
    name: 'Serenity Health Clinic',
    tagline: 'Compassionate care, close to home.',
    location: 'Liguanea, Kingston 6',
    services: [
      { name: 'General Consultation', description: 'Assessment, diagnosis and treatment plan.', duration_minutes: 30, price: 6000 },
      { name: 'Annual Wellness Exam', description: 'Full check-up with blood pressure and lab referrals.', duration_minutes: 45, price: 9000 },
      { name: 'Telehealth Visit', description: 'Video consultation from home.', duration_minutes: 20, price: 4500 },
      { name: 'Paediatric Check-up', description: 'Growth, development and vaccinations.', duration_minutes: 30, price: 6500 }
    ]
  },
  site: {
    style: {
      mode: 'light',
      colors: { background: '#f7fbfb', surface: '#ffffff', text: '#12313a', muted: '#5b7680', primary: '#1f8a8a', primaryText: '#ffffff', accent: '#5bc0be', heroText: '#ffffff' },
      headingFont: 'Lora', bodyFont: 'Nunito Sans', headingCase: 'none', radius: 14, buttonShape: 'rounded', buttonStyle: 'solid'
    },
    nav: { style: 'solid', bookLabel: 'Book appointment' },
    announcement: { enabled: true, text: 'Telehealth appointments available 7 days a week', linkLabel: 'Book online', target: 'book' },
    footer: { text: 'In an emergency, call 119 or go to the nearest emergency department.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: hero('1576091160399-112ba8d25d1d'), overlay: 0.45, align: 'left', height: 'tall',
          eyebrow: 'Family medicine & telehealth', headline: 'Care that puts you first', subtitle: '', subheadline: 'Same-week appointments with doctors who listen, in clinic or online.',
          ctaLabel: 'Book appointment', ctaTarget: 'book', secondaryLabel: 'Our doctors', secondaryTarget: 'about'
        }),
        section('highlights', 'highlights', { title: 'Why patients choose us', items: [
          { icon: '🩺', title: 'Experienced doctors', text: 'Board-certified family physicians.' },
          { icon: '📱', title: 'Telehealth', text: 'See a doctor from your phone.' },
          { icon: '🗓️', title: 'Same-week visits', text: 'Online booking, real availability.' }
        ] }),
        section('services', 'services', { title: 'Appointments', subtitle: 'Choose in-clinic or video visits.', limit: 6 }),
        section('intro', 'intro', {
          eyebrow: 'Our clinic', title: 'Modern care, personal touch', body: 'Our bright, accessible clinic offers on-site lab collection and a calm waiting area. We keep wait times short so your visit fits your day.',
          imageUrl: portrait('1579684385127-1ef15d508118'), imageSide: 'right'
        }),
        section('testimonials', 'testimonials', { title: 'Patient feedback', items: [
          { quote: 'Dr. Grant took time to explain everything. I felt genuinely cared for.', name: 'Paulette H.', role: 'Patient' },
          { quote: 'Telehealth was so easy. Prescription sent the same day.', name: 'Devon M.', role: 'Telehealth patient' }
        ] }),
        section('faq', 'faq', { items: [
          { q: 'Do you accept insurance?', a: 'Yes, we accept most major local health insurance plans.' },
          { q: 'How do telehealth visits work?', a: 'You’ll receive a secure video link by email before your appointment.' }
        ] }),
        section('contact', 'contact', { title: 'Visit the clinic', hours: [{ day: 'Mon – Fri', time: '8:00 am – 6:00 pm' }, { day: 'Saturday', time: '9:00 am – 1:00 pm' }, { day: 'Telehealth', time: 'Daily 7:00 am – 9:00 pm' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'About our clinic', subtitle: 'Your partners in lifelong health.', imageUrl: banner('1505751172876-fa1923c5c528'), overlay: 0.45 }),
        section('about-team', 'team', { title: 'Our doctors', members: [
          { name: 'Dr. Andrea Grant', role: 'Family physician', bio: '15 years in family medicine.', photoUrl: square('1631217868264-e5b90bb7e133') },
          { name: 'Dr. Michael Chen', role: 'Paediatrics', bio: 'Caring for children of all ages.', photoUrl: square('1579684385127-1ef15d508118') }
        ] }),
        section('about-story', 'intro', { eyebrow: 'Our approach', title: 'Prevention and partnership', body: 'We focus on prevention, clear communication and long-term relationships with every patient and family we serve.', imageUrl: portrait('1505751172876-fa1923c5c528'), imageSide: 'left' })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'Our facility', subtitle: 'Clean, bright and accessible.', imageUrl: banner('1576091160399-112ba8d25d1d'), overlay: 0.45 }),
        section('gallery-main', 'gallery', { title: '', layout: 'grid', aspect: '3/2', images: [
          { url: tile('1579684385127-1ef15d508118') }, { url: tile('1505751172876-fa1923c5c528') }, { url: tile('1631217868264-e5b90bb7e133') },
          { url: tile('1576091160399-112ba8d25d1d') }
        ] })
      ], { visible: false }),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Book an appointment', subtitle: 'In-clinic or telehealth — your choice.', imageUrl: banner('1579684385127-1ef15d508118'), overlay: 0.45 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
