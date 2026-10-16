// Universal Services — crisp, modern indigo that suits any business.
import { hero, portrait, square, banner, tile, page, section } from './helpers';

export default {
  key: 'universal',
  label: 'Universal Services',
  fallback: 'linear-gradient(135deg, #f5f7fb 0%, #d9dcff 55%, #6c63ff 140%)',
  demo: {
    name: 'Your Business',
    tagline: 'Book in seconds. We’ll handle the rest.',
    location: 'Kingston, Jamaica',
    services: [
      { name: 'Consultation', description: 'A focused session to understand your needs.', duration_minutes: 30, price: 5000 },
      { name: 'Professional Service', description: 'Our signature service, delivered with care.', duration_minutes: 60, price: 12000 },
      { name: 'Premium Package', description: 'Everything included, plus priority follow-up.', duration_minutes: 90, price: 20000 },
      { name: 'Quick Check-in', description: 'Short follow-up appointment.', duration_minutes: 15, price: 0 }
    ]
  },
  site: {
    style: {
      mode: 'light',
      colors: { background: '#ffffff', surface: '#f5f7fb', text: '#18223a', muted: '#566687', primary: '#6c63ff', primaryText: '#ffffff', accent: '#ffb547', heroText: '#ffffff' },
      headingFont: 'Plus Jakarta Sans', bodyFont: 'Inter', headingCase: 'none', radius: 14, buttonShape: 'rounded', buttonStyle: 'solid'
    },
    nav: { style: 'transparent', bookLabel: 'Book now' },
    footer: { text: 'Online booking powered by ICSS.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: hero('1497366216548-37526070297c'), overlay: 0.5, align: 'center', height: 'tall',
          eyebrow: 'Welcome', headline: 'Great service starts with an easy booking', subheadline: 'Choose a service, pick a time and get instant confirmation.',
          ctaLabel: 'Book now', ctaTarget: 'book', secondaryLabel: 'Learn more', secondaryTarget: 'about'
        }),
        section('highlights', 'highlights', { title: 'Why book with us', items: [
          { icon: '⚡', title: 'Instant confirmation', text: 'Your spot is reserved the moment you book.' },
          { icon: '🔔', title: 'Reminders', text: 'Email reminders so you never miss a visit.' },
          { icon: '💳', title: 'Flexible payment', text: 'Pay online or in person.' }
        ] }),
        section('services', 'services', { title: 'Services', subtitle: 'Transparent pricing, no surprises.', limit: 6 }),
        section('intro', 'intro', {
          eyebrow: 'About us', title: 'Here to help', body: 'Tell your customers who you are, what you do best and why they’ll love working with you. Edit this text in the Website Builder.',
          imageUrl: portrait('1521737604893-d14cc237f11d'), imageSide: 'right', ctaLabel: 'More about us', ctaTarget: 'about'
        }),
        section('testimonials', 'testimonials', { title: 'Customer reviews', items: [
          { quote: 'Booking took 30 seconds and the service was excellent.', name: 'Happy Customer', role: 'Verified booking' },
          { quote: 'Professional, punctual and friendly.', name: 'Returning Client', role: 'Verified booking' }
        ] }),
        section('contact', 'contact', { title: 'Get in touch', hours: [{ day: 'Mon – Fri', time: '9:00 am – 5:00 pm' }, { day: 'Saturday', time: '10:00 am – 2:00 pm' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'About us', subtitle: 'Who we are and how we work.', imageUrl: banner('1556761175-5973dc0f32e7'), overlay: 0.5 }),
        section('about-story', 'intro', { eyebrow: 'Our story', title: 'Built on great service', body: 'Share your story here: how you started, what you believe in and what makes your service different.', imageUrl: portrait('1600880292203-757bb62b4baf'), imageSide: 'left' }),
        section('about-team', 'team', { title: 'Our team', members: [
          { name: 'Team Member', role: 'Founder', bio: 'Add a short bio in the Website Builder.', photoUrl: square('1521737604893-d14cc237f11d') },
          { name: 'Team Member', role: 'Specialist', bio: 'Add a short bio in the Website Builder.', photoUrl: square('1600880292203-757bb62b4baf') }
        ] }),
        section('about-faq', 'faq', { items: [
          { q: 'How do I reschedule?', a: 'Reply to your confirmation email or contact us directly.' },
          { q: 'What payment methods do you accept?', a: 'We accept the payment options shown during booking.' }
        ] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'Gallery', imageUrl: banner('1497366216548-37526070297c'), overlay: 0.5 }),
        section('gallery-main', 'gallery', { title: '', layout: 'grid', aspect: '4/5', images: [
          { url: tile('1521737604893-d14cc237f11d') }, { url: tile('1556761175-5973dc0f32e7') }, { url: tile('1600880292203-757bb62b4baf') },
          { url: tile('1497366216548-37526070297c') }, { url: tile('1521737604893-d14cc237f11d') }, { url: tile('1556761175-5973dc0f32e7') }
        ] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Book an appointment', subtitle: 'Pick a service and a time that works for you.', imageUrl: banner('1556761175-5973dc0f32e7'), overlay: 0.5 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
