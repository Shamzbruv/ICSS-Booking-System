import drivingSchool from '../../site/presets/driving-lessons.js';
import { page, section } from '../../site/presets/helpers.js';

export const clarkiesSlug = 'clarkies-driving-school-preview';
const name = 'Clarkie’s Driving School';
const tagline = 'A lesson an hour gives more driving power.';
const address = '2–4 Strand Street, Montego Bay, St. James';
const art = '/images/starter-kits/';
const heroArt = art + 'clarkies-hero.webp';
const lessonArt = art + 'clarkies-lesson.webp';
const logo = art + 'clarkies-logo.webp';

const services = [
  {
    name: 'Beginner Automatic Course',
    price: 66000,
    description: '18-hour course for new drivers. The preview shows how to request a first session.'
  },
  {
    name: 'Refresher Automatic Course',
    price: 46000,
    description: '12-hour course to rebuild confidence and practise the situations you find tricky.'
  }
].map(service => ({ ...service, duration_minutes: 60, active: true }));

const locations = [
  { title: 'Montego Bay, St. James', text: 'Visit Clarkie’s at 2–4 Strand Street.' },
  { title: 'Lucea, Hanover', text: 'Contact the school to confirm a meeting point in Lucea.' },
  { title: 'Falmouth, Trelawny', text: 'Contact the school to confirm a meeting point in Falmouth.' }
];
const training = [
  { title: 'Automatic & standard lessons', text: 'Start with automatic, or ask the school about learning on a manual vehicle.' },
  { title: 'Defensive driving', text: 'Build habits for checking hazards, choosing a safe following distance and driving responsibly.' },
  { title: 'Classroom & road safety', text: 'Ask about classroom training and get familiar with the vehicle before heading out.' }
];

function courseCards(id) {
  return section(id, 'services', {
    title: 'Automatic course packages', subtitle: 'Reference rates from the school’s published flyer. Confirm current prices before enrolling.',
    showPrices: true, showDuration: false, ctaLabel: 'Preview booking'
  });
}

export const clarkiesDrivingSchool = {
  ...drivingSchool,
  fallback: 'linear-gradient(135deg, #142c24, #2c4537)',
  demo: { name, tagline, location: address, services },
  site: {
    ...drivingSchool.site,
    style: {
      ...drivingSchool.site.style,
      mode: 'light',
      colors: {
        background: '#f8f4ea', surface: '#fffdf7', text: '#182a22', muted: '#4b5a50',
        primary: '#1e5340', primaryText: '#ffffff', accent: '#957121', heroText: '#ffffff'
      },
      headingFont: 'Playfair Display',
      bodyFont: 'Inter',
      radius: 10
    },
    brand: { name, tagline, logoUrl: logo, showNameWithLogo: true },
    nav: { style: 'solid', bookLabel: 'Preview booking', sticky: true },
    contact: { address, phone: '+1 876-532-6086', whatsapp: '18765326086' },
    social: { instagramUrl: 'https://www.instagram.com/mr_clarkie1/' },
    seo: { title: 'Clarkie’s Driving School | Website Preview', description: 'Driving courses in Montego Bay, Lucea and Falmouth.', noIndex: true },
    footer: { text: 'Montego Bay · Lucea · Falmouth' },
    booking: {
      footerNote: 'Choose a course to try booking a first lesson. Times are for demonstration.',
      badge1: 'Established 1995', badge2: 'Western Jamaica'
    },
    pages: [
      page('home', [
        section('hero', 'hero', {
          mediaType:'image', imageUrl:heroArt, overlay:0.56, height:'tall', align:'left',
          eyebrow:'MONTEGO BAY · EST. 1995', headline:'Drive with confidence.',
          subheadline:'Learn the fundamentals, sharpen your skills and feel ready for the road with Clarkie’s Driving School.',
          ctaLabel:'Explore driving courses', ctaTarget:'about', secondaryLabel:'Find your location', secondaryTarget:'gallery'
        }),
        section('home-highlights', 'highlights', { title:'Learn the skills you’ll use every day', items:training }),
        section('home-intro','intro',{
          title:'A lesson an hour gives more driving power.',
          body:'Knowing your vehicle is part of learning to drive. From checking lights to building confidence on the road, start with the skills that matter for your next lesson.',
          imageUrl:lessonArt, imageSide:'right', ctaLabel:'Explore your options', ctaTarget:'about'
        }),
        courseCards('home-services'),
        section('home-contact', 'contact', { title:'Talk to Clarkie’s', subtitle:'For lesson availability or gift certificates, call or WhatsApp. Alternate phone: (876) 817-5676.', showMap:false, showHours:false })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title:'Driving courses', subtitle:'Find a course for your experience and goals.', imageUrl:lessonArt, overlay:0.58 }),
        courseCards('about-services'),
        section('about-training', 'highlights', { title:'More training options', items:training }),
        section('about-faq', 'faq', { title:'Before your first lesson', items:[
          { q:'Can I learn to drive a standard vehicle?', a:'Clarkie’s advertises standard and automatic driving lessons. Call or WhatsApp to confirm rates and vehicle availability for standard lessons.' },
          { q:'Can I purchase a gift certificate?', a:'Ask the school about gift certificates for beginner and refresher courses.' },
          { q:'What should I bring?', a:'Contact the school to confirm what you need for the course before your first session.' }
        ] })
      ], { label:'Courses' }),
      page('gallery', [
        section('feature-header', 'pageHeader', { title:'Find Clarkie’s near you', subtitle:'Driving lessons across western Jamaica.', imageUrl:heroArt, overlay:0.58 }),
        section('feature-details', 'highlights', { title:'Locations', items:locations }),
        section('feature-gallery', 'gallery', { title:'Behind the wheel', subtitle:'Illustrative images for this website preview.', layout:'grid', aspect:'3/2', images:[
          { url:heroArt, caption:'Learning to drive in western Jamaica' },
          { url:lessonArt, caption:'Getting to know the vehicle before a lesson' }
        ] }),
        section('feature-contact','contact',{title:'Confirm your meeting point',showMap:false,showHours:false})
      ], { label:'Locations' }),
      page('book', [
        section('book-header', 'pageHeader', { title:'Try booking a lesson', subtitle:'Choose a course and sample time to see how registration would work.', imageUrl:heroArt, overlay:0.68 }),
        section('booking-main','booking',{title:''})
      ], { label:'Book a lesson' })
    ]
  }
};
