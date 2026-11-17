// Home Services starter; the shared Website Builder edits these same sections.
import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find((item) => item.key === 'home-services');
const art = kit.art;

export default {
  key: kit.key, label: kit.name, fallback: 'linear-gradient(135deg, #1e342c, #21645e)',
  demo: { name: kit.name, tagline: "Repairs, installations and upkeep", location: 'Jamaica', services: kit.services.map((service) => ({ ...service, active: true })) },
  site: {
    style: {
      mode: 'light', colors: { background: '#f0f5e9', surface: '#ffffff', text: '#1e342c', muted: '#514d52', primary: '#21645e', primaryText: '#ffffff', accent: '#21645e', heroText: '#ffffff' },
      headingFont: 'Space Grotesk', bodyFont: 'Inter', headingCase: 'none', radius: 12, buttonShape: 'rounded', buttonStyle: 'solid'
    },
    brand: { tagline: "Repairs, installations and upkeep" },
    nav: { style: 'solid', bookLabel: "Request a visit" },
    announcement: { enabled: true, text: "Repairs · Installations · Property upkeep", linkLabel: "Services offered", target: 'about' },
    footer: { text: "Repairs, installations and upkeep" },
    booking: { footerNote: "This books an initial discussion. Ask whether an inspection is needed before a quote. Do not include door codes or private access details." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: art, overlay: 0.66, height: 'tall', align: 'left', eyebrow: "REPAIRS · INSTALLATIONS · UPKEEP", headline: "Get the job done right.", subheadline: "Tell us what needs attention, where you’re based and when you’d like the work done.", ctaLabel: "Request a site visit", ctaTarget: 'book', secondaryLabel: "Services offered", secondaryTarget: 'about' }),
        section('home-highlights', 'highlights', { title: "How we can help", items: [{"icon": "01", "title": "Repairs", "text": "Describe what isn’t working, when it started and which areas are affected."}, {"icon": "02", "title": "Installation", "text": "Share the item, measurements if available and any practical restrictions."}, {"icon": "03", "title": "Property maintenance", "text": "Ask about one-off upkeep or regular maintenance for your property."}] }),
        section('home-intro', 'intro', { title: "Clear communication from the first visit", body: "We start by understanding the job. We’ll discuss access, materials and timing so you know what needs to be agreed before work starts.", imageUrl: art, imageSide: 'right', ctaLabel: "Coverage & quotes", ctaTarget: 'gallery' }),
        section('home-services', 'services', { title: "Request a visit", subtitle: "This books an initial discussion. Ask whether an inspection is needed before a quote. Do not include door codes or private access details.", showPrices: false, ctaLabel: 'See available times' }),
        section('home-contact', 'contact', { title: 'Get in touch' })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "Services offered", subtitle: "Repairs, installations and upkeep", imageUrl: art, overlay: 0.67 }),
        section('about-options', 'highlights', { title: "How we can help", items: [{"icon": "01", "title": "Repairs", "text": "Describe what isn’t working, when it started and which areas are affected."}, {"icon": "02", "title": "Installation", "text": "Share the item, measurements if available and any practical restrictions."}, {"icon": "03", "title": "Property maintenance", "text": "Ask about one-off upkeep or regular maintenance for your property."}] }),
        section('about-faq', 'faq', { title: 'Good to know', items: [{"q": "Can I get a quote without a site visit?", "a": "Some jobs can be discussed from a description and photos. Others need measurements or an on-site inspection."}, {"q": "What should I send first?", "a": "Start with your parish and a short description. Leave out door codes and other private access details."}] }),
        section('about-cta', 'cta', { title: "A clearer quote starts here", text: "Tell us the job type and parish so we can discuss the next step.", buttonLabel: "Request a visit", target: 'book' })
      ], { label: "Services offered" }),
      page('gallery', [
        section('feature-header', 'pageHeader', { title: "Coverage & quotes", subtitle: "Repairs, installations and upkeep", imageUrl: art, overlay: 0.67 }),
        section('feature-details', 'highlights', { title: "Coverage & quotes", items: [{"icon": "01", "title": "Tell us where you’re based", "text": "Include your community and parish to check whether we cover the area."}, {"icon": "02", "title": "Decide whether a visit is needed", "text": "Some jobs can be discussed from a description; others need measurements or an inspection."}, {"icon": "03", "title": "Review the quote", "text": "Ask what the estimate covers, what materials are included and how changes are handled."}] }),
        section('feature-cta', 'cta', { title: 'Talk with us about the next step', buttonLabel: "Request a visit", target: 'book' })
      ], { label: "Coverage & quotes" }),
      page('book', [
        section('book-header', 'pageHeader', { title: "Request a site visit", subtitle: "This books an initial discussion. Ask whether an inspection is needed before a quote. Do not include door codes or private access details.", imageUrl: art, overlay: 0.72 }),
        section('booking-main', 'booking', { title: '' })
      ], { label: "Request a visit" })
    ]
  }
};
