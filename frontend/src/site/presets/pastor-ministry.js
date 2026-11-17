// Pastor & Ministry starter; the shared Website Builder edits these same sections.
import { page, section } from './helpers.js';
import kits from './career-starter-kits.json' with { type: 'json' };

const kit = kits.find((item) => item.key === 'pastor-ministry');
const art = kit.art;

export default {
  key: kit.key, label: kit.name, fallback: 'linear-gradient(135deg, #362838, #62445d)',
  demo: { name: kit.name, tagline: "Faith, fellowship and service", location: 'Jamaica', services: kit.services.map((service) => ({ ...service, active: true })) },
  site: {
    style: {
      mode: 'light', colors: { background: '#fbf3e8', surface: '#ffffff', text: '#362838', muted: '#514d52', primary: '#62445d', primaryText: '#ffffff', accent: '#62445d', heroText: '#ffffff' },
      headingFont: 'Cormorant Garamond', bodyFont: 'Inter', headingCase: 'none', radius: 20, buttonShape: 'pill', buttonStyle: 'solid'
    },
    brand: { tagline: "Faith, fellowship and service" },
    nav: { style: 'transparent', bookLabel: "Connect" },
    announcement: { enabled: true, text: "New here? Plan your first visit.", linkLabel: "Plan a visit", target: 'about' },
    footer: { text: "Faith, fellowship and service" },
    booking: { footerNote: "Use this form for an introductory call or ministry enquiry. Please keep private pastoral details out of the form. Invitations and event dates are confirmed directly by the ministry." },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: art, overlay: 0.66, height: 'full', align: 'center', eyebrow: "FAITH · FELLOWSHIP · SERVICE", headline: "There’s a place for you here.", subheadline: "Join us for worship, find a message for the week, or speak with the ministry team.", ctaLabel: "Connect with the ministry", ctaTarget: 'book', secondaryLabel: "Plan a visit", secondaryTarget: 'about' }),
        section('home-highlights', 'highlights', { title: "Find your next step", items: [{"icon": "01", "title": "Visit for worship", "text": "Reach out for current service times, directions and accessibility information."}, {"icon": "02", "title": "Find a message", "text": "Make room to reflect on scripture and share what you’re learning."}, {"icon": "03", "title": "Invite the pastor", "text": "Ask about speaking at a church service, community gathering or other event."}] }),
        section('home-intro', 'intro', { title: "A community rooted in faith", body: "We gather for worship, learn together and look for practical ways to care for our neighbours. Whether this is your first visit or you’re looking for a place to serve, you’re welcome to reach out.", imageUrl: art, imageSide: 'left', ctaLabel: "Sermons & messages", ctaTarget: 'gallery' }),
        section('home-services', 'services', { title: "Connect", subtitle: "Use this form for an introductory call or ministry enquiry. Please keep private pastoral details out of the form. Invitations and event dates are confirmed directly by the ministry.", showPrices: false, ctaLabel: 'See available times' }),
        section('home-contact', 'contact', { title: 'Get in touch' })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: "Plan a visit", subtitle: "Faith, fellowship and service", imageUrl: art, overlay: 0.67 }),
        section('about-options', 'highlights', { title: "Find your next step", items: [{"icon": "01", "title": "Visit for worship", "text": "Reach out for current service times, directions and accessibility information."}, {"icon": "02", "title": "Find a message", "text": "Make room to reflect on scripture and share what you’re learning."}, {"icon": "03", "title": "Invite the pastor", "text": "Ask about speaking at a church service, community gathering or other event."}] }),
        section('about-faq', 'faq', { title: 'Good to know', items: [{"q": "Can I invite the pastor to speak?", "a": "Yes. Share the event date, venue, audience and topic so the ministry can discuss the invitation."}, {"q": "Can someone help me plan a first visit?", "a": "Yes. Reach out with any questions about service times, directions or accessibility."}] }),
        section('about-cta', 'cta', { title: "Your first visit starts here", text: "Come as you are. If you have questions about the service, our team can help you plan ahead.", buttonLabel: "Connect", target: 'book' })
      ], { label: "Plan a visit" }),
      page('gallery', [
        section('feature-header', 'pageHeader', { title: "Sermons & messages", subtitle: "Faith, fellowship and service", imageUrl: art, overlay: 0.67 }),
        section('feature-details', 'highlights', { title: "Sermons & messages", items: [{"icon": "01", "title": "Watch or listen", "text": "Ask the ministry where the latest sermon is available."}, {"icon": "02", "title": "Read and reflect", "text": "Reread a recent scripture passage. What stood out, and what could you practise this week?"}, {"icon": "03", "title": "Join the conversation", "text": "Ask about the next teaching series or ways to learn alongside the church community."}] }),
      section('feature-media', 'video', { title: "Sermon recording", videoUrl: '', posterUrl: art }),
        section('feature-cta', 'cta', { title: 'Talk with us about the next step', buttonLabel: "Connect", target: 'book' })
      ], { label: "Sermons & messages" }),
      page('book', [
        section('book-header', 'pageHeader', { title: "Connect with the ministry", subtitle: "Use this form for an introductory call or ministry enquiry. Please keep private pastoral details out of the form. Invitations and event dates are confirmed directly by the ministry.", imageUrl: art, overlay: 0.72 }),
        section('booking-main', 'booking', { title: '' })
      ], { label: "Connect" })
    ]
  }
};
