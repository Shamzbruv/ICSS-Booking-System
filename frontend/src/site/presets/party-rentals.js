// Island Occasion Rentals — industry starter with editable pages and a matching booking form.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'party-rentals', label: 'Island Occasion Rentals',
  fallback: 'linear-gradient(135deg, #352335, #773b83)',
  demo: { name: 'Island Occasion Rentals', tagline: "Party essentials, planned around your occasion.", location: 'Kingston, Jamaica', services: [{"name": "Chairs & Tables Enquiry", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 30, "price": 0}, {"name": "Tent & Canopy Consultation", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 45, "price": 0}, {"name": "Party Package Consultation", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 45, "price": 0}, {"name": "General Equipment Hire Enquiry", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 30, "price": 0}] },
  site: {
    style: { mode: 'light', colors: { background: '#fff8f0', surface: '#f7eee4', text: '#352335', muted: '#7e6475', primary: '#773b83', primaryText: '#ffffff', accent: '#dc9b45', heroText: '#ffffff' }, headingFont: 'Playfair Display', bodyFont: 'Inter', headingCase: 'none', radius: 12, buttonShape: 'square', buttonStyle: 'solid' },
    brand: { tagline: "Party essentials, planned around your occasion." },
    nav: { style: 'solid', bookLabel: "Plan my rental" },
    footer: { text: "Party essentials, planned around your occasion." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: hero('1519167758481-83f550bb49b3'), overlay: 0.6, height: 'tall', align: 'left', eyebrow: 'Party & Equipment Rentals · Jamaica', headline: "Good times.\nAll the right pieces.", subheadline: "Party essentials, planned around your occasion.", ctaLabel: "Plan my rental", ctaTarget: 'book', secondaryLabel: 'Get to know us', secondaryTarget: 'about' }),
        section('home-services', 'services', { title: 'Find the right starting point', subtitle: "Your appointment is a rental consultation. Equipment availability, hire periods, delivery fees and deposits are confirmed separately.", limit: 6, showPrices: true, showDuration: true }),
        section('home-intro', 'intro', { title: "A clear plan for every occasion.", body: "From a backyard birthday to a special celebration, start with the items, quantities and delivery details you need. We confirm stock, hire dates and the final quote with you.", imageUrl: portrait('1464366400600-7168b8af9bc3'), imageSide: 'right', ctaLabel: 'About us', ctaTarget: 'about' }),
        section('home-highlights', 'highlights', { title: 'Make a plan that works for you', items: [{"icon": "\ud83e\ude91", "title": "Choose your essentials", "text": "Tables, seating, tents or other rental equipment."}, {"icon": "\ud83d\udce6", "title": "Share the details", "text": "Tell us the dates, quantities and delivery location."}, {"icon": "\ud83d\udcac", "title": "Confirm your hire", "text": "The business confirms stock, terms and your final quote."}] }),
        section('home-cta', 'cta', { title: 'Let’s plan your next step.', text: "Your appointment is a rental consultation. Equipment availability, hire periods, delivery fees and deposits are confirmed separately.", buttonLabel: "Plan my rental", target: 'book' }),
        section('home-contact', 'contact', { title: 'Talk to the team', hours: [{day:'Monday – Saturday',time:'By appointment'}] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "A clear plan for every occasion.", subtitle: "Party essentials, planned around your occasion.", imageUrl: banner('1519167758481-83f550bb49b3'), overlay: 0.6 }),
        section('about-story', 'intro', { title: 'A clear plan, from the start.', body: "From a backyard birthday to a special celebration, start with the items, quantities and delivery details you need. We confirm stock, hire dates and the final quote with you.", imageUrl: portrait('1464366400600-7168b8af9bc3'), imageSide: 'left' }),
        section('about-faq', 'faq', {title:'Before you book',items:[{q:'What happens after I book?',a:"Your appointment is a rental consultation. Equipment availability, hire periods, delivery fees and deposits are confirmed separately."},{q:'What information should I share?',a:"Tell us the dates, quantities and delivery location."}]})
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'A closer look', subtitle: 'Ideas and details for your next booking.', imageUrl: banner('1519167758481-83f550bb49b3'), overlay: 0.55 }),
        section('gallery-main', 'gallery', { title: 'Inspiration', layout: 'grid', aspect: '3/2', images:[{url:tile('1519167758481-83f550bb49b3'),caption:'Inspiration'},{url:tile('1464366400600-7168b8af9bc3'),caption:'The details'}] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: "Plan my rental", subtitle: "Your appointment is a rental consultation. Equipment availability, hire periods, delivery fees and deposits are confirmed separately.", imageUrl: banner('1519167758481-83f550bb49b3'), overlay: 0.65 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
