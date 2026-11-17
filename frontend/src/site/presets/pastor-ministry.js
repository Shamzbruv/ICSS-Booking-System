// Pastor & Ministry starter; the shared Website Builder edits these same sections.
import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find((item) => item.key === 'pastor-ministry');
const art = kit.art;
const detailPhoto = '/images/starter-kits/pastor-ministry-detail.webp';

export default {
  key: kit.key, label: kit.name, fallback: 'linear-gradient(135deg, #18242c, #374750)',
  demo: { name: kit.name, tagline: "Faith, fellowship and service", location: 'Jamaica', services: kit.services.map((service) => ({ ...service, active: true })) },
  site: {
    style: {
      mode: 'light', colors: { background: '#faf7ef', surface: '#ffffff', text: '#222d35', muted: '#514d52', primary: '#324c5b', primaryText: '#ffffff', accent: '#324c5b', heroText: '#ffffff' },
      headingFont: 'Playfair Display', bodyFont: 'Inter', headingCase: 'none', radius: 10, buttonShape: 'rounded', buttonStyle: 'solid'
    },
    brand: { tagline: "Faith, fellowship and service" },
    nav: { style: 'solid', bookLabel: "Connect" },
    footer: { text: "Faith, fellowship and service" },
    booking: { footerNote: "Use this form for an introductory call or ministry enquiry. Please keep private pastoral details out of the form. Invitations and event dates are confirmed directly by the ministry." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: art, mobileImageUrl: '/images/starter-kits/pastor-ministry-mobile.webp', overlay: 0.59, height: 'tall', align: 'left', eyebrow: "OPEN DOOR MINISTRY", headline: "There’s a place for you here.", subheadline: "Join us for worship or reach out to the ministry team about a visit, a conversation or an invitation to speak.", ctaLabel: "Connect with the ministry", ctaTarget: 'book', secondaryLabel: "Plan a visit", secondaryTarget: 'about' }),
        section('home-highlights', 'highlights', { title: "Find your next step", items: [{"title": "Visit for worship", "text": "Reach out for current service times, directions and accessibility information."}, {"title": "Find a message", "text": "Make room to reflect on scripture and share what you’re learning."}, {"title": "Invite the pastor", "text": "Ask about speaking at a church service, community gathering or other event."}] }),
        section('home-intro', 'intro', { title: "A community rooted in faith", body: "Our church gathers for worship, prayer and Bible teaching. If you’re visiting for the first time, we can help you plan your arrival, tell you what to expect during the service and answer questions about bringing children or arranging accessible seating.", imageUrl: detailPhoto, imageSide: 'left', ctaLabel: "Sermons & messages", ctaTarget: 'gallery' }),
        section('home-services', 'services', { title: "Connect", subtitle: "Use this form for an introductory call or ministry enquiry. Please keep private pastoral details out of the form. Invitations and event dates are confirmed directly by the ministry.", showPrices: false, ctaLabel: 'See available times' }),
        section('home-contact', 'contact', { title: 'Get in touch' })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "Plan a visit", subtitle: "What to know before your first Sunday with us.", imageUrl: detailPhoto, overlay: 0.67 }),
        section('about-options', 'highlights', { title: "Find your next step", items: [{"title": "Visit for worship", "text": "Reach out for current service times, directions and accessibility information."}, {"title": "Find a message", "text": "Make room to reflect on scripture and share what you’re learning."}, {"title": "Invite the pastor", "text": "Ask about speaking at a church service, community gathering or other event."}] }),
        section('about-faq', 'faq', { title: 'Good to know', items: [{"q": "Can I invite the pastor to speak?", "a": "Yes. Share the event date, venue, audience and topic so the ministry can discuss the invitation."}, {"q": "Can someone help me plan a first visit?", "a": "Yes. Reach out with any questions about service times, directions or accessibility."}] }),
        section('about-cta', 'cta', { title: "Your first visit starts here", text: "Come as you are. If you have questions about the service, our team can help you plan ahead.", buttonLabel: "Connect", target: 'book' })
      ], { label: "Plan a visit" }),
      page('gallery', [
        section('feature-header', 'pageHeader', { title: "Sermons & messages", subtitle: "Continue reflecting on the Sunday message during the week.", imageUrl: detailPhoto, overlay: 0.67 }),
        section('feature-details', 'highlights', { title: "Sermons & messages", items: [{"title": "Watch or listen", "text": "Ask the ministry where the latest sermon is available."}, {"title": "Read and reflect", "text": "Reread a recent scripture passage. What stood out, and what could you practise this week?"}, {"title": "Join the conversation", "text": "Ask about the next teaching series or ways to learn alongside the church community."}] }),
      section('feature-media', 'video', { title: "Sermon recording", videoUrl: '', posterUrl: detailPhoto }),
        section('feature-cta', 'cta', { title: 'Talk with us about the next step', buttonLabel: "Connect", target: 'book' })
      ], { label: "Sermons & messages" }),
      page('book', [
        section('book-header', 'pageHeader', { title: "Connect with the ministry", subtitle: "Use this form for an introductory call or ministry enquiry. Please keep private pastoral details out of the form. Invitations and event dates are confirmed directly by the ministry.", imageUrl: art, overlay: 0.72 }),
        section('booking-main', 'booking', { title: '' })
      ], { label: "Connect" })
    ]
  }
};
