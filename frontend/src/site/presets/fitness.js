// Pulse Studio — high-energy black studio with electric lime.
import { hero, portrait, square, banner, tile, page, section } from './helpers';

export default {
  key: 'fitness',
  label: 'Pulse Studio',
  fallback: 'linear-gradient(135deg, #0b0c0e 0%, #1d2318 55%, #c6ff3d 140%)',
  demo: {
    name: 'Pulse Studio',
    tagline: 'Train loud. Recover smart.',
    location: 'New Kingston',
    services: [
      { name: 'HIIT Fusion', description: '45 minutes of intervals, strength and cardio.', duration_minutes: 45, price: 2000 },
      { name: 'Power Vinyasa', description: 'Strong, flowing yoga for mobility and focus.', duration_minutes: 60, price: 2000 },
      { name: 'Personal Training', description: 'One-on-one coaching with a programme built for you.', duration_minutes: 60, price: 6000 },
      { name: 'Free Intro Class', description: 'Try any group class on us.', duration_minutes: 45, price: 0 }
    ]
  },
  site: {
    style: {
      mode: 'dark',
      colors: { background: '#0b0c0e', surface: '#16181c', text: '#f4f6f0', muted: '#9ca39a', primary: '#c6ff3d', primaryText: '#0b0c0e', accent: '#ff4d6d', heroText: '#ffffff' },
      headingFont: 'Bebas Neue', bodyFont: 'Inter', headingCase: 'uppercase', radius: 10, buttonShape: 'pill', buttonStyle: 'solid'
    },
    nav: { style: 'transparent', bookLabel: 'Book a class' },
    announcement: { enabled: true, text: 'First class free for new members', linkLabel: 'Claim it', target: 'book' },
    footer: { text: 'Strength, conditioning and yoga under one roof.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: hero('1534438327276-14e5300c3a48'), overlay: 0.55, align: 'left', height: 'full',
          eyebrow: 'Group classes · Personal training', headline: 'Stronger every session', subheadline: 'Coach-led HIIT, strength and yoga classes that meet you where you are.',
          ctaLabel: 'Book a class', ctaTarget: 'book', secondaryLabel: 'Meet the coaches', secondaryTarget: 'about'
        }),
        section('stats', 'stats', { items: [{ value: '40+', label: 'Classes a week' }, { value: '8', label: 'Certified coaches' }, { value: '1st', label: 'Class free' }] }),
        section('services', 'services', { title: 'Classes & training', subtitle: 'Drop in or train one-on-one.', limit: 6 }),
        section('highlights', 'highlights', { title: 'Why Pulse', items: [
          { icon: '⚡', title: 'Coached, not crowded', text: 'Max 14 people per class.' },
          { icon: '📈', title: 'Track progress', text: 'Monthly assessments and goal check-ins.' },
          { icon: '🧘', title: 'Recover right', text: 'Mobility and yoga built into every week.' }
        ] }),
        section('gallery-preview', 'gallery', { title: 'Inside the studio', layout: 'carousel', aspect: '4/5', images: [
          { url: tile('1517836357463-d25dfeac3438') }, { url: tile('1571019613454-1cb2f99b2d8b') }, { url: tile('1518611012118-696072aa579a') }, { url: tile('1534438327276-14e5300c3a48') }
        ] }),
        section('testimonials', 'testimonials', { title: 'Member results', items: [
          { quote: 'Down 9 kg and stronger than I’ve ever been. The coaches keep you honest.', name: 'Shanice P.', role: 'Member, 8 months' },
          { quote: 'The energy in HIIT Fusion is unmatched.', name: 'Ryan K.', role: 'Member, 1 year' }
        ] }),
        section('cta', 'cta', { title: 'Your first class is on us', text: 'Pick any group class this week.', buttonLabel: 'Book free class', target: 'book', imageUrl: banner('1571019613454-1cb2f99b2d8b') }),
        section('contact', 'contact', { title: 'Find the studio', hours: [{ day: 'Mon – Fri', time: '5:30 am – 9:00 pm' }, { day: 'Sat – Sun', time: '7:00 am – 2:00 pm' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'The coaches', subtitle: 'Certified, motivating and in your corner.', imageUrl: banner('1517836357463-d25dfeac3438'), overlay: 0.55 }),
        section('about-team', 'team', { title: 'Coaching team', members: [
          { name: 'Jordan', role: 'Head coach · Strength', bio: 'NSCA-certified strength coach.', photoUrl: square('1571019613454-1cb2f99b2d8b') },
          { name: 'Aaliyah', role: 'Yoga & mobility', bio: '500-hour registered yoga teacher.', photoUrl: square('1518611012118-696072aa579a') },
          { name: 'Chris', role: 'HIIT coach', bio: 'Former sprinter, current motivator.', photoUrl: square('1517836357463-d25dfeac3438') }
        ] }),
        section('about-story', 'intro', { eyebrow: 'Our mission', title: 'Fitness that fits your life', body: 'Pulse was built for busy people who want results without the guesswork. Short, effective sessions led by coaches who care.', imageUrl: portrait('1534438327276-14e5300c3a48') })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'Studio life', subtitle: 'Sweat, smiles and PBs.', imageUrl: banner('1534438327276-14e5300c3a48'), overlay: 0.55 }),
        section('gallery-main', 'gallery', { title: '', layout: 'grid', aspect: '4/5', images: [
          { url: tile('1517836357463-d25dfeac3438') }, { url: tile('1571019613454-1cb2f99b2d8b') }, { url: tile('1518611012118-696072aa579a') },
          { url: tile('1534438327276-14e5300c3a48') }, { url: tile('1517836357463-d25dfeac3438') }, { url: tile('1571019613454-1cb2f99b2d8b') }
        ] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Book a class', subtitle: 'Reserve your spot before it fills up.', imageUrl: banner('1518611012118-696072aa579a'), overlay: 0.6 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
