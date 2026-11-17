// Photography & Video starter; the shared Website Builder edits these same sections.
import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find((item) => item.key === 'photography-video');
const art = kit.art;

export default {
  key: kit.key, label: kit.name, fallback: 'linear-gradient(135deg, #261e35, #643f86)',
  demo: { name: kit.name, tagline: "Portraits, films and brand stories", location: 'Jamaica', services: kit.services.map((service) => ({ ...service, active: true })) },
  site: {
    style: {
      mode: 'light', colors: { background: '#f4edfb', surface: '#ffffff', text: '#261e35', muted: '#514d52', primary: '#643f86', primaryText: '#ffffff', accent: '#643f86', heroText: '#ffffff' },
      headingFont: 'DM Serif Display', bodyFont: 'Inter', headingCase: 'none', radius: 20, buttonShape: 'rounded', buttonStyle: 'solid'
    },
    brand: { tagline: "Portraits, films and brand stories" },
    nav: { style: 'transparent', bookLabel: "Discuss a shoot" },
    announcement: { enabled: true, text: "Portraits · Events · Brand content", linkLabel: "Session options", target: 'about' },
    footer: { text: "Portraits, films and brand stories" },
    booking: { footerNote: "A discovery call is a planning appointment. Shoot availability, pricing, usage rights and delivery dates are agreed separately." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: art, overlay: 0.66, height: 'full', align: 'left', eyebrow: "PORTRAITS · EVENTS · BRAND STORIES", headline: "Make the moment last.", subheadline: "Photos and films for milestones, personal brands and the people you want to remember as they are.", ctaLabel: "Discuss a shoot", ctaTarget: 'book', secondaryLabel: "Session options", secondaryTarget: 'about' }),
        section('home-highlights', 'highlights', { title: "What we create", items: [{"icon": "01", "title": "Portraits", "text": "Plan the people, location and mood for a personal, family or graduation session."}, {"icon": "02", "title": "Events", "text": "Highlight the people and moments you want covered, from arrivals to the last toast."}, {"icon": "03", "title": "Brand content", "text": "Discuss how the finished photos or video will be used and when you need them."}] }),
        section('home-intro', 'intro', { title: "A little direction, room to be yourself", body: "We start with a conversation about the people, the place and what you want to remember. That helps us choose a setting and pace that feel right.", imageUrl: art, imageSide: 'right', ctaLabel: "Portfolio & prep", ctaTarget: 'gallery' }),
        section('home-services', 'services', { title: "Discuss a shoot", subtitle: "A discovery call is a planning appointment. Shoot availability, pricing, usage rights and delivery dates are agreed separately.", showPrices: false, ctaLabel: 'See available times' }),
        section('home-contact', 'contact', { title: 'Get in touch' })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "Session options", subtitle: "Portraits, films and brand stories", imageUrl: art, overlay: 0.67 }),
        section('about-options', 'highlights', { title: "What we create", items: [{"icon": "01", "title": "Portraits", "text": "Plan the people, location and mood for a personal, family or graduation session."}, {"icon": "02", "title": "Events", "text": "Highlight the people and moments you want covered, from arrivals to the last toast."}, {"icon": "03", "title": "Brand content", "text": "Discuss how the finished photos or video will be used and when you need them."}] }),
        section('about-faq', 'faq', { title: 'Good to know', items: [{"q": "Do you travel?", "a": "Include the parish and venue in your enquiry so we can confirm travel and any associated fees."}, {"q": "Do you offer video?", "a": "Tell us if you need short clips, an event film or another format. We’ll discuss the work and availability."}] }),
        section('about-cta', 'cta', { title: "Let’s plan the shot", text: "Choose a session type and tell us what you want the finished images to do.", buttonLabel: "Discuss a shoot", target: 'book' })
      ], { label: "Session options" }),
      page('gallery', [
        section('feature-header', 'pageHeader', { title: "Portfolio & prep", subtitle: "Portraits, films and brand stories", imageUrl: art, overlay: 0.67 }),
        section('feature-details', 'highlights', { title: "Portfolio & prep", items: [{"icon": "01", "title": "Before the shoot", "text": "Bring location ideas, a schedule and examples of the look you want."}, {"icon": "02", "title": "Build a shot list", "text": "Mention the people, details and moments that can’t be missed."}, {"icon": "03", "title": "After the shoot", "text": "Ask about editing, delivery dates, formats and usage before you confirm."}] }),
      section('feature-media', 'gallery', { title: "Selected work", layout: 'masonry', aspect: '3/2', images: [] }),
        section('feature-cta', 'cta', { title: 'Talk with us about the next step', buttonLabel: "Discuss a shoot", target: 'book' })
      ], { label: "Portfolio & prep" }),
      page('book', [
        section('book-header', 'pageHeader', { title: "Discuss a shoot", subtitle: "A discovery call is a planning appointment. Shoot availability, pricing, usage rights and delivery dates are agreed separately.", imageUrl: art, overlay: 0.72 }),
        section('booking-main', 'booking', { title: '' })
      ], { label: "Discuss a shoot" })
    ]
  }
};
