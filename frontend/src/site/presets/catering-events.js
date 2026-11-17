// Catering & Events starter; the shared Website Builder edits these same sections.
import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find((item) => item.key === 'catering-events');
const art = kit.art;

export default {
  key: kit.key, label: kit.name, fallback: 'linear-gradient(135deg, #312317, #884025)',
  demo: { name: kit.name, tagline: "Food for the people around your table", location: 'Jamaica', services: kit.services.map((service) => ({ ...service, active: true })) },
  site: {
    style: {
      mode: 'light', colors: { background: '#fff4df', surface: '#ffffff', text: '#312317', muted: '#514d52', primary: '#884025', primaryText: '#ffffff', accent: '#884025', heroText: '#ffffff' },
      headingFont: 'Lora', bodyFont: 'Inter', headingCase: 'none', radius: 20, buttonShape: 'rounded', buttonStyle: 'solid'
    },
    brand: { tagline: "Food for the people around your table" },
    nav: { style: 'solid', bookLabel: "Plan my menu" },
    announcement: { enabled: true, text: "Family celebrations · Private dining · Team lunches", linkLabel: "Menu ideas", target: 'about' },
    footer: { text: "Food for the people around your table" },
    booking: { footerNote: "The consultation reserves a planning appointment. The team confirms the final menu, event availability and quote separately." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: art, overlay: 0.66, height: 'tall', align: 'center', eyebrow: "MENUS · CELEBRATIONS · OFFICE LUNCHES", headline: "Good food brings us together.", subheadline: "Plan a menu around the gathering, the venue and the people you’re serving.", ctaLabel: "Book a menu consultation", ctaTarget: 'book', secondaryLabel: "Menu ideas", secondaryTarget: 'about' }),
        section('home-highlights', 'highlights', { title: "A menu for the moment", items: [{"icon": "01", "title": "Family celebrations", "text": "Build a spread around family favourites, sides and something sweet."}, {"icon": "02", "title": "Work lunches", "text": "Discuss individual meal boxes, shared trays and how many people you’re serving."}, {"icon": "03", "title": "Private dining", "text": "Tell us how you want the occasion to feel and what facilities are available."}] }),
        section('home-intro', 'intro', { title: "Made for the people around your table", body: "The best menus fit the gathering. Tell us who’s coming and how you want to serve them, and we’ll work through the options together.", imageUrl: art, imageSide: 'left', ctaLabel: "Event planning", ctaTarget: 'gallery' }),
        section('home-services', 'services', { title: "Plan my menu", subtitle: "The consultation reserves a planning appointment. The team confirms the final menu, event availability and quote separately.", showPrices: false, ctaLabel: 'See available times' }),
        section('home-contact', 'contact', { title: 'Get in touch' })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "Menu ideas", subtitle: "Food for the people around your table", imageUrl: art, overlay: 0.67 }),
        section('about-options', 'highlights', { title: "A menu for the moment", items: [{"icon": "01", "title": "Family celebrations", "text": "Build a spread around family favourites, sides and something sweet."}, {"icon": "02", "title": "Work lunches", "text": "Discuss individual meal boxes, shared trays and how many people you’re serving."}, {"icon": "03", "title": "Private dining", "text": "Tell us how you want the occasion to feel and what facilities are available."}] }),
        section('about-faq', 'faq', { title: 'Good to know', items: [{"q": "Can I customise a menu?", "a": "Yes. Share what you have in mind and we’ll discuss suitable options."}, {"q": "When is my date confirmed?", "a": "Ask about availability and confirm the menu, quote and booking terms directly with the caterer."}] }),
        section('about-cta', 'cta', { title: "Bring your guest list", text: "Start with a date, a location and what you’d like to serve.", buttonLabel: "Plan my menu", target: 'book' })
      ], { label: "Menu ideas" }),
      page('gallery', [
        section('feature-header', 'pageHeader', { title: "Event planning", subtitle: "Food for the people around your table", imageUrl: art, overlay: 0.67 }),
        section('feature-details', 'highlights', { title: "Event planning", items: [{"icon": "01", "title": "Start with the basics", "text": "Have your date, venue and expected guest count ready."}, {"icon": "02", "title": "Consider the venue", "text": "Tell us whether there’s a kitchen, refrigeration or an area to serve from."}, {"icon": "03", "title": "Discuss dietary needs", "text": "Raise requirements early so the caterer can explain what they can safely accommodate."}] }),
        section('feature-cta', 'cta', { title: 'Talk with us about the next step', buttonLabel: "Plan my menu", target: 'book' })
      ], { label: "Event planning" }),
      page('book', [
        section('book-header', 'pageHeader', { title: "Book a menu consultation", subtitle: "The consultation reserves a planning appointment. The team confirms the final menu, event availability and quote separately.", imageUrl: art, overlay: 0.72 }),
        section('booking-main', 'booking', { title: '' })
      ], { label: "Plan my menu" })
    ]
  }
};
