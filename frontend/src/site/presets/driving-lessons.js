// Driving Lessons starter; the shared Website Builder edits these same sections.
import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find((item) => item.key === 'driving-lessons');
const art = kit.art;
const detailPhoto = '/images/starter-kits/driving-lessons-detail.webp';

export default {
  key: kit.key, label: kit.name, fallback: 'linear-gradient(135deg, #15232b, #334c54)',
  demo: { name: kit.name, tagline: "Practical instruction at your pace", location: 'Jamaica', services: kit.services.map((service) => ({ ...service, active: true })) },
  site: {
    style: {
      mode: 'light', colors: { background: '#f7f6ef', surface: '#ffffff', text: '#19282c', muted: '#514d52', primary: '#285047', primaryText: '#ffffff', accent: '#285047', heroText: '#ffffff' },
      headingFont: 'Barlow Semi Condensed', bodyFont: 'Inter', headingCase: 'none', radius: 12, buttonShape: 'rounded', buttonStyle: 'solid'
    },
    brand: { tagline: "Practical instruction at your pace" },
    nav: { style: 'solid', bookLabel: "Find a lesson" },
    footer: { text: "Practical instruction at your pace" },
    booking: { footerNote: "Share your preferred pickup area and transmission. The instructor confirms the meeting point and vehicle before a lesson." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: art, mobileImageUrl: '/images/starter-kits/driving-lessons-mobile.webp', overlay: 0.58, height: 'tall', align: 'left', eyebrow: "DRIVING LESSONS IN JAMAICA", headline: "Learn to drive with confidence.", subheadline: "Get one-to-one driving instruction for your first lesson, a refresher or road test practice.", ctaLabel: "Find a lesson", ctaTarget: 'book', secondaryLabel: "See lesson options", secondaryTarget: 'about' }),
        section('home-highlights', 'highlights', { title: "Find your starting point", items: [{"title": "Start behind the wheel", "text": "Begin with mirror checks, steering, smooth stops and safe observation."}, {"title": "Build confidence", "text": "Work on parking, busier routes and the manoeuvres that feel hardest."}, {"title": "Practise for your test", "text": "Share your test date if you have one so your instructor can plan the session."}] }),
        section('home-intro', 'intro', { title: "A steady start behind the wheel", body: "We’ll talk through your experience before you set off. On a first lesson, we start somewhere quiet and work on steering, mirror checks and smooth stops. At the end, we’ll go over what felt comfortable and what to practise next.", imageUrl: detailPhoto, imageSide: 'right', ctaLabel: "Areas & availability", ctaTarget: 'gallery' }),
        section('home-services', 'services', { title: "Find a lesson", subtitle: "Share your preferred pickup area and transmission. The instructor confirms the meeting point and vehicle before a lesson.", showPrices: false, ctaLabel: 'See available times' }),
        section('home-contact', 'contact', { title: 'Get in touch' })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "Lesson options", subtitle: "Find a session for your experience and goals.", imageUrl: detailPhoto, overlay: 0.67 }),
        section('about-options', 'highlights', { title: "Find your starting point", items: [{"title": "Start behind the wheel", "text": "Begin with mirror checks, steering, smooth stops and safe observation."}, {"title": "Build confidence", "text": "Work on parking, busier routes and the manoeuvres that feel hardest."}, {"title": "Practise for your test", "text": "Share your test date if you have one so your instructor can plan the session."}] }),
        section('about-faq', 'faq', { title: 'Good to know', items: [{"q": "Can I start with no experience?", "a": "Yes. Mention that this would be your first lesson so we can plan around the basics."}, {"q": "How do I get a price?", "a": "Send the lesson type and area you have in mind, and ask for the current rate and available times."}] }),
        section('about-cta', 'cta', { title: "Start at your own pace", text: "See what to expect before you get in the driver’s seat.", buttonLabel: "Find a lesson", target: 'book' })
      ], { label: "Lesson options" }),
      page('gallery', [
        section('feature-header', 'pageHeader', { title: "Areas & availability", subtitle: "Plan where to meet and what to bring.", imageUrl: detailPhoto, overlay: 0.67 }),
        section('feature-details', 'highlights', { title: "Areas & availability", items: [{"title": "Where we meet", "text": "Share your parish, community and a nearby landmark. Confirm the meeting point before your lesson."}, {"title": "Manual or automatic", "text": "Tell us your preference when booking. Your instructor will confirm the available vehicle."}, {"title": "Prepare for the lesson", "text": "Ask your instructor what you need to bring; leave permit numbers or other private information out of the form."}] }),
        section('feature-cta', 'cta', { title: 'Talk with us about the next step', buttonLabel: "Find a lesson", target: 'book' })
      ], { label: "Areas & availability" }),
      page('book', [
        section('book-header', 'pageHeader', { title: "Find a lesson", subtitle: "Share your preferred pickup area and transmission. The instructor confirms the meeting point and vehicle before a lesson.", imageUrl: art, overlay: 0.72 }),
        section('booking-main', 'booking', { title: '' })
      ], { label: "Find a lesson" })
    ]
  }
};
