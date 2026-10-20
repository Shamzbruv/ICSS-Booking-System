// Fresh Ride Detailing — industry starter with editable pages and a matching booking form.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'detailing', label: 'Fresh Ride Detailing',
  fallback: 'linear-gradient(135deg, #16354a, #166d97)',
  demo: { name: 'Fresh Ride Detailing', tagline: "Make time for a cleaner ride.", location: 'Kingston, Jamaica', services: [{"name": "Exterior Wash", "description": "Service scope and price are confirmed before the appointment.", "duration_minutes": 45, "price": 2000}, {"name": "Interior Clean", "description": "Service scope and price are confirmed before the appointment.", "duration_minutes": 60, "price": 3500}, {"name": "Full Wash & Detail", "description": "Service scope and price are confirmed before the appointment.", "duration_minutes": 120, "price": 6000}, {"name": "Paint Care Consultation", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 30, "price": 0}] },
  site: {
    style: { mode: 'light', colors: { background: '#f5fafd', surface: '#e5f2f8', text: '#16354a', muted: '#577589', primary: '#166d97', primaryText: '#ffffff', accent: '#16a6a0', heroText: '#ffffff' }, headingFont: 'Barlow Condensed', bodyFont: 'Inter', headingCase: 'none', radius: 14, buttonShape: 'square', buttonStyle: 'solid' },
    brand: { tagline: "Make time for a cleaner ride." },
    nav: { style: 'solid', bookLabel: "Book my detail" },
    footer: { text: "Make time for a cleaner ride." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: hero('1607860108855-64acf2078ed9'), overlay: 0.6, height: 'tall', align: 'left', eyebrow: 'Car Wash & Detailing · Jamaica', headline: "Fresh look.\nBetter drive.", subheadline: "Make time for a cleaner ride.", ctaLabel: "Book my detail", ctaTarget: 'book', secondaryLabel: 'Get to know us', secondaryTarget: 'about' }),
        section('home-services', 'services', { title: 'Find the right starting point', subtitle: "Service scope and any additional work are agreed before work starts.", limit: 6, showPrices: true, showDuration: true }),
        section('home-intro', 'intro', { title: "Care in the details.", body: "Choose the level of care your vehicle needs and book a visit. Tell us your vehicle type and any areas that need extra attention so the team can prepare.", imageUrl: portrait('1552519507-da3b142c6e3d'), imageSide: 'right', ctaLabel: 'About us', ctaTarget: 'about' }),
        section('home-highlights', 'highlights', { title: 'Make a plan that works for you', items: [{"icon": "\ud83e\uddfd", "title": "Choose your clean", "text": "From a quick refresh to a fuller detail."}, {"icon": "\ud83d\ude98", "title": "Share your vehicle", "text": "Include the model and any special requirements."}, {"icon": "\u2728", "title": "Plan your visit", "text": "Pick an available time and confirm the service scope."}] }),
        section('home-cta', 'cta', { title: 'Let’s plan your next step.', text: "Service scope and any additional work are agreed before work starts.", buttonLabel: "Book my detail", target: 'book' }),
        section('home-contact', 'contact', { title: 'Talk to the team', hours: [{day:'Monday – Saturday',time:'By appointment'}] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "Care in the details.", subtitle: "Make time for a cleaner ride.", imageUrl: banner('1607860108855-64acf2078ed9'), overlay: 0.6 }),
        section('about-story', 'intro', { title: 'A clear plan, from the start.', body: "Choose the level of care your vehicle needs and book a visit. Tell us your vehicle type and any areas that need extra attention so the team can prepare.", imageUrl: portrait('1552519507-da3b142c6e3d'), imageSide: 'left' }),
        section('about-faq', 'faq', {title:'Before you book',items:[{q:'What happens after I book?',a:"Service scope and any additional work are agreed before work starts."},{q:'What information should I share?',a:"Include the model and any special requirements."}]})
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'A closer look', subtitle: 'Ideas and details for your next booking.', imageUrl: banner('1607860108855-64acf2078ed9'), overlay: 0.55 }),
        section('gallery-main', 'gallery', { title: 'Inspiration', layout: 'grid', aspect: '3/2', images:[{url:tile('1607860108855-64acf2078ed9'),caption:'Inspiration'},{url:tile('1552519507-da3b142c6e3d'),caption:'The details'}] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: "Book my detail", subtitle: "Service scope and any additional work are agreed before work starts.", imageUrl: banner('1607860108855-64acf2078ed9'), overlay: 0.65 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
