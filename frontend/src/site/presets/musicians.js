// Island Sound — a stage-inspired musician portfolio with warm gold on midnight.
import { hero, portrait, banner, tile, page, section } from './helpers';

export default {
  key: 'musicians',
  label: 'Island Sound Music',
  fallback: 'linear-gradient(135deg, #101018, #382638 70%, #9d702f)',
  demo: {
    name: 'Island Sound Music', tagline: 'Your moment. Our sound.', location: 'Kingston, Jamaica',
    services: [
      { name: 'Live Performance Enquiry', description: 'Discuss your event, preferred music and performance requirements.', duration_minutes: 30, price: 0 },
      { name: 'Wedding & Private Event Enquiry', description: 'Plan the musical moments for your special occasion.', duration_minutes: 45, price: 0 },
      { name: 'Church & Worship Event Enquiry', description: 'Discuss the programme, repertoire and technical arrangements.', duration_minutes: 30, price: 0 },
      { name: 'Studio Session Enquiry', description: 'Talk through your recording project, timing and collaboration needs.', duration_minutes: 30, price: 0 }
    ]
  },
  site: {
    style: {
      mode: 'dark',
      colors: { background: '#101018', surface: '#1d1926', text: '#fff7ec', muted: '#c0b4c8', primary: '#e4b45b', primaryText: '#211927', accent: '#b791d5', heroText: '#ffffff' },
      headingFont: 'Oswald', bodyFont: 'Manrope', headingCase: 'uppercase', radius: 8, buttonShape: 'square', buttonStyle: 'solid'
    },
    brand: { tagline: 'Your moment. Our sound.' },
    nav: { style: 'transparent', bookLabel: 'Booking enquiries' },
    footer: { text: 'Live performances · Special events · Studio collaborations.' },
    music: { enabled: false, url: '', title: 'Featured track', volume: 0.3, autoplay: false },
    pages: [
      page('home', [
        section('hero', 'hero', { mediaType: 'image', imageUrl: hero('1510915361894-db8b60106cb1'), overlay: 0.6, height: 'full', align: 'left', eyebrow: 'Live music · Studio sessions · Special events', headline: 'Set the mood.\nMake the moment.', subheadline: 'Music that brings people together, from an intimate gathering to a stage full of energy.', ctaLabel: 'Discuss your event', ctaTarget: 'book', secondaryLabel: 'Meet the music', secondaryTarget: 'about' }),
        section('home-intro', 'intro', { eyebrow: 'The sound behind the moment', title: 'Every performance tells a story.', body: 'A song can lift a room, mark a milestone or bring a community together. Share your occasion, musical direction and the moments you want people to remember.', imageUrl: portrait('1516280440614-37939bbacd81'), imageSide: 'right', ctaLabel: 'Our story', ctaTarget: 'about' }),
        section('home-services', 'services', { title: 'Bring music to your next chapter', subtitle: 'Book a conversation about a performance, special event or recording project.', limit: 6, showPrices: false, showDuration: true }),
        section('home-highlights', 'highlights', { title: 'A sound for your setting', items: [
          { icon: '🎤', title: 'Live performances', text: 'Discuss the setting, audience, repertoire and set length.' },
          { icon: '🎹', title: 'Meaningful occasions', text: 'Plan musical moments for weddings, worship and private events.' },
          { icon: '🎧', title: 'Studio collaborations', text: 'Talk through your creative direction and recording requirements.' }
        ] }),
        section('featured-performance', 'video', { title: 'Watch a performance', subtitle: 'Live sessions, music videos and moments from the stage.', videoUrl: '', posterUrl: banner('1516280440614-37939bbacd81') }, false),
        section('home-cta', 'cta', { title: 'Let’s talk about your next moment.', text: 'Share the date, venue, music style and performance requirements. Availability, fees and the performance agreement are confirmed personally.', buttonLabel: 'Make a booking enquiry', target: 'book' }),
        section('home-contact', 'contact', { title: 'Bookings & collaborations', hours: [{ day: 'Enquiries', time: 'By appointment' }] })
      ]),
      page('about', [
        section('about-header', 'pageHeader', { title: 'Behind the sound', subtitle: 'Music, connection and the moments in between.', imageUrl: banner('1516280440614-37939bbacd81'), overlay: 0.6 }),
        section('about-story', 'intro', { title: 'Music with room for your story.', body: 'Every audience and occasion is different. We start with a conversation about the music you love, the atmosphere you want and the practical details that help a performance come together.', imageUrl: portrait('1510915361894-db8b60106cb1'), imageSide: 'left' }),
        section('about-faq', 'faq', { title: 'Before your enquiry', items: [
          { q: 'Does this booking reserve my event date?', a: 'It reserves a consultation time. Performance availability, fees, deposits and the final agreement are confirmed separately.' },
          { q: 'What information should I include?', a: 'Share the event date, venue, audience, requested music style, set length and any sound-equipment requirements.' },
          { q: 'Can I discuss a recording project?', a: 'Yes. Choose the studio session enquiry and tell us about your project and the collaboration you have in mind.' }
        ] })
      ]),
      page('gallery', [
        section('gallery-header', 'pageHeader', { title: 'In the moment', subtitle: 'Performance, instruments and creative spaces.', imageUrl: banner('1516280440614-37939bbacd81'), overlay: 0.55 }),
        section('gallery-main', 'gallery', { title: 'Music in focus', layout: 'masonry', aspect: '4/5', images: [{ url: tile('1510915361894-db8b60106cb1'), caption: 'Instrumental inspiration' }, { url: tile('1516280440614-37939bbacd81'), caption: 'From the stage' }] })
      ]),
      page('book', [
        section('book-header', 'pageHeader', { title: 'Start with a conversation.', subtitle: 'Choose an enquiry type and a consultation time. The artist confirms performance dates, arrangements and fees separately.', imageUrl: banner('1516280440614-37939bbacd81'), overlay: 0.65 }),
        section('booking-main', 'booking', { title: '' })
      ])
    ]
  }
};
