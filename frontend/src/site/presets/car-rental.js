// Island Drive Rentals — industry starter with editable pages and a matching booking form.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'car-rental', label: 'Island Drive Rentals',
  fallback: 'linear-gradient(135deg, #f5f7fa, #d3a34c)',
  demo: { name: 'Island Drive Rentals', tagline: "Start your next drive with a clear plan.", location: 'Kingston, Jamaica', services: [{"name": "Compact Car Enquiry", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 30, "price": 0}, {"name": "SUV Rental Enquiry", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 30, "price": 0}, {"name": "Van & Group Hire Enquiry", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 45, "price": 0}, {"name": "Long-term Rental Consultation", "description": "Discuss your requirements and confirm a tailored quote.", "duration_minutes": 45, "price": 0}] },
  site: {
    style: { mode: 'dark', colors: { background: '#121b27', surface: '#1e2b3c', text: '#f5f7fa', muted: '#a8b6c7', primary: '#d3a34c', primaryText: '#172333', accent: '#80b8d2', heroText: '#ffffff' }, headingFont: 'Montserrat', bodyFont: 'Inter', headingCase: 'none', radius: 8, buttonShape: 'square', buttonStyle: 'solid' },
    brand: { tagline: "Start your next drive with a clear plan." },
    nav: { style: 'transparent', bookLabel: "Discuss my rental" },
    footer: { text: "Start your next drive with a clear plan." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: hero('1503376780353-7e6692767b70'), overlay: 0.6, height: 'full', align: 'left', eyebrow: 'Car Rentals · Jamaica', headline: "Your journey.\nYour pace.", subheadline: "Start your next drive with a clear plan.", ctaLabel: "Discuss my rental", ctaTarget: 'book', secondaryLabel: 'Get to know us', secondaryTarget: 'about' }),
        section('home-services', 'services', { title: 'Find the right starting point', subtitle: "This booking reserves a consultation time. It does not reserve a vehicle across your requested rental dates. The company confirms vehicle availability and the rental agreement separately.", limit: 6, showPrices: true, showDuration: true }),
        section('home-intro', 'intro', { title: "A smoother start to your drive.", body: "Share the type of vehicle you need, your requested pickup and return dates, and where your journey starts. The team confirms vehicle availability, documents and the rental agreement before handover.", imageUrl: portrait('1492144534655-ae79c964c9d7'), imageSide: 'right', ctaLabel: 'About us', ctaTarget: 'about' }),
        section('home-highlights', 'highlights', { title: 'Make a plan that works for you', items: [{"icon": "\ud83d\ude97", "title": "Match your trip", "text": "Discuss vehicle size and the type of journey."}, {"icon": "\ud83d\udcc5", "title": "Plan the dates", "text": "Share pickup, return and collection preferences."}, {"icon": "\ud83d\udd11", "title": "Confirm the details", "text": "Agree availability, documents, insurance and hire terms."}] }),
        section('home-cta', 'cta', { title: 'Let’s plan your next step.', text: "This booking reserves a consultation time. It does not reserve a vehicle across your requested rental dates. The company confirms vehicle availability and the rental agreement separately.", buttonLabel: "Discuss my rental", target: 'book' }),
        section('home-contact', 'contact', { title: 'Talk to the team', hours: [{day:'Monday – Saturday',time:'By appointment'}] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "A smoother start to your drive.", subtitle: "Start your next drive with a clear plan.", imageUrl: banner('1503376780353-7e6692767b70'), overlay: 0.6 }),
        section('about-story', 'intro', { title: 'A clear plan, from the start.', body: "Share the type of vehicle you need, your requested pickup and return dates, and where your journey starts. The team confirms vehicle availability, documents and the rental agreement before handover.", imageUrl: portrait('1492144534655-ae79c964c9d7'), imageSide: 'left' }),
        section('about-faq', 'faq', {title:'Before you book',items:[{q:'What happens after I book?',a:"This booking reserves a consultation time. It does not reserve a vehicle across your requested rental dates. The company confirms vehicle availability and the rental agreement separately."},{q:'What information should I share?',a:"Share pickup, return and collection preferences."}]})
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'A closer look', subtitle: 'Ideas and details for your next booking.', imageUrl: banner('1503376780353-7e6692767b70'), overlay: 0.55 }),
        section('gallery-main', 'gallery', { title: 'Inspiration', layout: 'grid', aspect: '3/2', images:[{url:tile('1503376780353-7e6692767b70'),caption:'Inspiration'},{url:tile('1492144534655-ae79c964c9d7'),caption:'The details'}] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: "Discuss my rental", subtitle: "This booking reserves a consultation time. It does not reserve a vehicle across your requested rental dates. The company confirms vehicle availability and the rental agreement separately.", imageUrl: banner('1503376780353-7e6692767b70'), overlay: 0.65 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
