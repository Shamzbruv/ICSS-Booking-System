// Tutoring & Coaching starter; the shared Website Builder edits these same sections.
import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find((item) => item.key === 'tutoring-coaching');
const art = kit.art;

export default {
  key: kit.key, label: kit.name, fallback: 'linear-gradient(135deg, #173341, #235f87)',
  demo: { name: kit.name, tagline: "Small steps. Stronger skills.", location: 'Jamaica', services: kit.services.map((service) => ({ ...service, active: true })) },
  site: {
    style: {
      mode: 'light', colors: { background: '#eef8f7', surface: '#ffffff', text: '#173341', muted: '#514d52', primary: '#235f87', primaryText: '#ffffff', accent: '#235f87', heroText: '#ffffff' },
      headingFont: 'Poppins', bodyFont: 'Inter', headingCase: 'none', radius: 20, buttonShape: 'pill', buttonStyle: 'solid'
    },
    brand: { tagline: "Small steps. Stronger skills." },
    nav: { style: 'solid', bookLabel: "Find a session" },
    announcement: { enabled: true, text: "Subject support · PEP and CSEC preparation · Study skills", linkLabel: "Subjects & formats", target: 'about' },
    footer: { text: "Small steps. Stronger skills." },
    booking: { footerNote: "Use a parent or guardian’s contact details when booking for a child. Share learning goals rather than school records or other private details." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: art, overlay: 0.66, height: 'tall', align: 'center', eyebrow: "STUDY SKILLS · SUBJECT SUPPORT · EXAM PREP", headline: "Small steps. Stronger skills.", subheadline: "Get support with tricky topics, exam practice and a study plan you can stick with.", ctaLabel: "Find a tutoring session", ctaTarget: 'book', secondaryLabel: "Subjects & formats", secondaryTarget: 'about' }),
        section('home-highlights', 'highlights', { title: "Support for the way you learn", items: [{"icon": "01", "title": "Subject support", "text": "Work through tough topics and learn how to spot mistakes."}, {"icon": "02", "title": "Exam preparation", "text": "Practise questions, review your answers and work on timing."}, {"icon": "03", "title": "Study routines", "text": "Build a revision plan around your available time and priorities."}] }),
        section('home-intro', 'intro', { title: "Make the next step clear", body: "We start by finding out what the learner already understands. Then we work through one skill at a time and use practice to decide what to tackle next.", imageUrl: art, imageSide: 'left', ctaLabel: "Getting started", ctaTarget: 'gallery' }),
        section('home-services', 'services', { title: "Find a session", subtitle: "Use a parent or guardian’s contact details when booking for a child. Share learning goals rather than school records or other private details.", showPrices: false, ctaLabel: 'See available times' }),
        section('home-contact', 'contact', { title: 'Get in touch' })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "Subjects & formats", subtitle: "Small steps. Stronger skills.", imageUrl: art, overlay: 0.67 }),
        section('about-options', 'highlights', { title: "Support for the way you learn", items: [{"icon": "01", "title": "Subject support", "text": "Work through tough topics and learn how to spot mistakes."}, {"icon": "02", "title": "Exam preparation", "text": "Practise questions, review your answers and work on timing."}, {"icon": "03", "title": "Study routines", "text": "Build a revision plan around your available time and priorities."}] }),
        section('about-faq', 'faq', { title: 'Good to know', items: [{"q": "How do I choose a lesson format?", "a": "Tell us whether you prefer online or in-person support and ask what is available."}, {"q": "Can we focus on one topic?", "a": "Yes. Share the topic or goal so the tutor can discuss a targeted session."}] }),
        section('about-cta', 'cta', { title: "Start with a goal", text: "Tell us the subject, grade or exam and the areas that need attention.", buttonLabel: "Find a session", target: 'book' })
      ], { label: "Subjects & formats" }),
      page('gallery', [
        section('feature-header', 'pageHeader', { title: "Getting started", subtitle: "Small steps. Stronger skills.", imageUrl: art, overlay: 0.67 }),
        section('feature-details', 'highlights', { title: "Getting started", items: [{"icon": "01", "title": "Tell us the goal", "text": "Ask which subjects and grade levels are available, and share the exam or topic that needs attention."}, {"icon": "02", "title": "Choose a format", "text": "Tell us whether you prefer online or in-person support."}, {"icon": "03", "title": "Prepare for the first session", "text": "Ask what materials to bring and how progress will be reviewed."}] }),
        section('feature-cta', 'cta', { title: 'Talk with us about the next step', buttonLabel: "Find a session", target: 'book' })
      ], { label: "Getting started" }),
      page('book', [
        section('book-header', 'pageHeader', { title: "Find a tutoring session", subtitle: "Use a parent or guardian’s contact details when booking for a child. Share learning goals rather than school records or other private details.", imageUrl: art, overlay: 0.72 }),
        section('booking-main', 'booking', { title: '' })
      ], { label: "Find a session" })
    ]
  }
};
