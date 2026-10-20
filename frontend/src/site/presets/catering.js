// Yaad Table Catering — industry starter with editable pages and a matching booking form.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'catering', label: 'Yaad Table Catering',
  fallback: 'linear-gradient(135deg, #3d2c23, #8c432c)',
  demo: { name: 'Yaad Table Catering', tagline: "Good food. Thoughtful planning. Shared moments.", location: 'Kingston, Jamaica', services: [{"name": "Event Catering Consultation", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 45, "price": 0}, {"name": "Corporate Lunch Enquiry", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 30, "price": 0}, {"name": "Wedding Menu Consultation", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 60, "price": 0}, {"name": "Small Gathering Enquiry", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 30, "price": 0}] },
  site: {
    style: { mode: 'light', colors: { background: '#fff8ed', surface: '#f2e7d5', text: '#3d2c23', muted: '#7f6b5b', primary: '#8c432c', primaryText: '#ffffff', accent: '#b48635', heroText: '#ffffff' }, headingFont: 'Lora', bodyFont: 'Manrope', headingCase: 'none', radius: 10, buttonShape: 'square', buttonStyle: 'solid' },
    brand: { tagline: "Good food. Thoughtful planning. Shared moments." },
    nav: { style: 'solid', bookLabel: "Plan my menu" },
    footer: { text: "Good food. Thoughtful planning. Shared moments." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: hero('1555244162-803834f70033'), overlay: 0.6, height: 'tall', align: 'center', eyebrow: 'Catering · Jamaica', headline: "Bring everyone\nto the table.", subheadline: "Good food. Thoughtful planning. Shared moments.", ctaLabel: "Plan my menu", ctaTarget: 'book', secondaryLabel: 'Get to know us', secondaryTarget: 'about' }),
        section('home-services', 'services', { title: 'Find the right starting point', subtitle: "Book a planning appointment. Menus, guest numbers, dietary requirements and event availability are confirmed with the business.", limit: 6, showPrices: true, showDuration: true }),
        section('home-intro', 'intro', { title: "Food that brings your occasion together.", body: "Plan a menu around your occasion, guest count and budget. From family gatherings to workplace lunches, tell us what matters and we will discuss a menu and service plan.", imageUrl: portrait('1504674900247-0877df9cc836'), imageSide: 'right', ctaLabel: 'About us', ctaTarget: 'about' }),
        section('home-highlights', 'highlights', { title: 'Make a plan that works for you', items: [{"icon": "\ud83c\udf72", "title": "Start with the occasion", "text": "Share your event date, guest count and menu ideas."}, {"icon": "\ud83e\udd57", "title": "Include every guest", "text": "Discuss dietary needs and service preferences."}, {"icon": "\ud83d\udcdd", "title": "Agree the menu", "text": "Confirm quantities, arrangements and the final quote."}] }),
        section('home-cta', 'cta', { title: 'Let’s plan your next step.', text: "Book a planning appointment. Menus, guest numbers, dietary requirements and event availability are confirmed with the business.", buttonLabel: "Plan my menu", target: 'book' }),
        section('home-contact', 'contact', { title: 'Talk to the team', hours: [{day:'Monday – Saturday',time:'By appointment'}] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "Food that brings your occasion together.", subtitle: "Good food. Thoughtful planning. Shared moments.", imageUrl: banner('1555244162-803834f70033'), overlay: 0.6 }),
        section('about-story', 'intro', { title: 'A clear plan, from the start.', body: "Plan a menu around your occasion, guest count and budget. From family gatherings to workplace lunches, tell us what matters and we will discuss a menu and service plan.", imageUrl: portrait('1504674900247-0877df9cc836'), imageSide: 'left' }),
        section('about-faq', 'faq', {title:'Before you book',items:[{q:'What happens after I book?',a:"Book a planning appointment. Menus, guest numbers, dietary requirements and event availability are confirmed with the business."},{q:'What information should I share?',a:"Discuss dietary needs and service preferences."}]})
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'A closer look', subtitle: 'Ideas and details for your next booking.', imageUrl: banner('1555244162-803834f70033'), overlay: 0.55 }),
        section('gallery-main', 'gallery', { title: 'Inspiration', layout: 'grid', aspect: '3/2', images:[{url:tile('1555244162-803834f70033'),caption:'Inspiration'},{url:tile('1504674900247-0877df9cc836'),caption:'The details'}] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: "Plan my menu", subtitle: "Book a planning appointment. Menus, guest numbers, dietary requirements and event availability are confirmed with the business.", imageUrl: banner('1555244162-803834f70033'), overlay: 0.65 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
