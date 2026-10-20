// YaadFix Home Services — industry starter with editable pages and a matching booking form.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'home-repairs', label: 'YaadFix Home Services',
  fallback: 'linear-gradient(135deg, #343b39, #a95b20)',
  demo: { name: 'YaadFix Home Services', tagline: "Practical help for your home and workspace.", location: 'Kingston, Jamaica', services: [{"name": "Home Maintenance Assessment", "description": "Service scope and price are confirmed before the appointment.", "duration_minutes": 45, "price": 2500}, {"name": "Small Repair Visit", "description": "Service scope and price are confirmed before the appointment.", "duration_minutes": 60, "price": 4500}, {"name": "Plumbing Assessment", "description": "Service scope and price are confirmed before the appointment.", "duration_minutes": 45, "price": 2500}, {"name": "Painting & Refresh Consultation", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 45, "price": 0}] },
  site: {
    style: { mode: 'light', colors: { background: '#fbf8f2', surface: '#f0e9dc', text: '#343b39', muted: '#6b736e', primary: '#a95b20', primaryText: '#ffffff', accent: '#3a7468', heroText: '#ffffff' }, headingFont: 'Space Grotesk', bodyFont: 'Inter', headingCase: 'none', radius: 6, buttonShape: 'square', buttonStyle: 'solid' },
    brand: { tagline: "Practical help for your home and workspace." },
    nav: { style: 'solid', bookLabel: "Book a visit" },
    footer: { text: "Practical help for your home and workspace." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: hero('1504148455328-c376907d081c'), overlay: 0.6, height: 'tall', align: 'left', eyebrow: 'Home Repairs & Maintenance · Jamaica', headline: "Small fixes.\nA better place to live.", subheadline: "Practical help for your home and workspace.", ctaLabel: "Book a visit", ctaTarget: 'book', secondaryLabel: 'Get to know us', secondaryTarget: 'about' }),
        section('home-services', 'services', { title: 'Find the right starting point', subtitle: "An assessment may be needed before a final quotation. Specialist work is confirmed with the business.", limit: 6, showPrices: true, showDuration: true }),
        section('home-intro', 'intro', { title: "Start with a clear understanding of the job.", body: "Tell us what needs attention, where the job is and how to access the property. We can start with an assessment and agree the scope, materials and timing before work begins.", imageUrl: portrait('1600585154340-be6161a56a0c'), imageSide: 'right', ctaLabel: 'About us', ctaTarget: 'about' }),
        section('home-highlights', 'highlights', { title: 'Make a plan that works for you', items: [{"icon": "\ud83d\udee0\ufe0f", "title": "Describe the job", "text": "Share the issue and the result you want."}, {"icon": "\ud83c\udfe1", "title": "Arrange a visit", "text": "Include your address and access details."}, {"icon": "\ud83e\uddfe", "title": "Agree the work", "text": "Confirm scope and costs before work begins."}] }),
        section('home-cta', 'cta', { title: 'Let’s plan your next step.', text: "An assessment may be needed before a final quotation. Specialist work is confirmed with the business.", buttonLabel: "Book a visit", target: 'book' }),
        section('home-contact', 'contact', { title: 'Talk to the team', hours: [{day:'Monday – Saturday',time:'By appointment'}] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "Start with a clear understanding of the job.", subtitle: "Practical help for your home and workspace.", imageUrl: banner('1504148455328-c376907d081c'), overlay: 0.6 }),
        section('about-story', 'intro', { title: 'A clear plan, from the start.', body: "Tell us what needs attention, where the job is and how to access the property. We can start with an assessment and agree the scope, materials and timing before work begins.", imageUrl: portrait('1600585154340-be6161a56a0c'), imageSide: 'left' }),
        section('about-faq', 'faq', {title:'Before you book',items:[{q:'What happens after I book?',a:"An assessment may be needed before a final quotation. Specialist work is confirmed with the business."},{q:'What information should I share?',a:"Include your address and access details."}]})
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'A closer look', subtitle: 'Ideas and details for your next booking.', imageUrl: banner('1504148455328-c376907d081c'), overlay: 0.55 }),
        section('gallery-main', 'gallery', { title: 'Inspiration', layout: 'grid', aspect: '3/2', images:[{url:tile('1504148455328-c376907d081c'),caption:'Inspiration'},{url:tile('1600585154340-be6161a56a0c'),caption:'The details'}] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: "Book a visit", subtitle: "An assessment may be needed before a final quotation. Specialist work is confirmed with the business.", imageUrl: banner('1504148455328-c376907d081c'), overlay: 0.65 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
