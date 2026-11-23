import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find(item => item.key === 'expert-booking');
const workspace = '/images/starter-kits/consultant-workspace.webp';
const tagline = 'Independent advice for your next decision';
const bookLabel = 'Book a consultation';
const specialties = [
  { title: 'Choose the right tools', text: 'Compare options, understand what you actually need, and decide where to invest your time or budget.' },
  { title: 'Improve how you work', text: 'Talk through a process that’s slowing you down and identify practical ways to simplify it.' },
  { title: 'Review a plan or project', text: 'Bring a proposal, an idea or a decision you’re weighing. Get feedback on what to refine and what to do next.' }
];
const questions = [
  { q: 'Which session should I choose?', a: 'Start with the introductory call if you’re checking fit. Choose a consultation for one clear question or a deep dive for a larger project.' },
  { q: 'What should I prepare?', a: 'Start with the question you want answered or the outcome you want. A short summary on the booking form is enough to prepare for the first conversation.' },
  { q: 'How will we meet?', a: 'Meeting arrangements are confirmed after booking. Mention your preference when you describe what you’d like to discuss.' }
];

export default {
  key: kit.key,
  label: kit.name,
  fallback: 'linear-gradient(135deg, #0e263b, #16665d)',
  demo: {
    name: 'Andre Reid Advisory',
    tagline,
    location: 'Kingston, Jamaica · Online consultations',
    contact: { address: 'Kingston, Jamaica · Online consultations', email: 'andre@example.com' },
    services: kit.services.map((service, index) => ({
      ...service, active: true, price: [0, 4500, 7500][index]
    }))
  },
  site: {
    style: {
      colors: {
        background: '#f3f7f8', surface: '#ffffff', text: '#122837', muted: '#486475',
        primary: '#12665c', primaryText: '#ffffff', accent: '#12665c', heroText: '#ffffff'
      },
      headingFont: 'Manrope', bodyFont: 'Inter', radius: 12
    },
    brand: { tagline },
    nav: { style: 'transparent', bookLabel },
    booking: { footerNote: 'When booking, share a brief description of what you’d like to cover.' },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: workspace, mobileImageUrl: '/images/starter-kits/consultant-workspace-mobile.webp',
          overlay: 0.58, height: 'tall', align: 'left',
          headline: 'Get expert advice on your next move.',
          subheadline: 'Bring a question, a plan or a project. Get practical advice you can use to make a decision and move forward.',
          ctaLabel: bookLabel, ctaTarget: 'book', secondaryLabel: 'Explore areas of expertise', secondaryTarget: 'gallery'
        }),
        section('home-specialties', 'highlights', { title: 'What I can help with', items: specialties }),
        section('home-intro', 'intro', {
          title: 'An outside perspective',
          body: 'I help individuals and small teams work through decisions about technology, tools and how they get things done. Each conversation starts with what you’re trying to achieve.',
          imageUrl: kit.art, imageSide: 'right', ctaLabel: 'Get to know me', ctaTarget: 'about'
        }),
        section('home-services', 'services', {
          title: 'Consultations', subtitle: 'Choose an available session and a time that works for you.', showPrices: true, showDuration: true, ctaLabel: 'See available times'
        })
      ]),
      page('about', [
        section('about-header', 'pageHeader', {
          title: 'About the practice', subtitle: 'Independent consulting for individuals and small teams.', imageUrl: workspace, overlay: 0.68
        }),
        section('about-intro', 'intro', {
          title: 'How I work', imageUrl: kit.art, imageSide: 'left',
          body: 'We start with the outcome you want. Then we work through the options, the trade-offs and what you can do next. A session can help you prepare for a purchase, review a plan or get unstuck on a project.',
          ctaLabel: 'Explore areas of expertise', ctaTarget: 'gallery'
        }),
        section('about-contact', 'contact', {
          title: 'Get in touch', subtitle: 'Choose a session to talk through what you need.', showMap: false, showHours: false
        })
      ], { label: 'About' }),
      page('gallery', [
        section('expertise-header', 'pageHeader', {
          title: 'Areas of expertise', subtitle: 'Advice on tools, workflows and project decisions.', imageUrl: workspace, overlay: 0.68
        }),
        section('expertise-specialties', 'highlights', { title: 'What we can work through together', items: specialties }),
        section('expertise-services', 'services', { title: 'Find the right session', showPrices: true, showDuration: true, ctaLabel: 'See available times' }),
        section('expertise-faq', 'faq', { title: 'Before we meet', items: questions })
      ], { label: 'Expertise' }),
      page('book', [
        section('book-header', 'pageHeader', {
          title: bookLabel, subtitle: 'Choose a session and a time, then tell me what you’d like to discuss.', imageUrl: workspace, overlay: 0.72
        }),
        section('booking-main', 'booking', { title: '' }),
        section('book-faq', 'faq', { title: 'Booking questions', items: questions })
      ], { label: 'Book' })
    ]
  }
};
