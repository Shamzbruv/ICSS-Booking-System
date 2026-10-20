// BrightPath Tutoring — industry starter with editable pages and a matching booking form.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'tutoring', label: 'BrightPath Tutoring',
  fallback: 'linear-gradient(135deg, #283353, #394f9c)',
  demo: { name: 'BrightPath Tutoring', tagline: "Make room for understanding, one lesson at a time.", location: 'Kingston, Jamaica', services: [{"name": "Mathematics Lesson", "description": "Service scope and price are confirmed before the appointment.", "duration_minutes": 60, "price": 2500}, {"name": "English Language Lesson", "description": "Service scope and price are confirmed before the appointment.", "duration_minutes": 60, "price": 2500}, {"name": "PEP Preparation Session", "description": "Service scope and price are confirmed before the appointment.", "duration_minutes": 60, "price": 3000}, {"name": "CSEC Study Consultation", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 30, "price": 0}] },
  site: {
    style: { mode: 'light', colors: { background: '#f8f9fe', surface: '#eceffb', text: '#283353', muted: '#65708c', primary: '#394f9c', primaryText: '#ffffff', accent: '#cf9d31', heroText: '#ffffff' }, headingFont: 'Poppins', bodyFont: 'Nunito Sans', headingCase: 'none', radius: 24, buttonShape: 'pill', buttonStyle: 'solid' },
    brand: { tagline: "Make room for understanding, one lesson at a time." },
    nav: { style: 'solid', bookLabel: "Book a lesson" },
    footer: { text: "Make room for understanding, one lesson at a time." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: hero('1503676260728-1c00da094a0b'), overlay: 0.6, height: 'tall', align: 'center', eyebrow: 'Tutoring & Lessons · Jamaica', headline: "A little guidance.\nA clearer path.", subheadline: "Make room for understanding, one lesson at a time.", ctaLabel: "Book a lesson", ctaTarget: 'book', secondaryLabel: 'Get to know us', secondaryTarget: 'about' }),
        section('home-services', 'services', { title: 'Find the right starting point', subtitle: "Share the learner\u2019s level and lesson goals. For a child, please use a parent or guardian\u2019s contact details.", limit: 6, showPrices: true, showDuration: true }),
        section('home-intro', 'intro', { title: "Progress starts with understanding.", body: "Book a lesson or start with a conversation about the learner\u2019s goals. Share the subject, grade level and topics that need attention so the session can be planned around their needs.", imageUrl: portrait('1434030216411-0b793f4b4173'), imageSide: 'right', ctaLabel: 'About us', ctaTarget: 'about' }),
        section('home-highlights', 'highlights', { title: 'Make a plan that works for you', items: [{"icon": "\ud83d\udcda", "title": "Choose your subject", "text": "Tell us the subject and grade or exam level."}, {"icon": "\ud83c\udfaf", "title": "Share your goals", "text": "Highlight topics or skills to work on."}, {"icon": "\ud83d\udca1", "title": "Plan the next step", "text": "Agree the lesson format and a suitable time."}] }),
        section('home-cta', 'cta', { title: 'Let’s plan your next step.', text: "Share the learner\u2019s level and lesson goals. For a child, please use a parent or guardian\u2019s contact details.", buttonLabel: "Book a lesson", target: 'book' }),
        section('home-contact', 'contact', { title: 'Talk to the team', hours: [{day:'Monday – Saturday',time:'By appointment'}] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "Progress starts with understanding.", subtitle: "Make room for understanding, one lesson at a time.", imageUrl: banner('1503676260728-1c00da094a0b'), overlay: 0.6 }),
        section('about-story', 'intro', { title: 'A clear plan, from the start.', body: "Book a lesson or start with a conversation about the learner\u2019s goals. Share the subject, grade level and topics that need attention so the session can be planned around their needs.", imageUrl: portrait('1434030216411-0b793f4b4173'), imageSide: 'left' }),
        section('about-faq', 'faq', {title:'Before you book',items:[{q:'What happens after I book?',a:"Share the learner\u2019s level and lesson goals. For a child, please use a parent or guardian\u2019s contact details."},{q:'What information should I share?',a:"Highlight topics or skills to work on."}]})
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'A closer look', subtitle: 'Ideas and details for your next booking.', imageUrl: banner('1503676260728-1c00da094a0b'), overlay: 0.55 }),
        section('gallery-main', 'gallery', { title: 'Inspiration', layout: 'grid', aspect: '3/2', images:[{url:tile('1503676260728-1c00da094a0b'),caption:'Inspiration'},{url:tile('1434030216411-0b793f4b4173'),caption:'The details'}] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: "Book a lesson", subtitle: "Share the learner\u2019s level and lesson goals. For a child, please use a parent or guardian\u2019s contact details.", imageUrl: banner('1503676260728-1c00da094a0b'), overlay: 0.65 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
