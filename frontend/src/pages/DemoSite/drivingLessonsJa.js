import drivingSchool from '../../site/presets/driving-lessons.js';
import { page, section } from '../../site/presets/helpers.js';

export const drivingLessonsJaSlug = 'driving-lessons-ja-preview';
const name = 'Driving Lessons JA';
const tagline = 'Creating Competent Drivers';
const locations = 'Kingston · National Heroes Park\nPortmore · KFC parking lot at Portmore Mall';
const art = '/images/starter-kits/';
const hero = art + 'driving-ja-hero.webp';
const lesson = art + 'driving-ja-lesson.webp';
const road = art + 'driving-ja-road.webp';

const services = [
  [2, 7000], [3, 10500], [6, 20000], [8, 25000], [10, 31000], [15, 45000]
].map(([count, price]) => ({
  name: `${count} Driving Lessons`,
  description: '45 minutes per lesson. A separate J$1,000 registration fee applies.',
  duration_minutes: 45,
  price,
  active: true
}));

const pickup = [
  { title: 'Kingston', text: 'Meet at National Heroes Park.' },
  { title: 'Portmore', text: 'Meet in the KFC parking lot at Portmore Mall.' },
  { title: 'Monday to Sunday', text: '9:00 a.m. to 5:00 p.m. Confirm your available times with the school.' }
];

const lessonPackages = (id) => section(id, 'services', {
  title: 'Driving lesson packages',
  subtitle: 'Prices in Jamaican dollars. Each session is 45 minutes. Registration is an additional J$1,000.',
  showPrices: true,
  showDuration: true,
  limit: 6,
  ctaLabel: 'Preview booking'
});

const nextStep = (id) => section(id, 'cta', {
  title: 'Ready to get behind the wheel?',
  text: 'Choose a package and try the booking experience.',
  buttonLabel: 'Preview booking',
  target: 'book'
});

export const drivingLessonsJa = {
  ...drivingSchool,
  demo: { name, tagline, location: locations, services },
  site: {
    ...drivingSchool.site,
    style: {
      ...drivingSchool.site.style,
      mode: 'dark',
      colors: {
        background: '#101010', surface: '#1e1e1e', text: '#fffaf0', muted: '#c6c2ba',
        primary: '#ffda26', primaryText: '#15110a', accent: '#ffda26', heroText: '#ffffff'
      },
      headingFont: 'Barlow Condensed',
      radius: 10
    },
    brand: { name, tagline, logoUrl: art + 'driving-ja-logo.webp', showNameWithLogo: true },
    nav: { style: 'solid', bookLabel: 'Preview booking', sticky: true },
    contact: { address: locations, phone: '+1 876-456-4057', whatsapp: '18764564057', email: 'drivinglessonsja@gmail.com' },
    social: { instagramUrl: 'https://www.instagram.com/driving_lessons_ja/' },
    footer: { text: tagline },
    seo: { title: 'Driving Lessons JA | Website Preview', description: 'Driving lesson packages in Kingston and Portmore.', noIndex: true },
    booking: {
      footerNote: 'This preview uses sample times. Select a package to try booking its first 45-minute lesson.',
      badge1: 'Kingston & Portmore',
      badge2: '45-minute lessons'
    },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: hero, overlay: 0.54, height: 'tall', align: 'left',
          eyebrow: 'KINGSTON & PORTMORE',
          headline: 'Get confident behind the wheel.',
          subheadline: 'From your first time in the driver’s seat to road test practice, find a lesson package that fits your pace.',
          ctaLabel: 'See lesson packages', ctaTarget: 'about', secondaryLabel: 'View pickup locations', secondaryTarget: 'gallery'
        }),
        section('home-highlights', 'highlights', { title: 'Find your starting point', items: [
          { title: 'Your first lesson', text: 'Get comfortable with the controls, steering, mirror checks and smooth stops.' },
          { title: 'Build road confidence', text: 'Practise parking, turns and the manoeuvres you want to feel more comfortable doing.' },
          { title: 'Prepare for your driving test', text: 'Ask about assessments, road code resources and vehicle use for your test.' }
        ] }),
        section('home-intro', 'intro', {
          title: 'Creating Competent Drivers',
          body: 'Book a 45-minute session in Kingston or Portmore. Start with a shorter package to build confidence, or choose more time behind the wheel to practise consistently.',
          imageUrl: lesson, imageSide: 'right', ctaLabel: 'Compare packages', ctaTarget: 'about'
        }),
        lessonPackages('home-services'),
        section('home-contact', 'contact', {
          title: 'Contact Driving Lessons JA', showMap: false, showHours: true, hours: [{ day: 'Monday–Sunday', time: '9:00 a.m.–5:00 p.m.' }]
        })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'Lesson packages & rates', subtitle: 'Pick the amount of practice that works for you.', imageUrl: lesson, overlay: 0.65 }),
        lessonPackages('about-services'),
        section('about-options', 'highlights', { title: 'More ways to prepare', items: [
          { title: 'Assessment · J$5,000', text: 'Ask about an assessment to see what to practise next.' },
          { title: 'Road Code Book · J$2,000', text: 'Ask about the study guide featured on the school’s Instagram.' },
          { title: 'Gift vouchers', text: 'Contact the school for gift voucher details and availability.' }
        ] }),
        section('about-faq', 'faq', { title: 'Before you book', items: [
          { q: 'How long is each session?', a: 'Lessons are 45 minutes each. The posted registration fee is J$1,000, separate from the package price.' },
          { q: 'Can I ask about pickup or manual lessons?', a: 'Yes. Contact the school to confirm pickup options and vehicle availability before booking.' },
          { q: 'Does the school offer chauffeur service?', a: 'The school advertises chauffeur services for weddings, airport transfers and special occasions. Contact them to confirm availability and pricing.' }
        ] }),
        nextStep('about-cta')
      ], { label: 'Lesson packages' }),
      page('gallery', [
        section('feature-header', 'pageHeader', { title: 'Pickup locations', subtitle: 'Two meeting points for your driving lessons.', imageUrl: hero, overlay: 0.65 }),
        section('feature-details', 'highlights', { title: 'Where to meet', items: pickup }),
        section('lesson-gallery', 'gallery', {
          title: 'Life behind the wheel', subtitle: 'Illustrative images for this website preview.', aspect: '3/2', images: [
            { url: hero, caption: 'Learner car on a Kingston road' },
            { url: lesson, caption: 'One-to-one practice behind the wheel' },
            { url: road, caption: 'Road code study and lesson preparation' }
          ]
        }),
        nextStep('feature-cta')
      ], { label: 'Pickup & gallery' }),
      page('book', [
        section('book-header', 'pageHeader', {
          title: 'Book your first lesson', subtitle: 'Choose your package, try an available time and see how booking would work.',
          imageUrl: hero, overlay: 0.7
        }),
        section('booking-main', 'booking', { title: '' })
      ], { label: 'Book a lesson' })
    ]
  }
};
