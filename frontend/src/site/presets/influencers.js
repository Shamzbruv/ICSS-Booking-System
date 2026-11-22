import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find(item => item.key === 'influencers');
const art = kit.art;
const images = '/images/starter-kits/';
const tagline = 'Jamaican content creator & event host';
const bookingNote = 'Book a discovery call to discuss your project. Rates, deliverables, usage rights and event dates are agreed separately.';
const questions = [
  { q: 'Can I book content for my brand’s own channels?', a: 'Yes. Choose the UGC & Content Production Call for content you want to publish on your own channels. We’ll discuss formats, permissions and any paid ad usage.' },
  { q: 'Can I check availability for a specific event?', a: 'Choose the Event Hosting & Appearances Call and include the event date, parish and venue. We’ll confirm availability and discuss the role before you commit.' },
  { q: 'What should I bring to the call?', a: 'A short brief is enough. Share your audience, preferred platforms, expected deliverables, timeline and budget range if you have one.' }
];
const offerings = [
  { title: 'Sponsored content', text: 'Plan a brand partnership, product feature or social campaign for Instagram, TikTok or YouTube.' },
  { title: 'UGC & production', text: 'Commission short-form videos, product demos or lifestyle photos for your brand’s own channels.' },
  { title: 'Hosting & appearances', text: 'Discuss launches, panels, community events or on-location activations in Jamaica.' }
];

export default {
  key: kit.key, label: 'Influencers & Content Creators',
  fallback: 'linear-gradient(135deg, #211126, #572453)',
  demo: {
    name: 'Zuri James', tagline, services: kit.services,
    contact: { address: 'Kingston, Jamaica · Available for projects islandwide', email: 'zuri@example.com' },
    galleryImages: [
      { url: images + 'creator-product.webp', caption: 'Product launch concept' },
      { url: images + 'creator-lifestyle.webp', caption: 'Kingston lifestyle concept' },
      { url: images + 'creator-hosting.webp', caption: 'Event hosting concept' }
    ]
  },
  site: {
    style: {
      mode: 'dark',
      colors: { background: '#1c1023', surface: '#2b1933', text: '#fff3eb', muted: '#dec9db', primary: '#ffad77', primaryText: '#26152b', accent: '#ffad77', heroText: '#fff3eb' },
      headingFont: 'Fraunces', bodyFont: 'DM Sans', headingCase: 'none', radius: 16, buttonShape: 'pill', buttonStyle: 'solid'
    },
    brand: { tagline },
    nav: { style: 'transparent', bookLabel: 'Pitch a project' },
    booking: { footerNote: bookingNote },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType: 'image', imageUrl: art, mobileImageUrl: images + 'influencers-mobile.webp',
          overlay: 0.52, height: 'tall', align: 'left',
          eyebrow: 'Content creator & event host',
          headline: 'Stories with a Jamaican point of view.',
          subheadline: 'Brand campaigns, original content and live events. Tell me what you’re planning and let’s see what we can make together.',
          ctaLabel: 'Pitch a project', ctaTarget: 'book', secondaryLabel: 'Explore the portfolio', secondaryTarget: 'gallery'
        }),
        section('home-offerings', 'highlights', { title: 'How we can work together', items: offerings }),
        section('home-portfolio', 'intro', {
          title: 'See what I create',
          body: 'Explore the formats I work in, from short social videos and product stories to live hosting.',
          imageUrl: images + 'creator-lifestyle.webp', imageSide: 'right', ctaLabel: 'View portfolio', ctaTarget: 'gallery'
        }),
        section('home-contact', 'contact', { title: 'Get in touch', showMap: false })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'Partnerships', subtitle: 'Campaigns, content production and live events.', imageUrl: art, overlay: 0.72 }),
        section('about-services', 'services', { title: 'Choose a discovery call', showPrices: false, showDuration: true, ctaLabel: 'See available times' }),
        section('about-faq', 'faq', { title: 'Before you send a brief', items: questions })
      ], { label: 'Partnerships' }),
      page('gallery', [
        section('portfolio-header', 'pageHeader', { title: 'Portfolio', subtitle: 'Content for social campaigns, brand channels and live audiences.', imageUrl: art, overlay: 0.73 }),
        section('portfolio-gallery', 'gallery', { title: 'Selected work', layout: 'grid', aspect: '4/5', images: [] }),
        section('portfolio-showreel', 'video', { title: 'Showreel', videoUrl: '' }),
        section('portfolio-offerings', 'highlights', { title: 'Formats & collaborations', items: offerings }),
        section('portfolio-cta', 'cta', { title: 'Have a project in mind?', buttonLabel: 'Pitch a project', target: 'book' })
      ], { label: 'Portfolio' }),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Pitch a project', subtitle: bookingNote, imageUrl: art, overlay: 0.74 }),
        section('booking-main', 'booking', { title: '' })
      ], { label: 'Pitch a project' })
    ]
  }
};
