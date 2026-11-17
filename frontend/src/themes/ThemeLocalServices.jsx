import SharedBookingTheme from './SharedBookingTheme';
import kits from '../site/presets/career-starter-kits.json';

const field = (name, label, type = 'text', required = false) => ({ name, label, noteLabel: label, type, required });
const rentalFields = [field('hireFrom', 'Requested rental start', 'date', true), field('hireUntil', 'Requested rental end', 'date', true)];
const configurations = {
  drivingLessons: { name: 'driving-lessons', color: '#9d3a1b', title: 'Choose a lesson or introductory call', fields: [
    { ...field('transmission', 'Transmission preference', 'select', true), options: ['', 'Automatic', 'Manual', 'No preference'].map(value => ({ value, label: value || 'Select your preference' })) },
    field('area', 'Parish & pickup community', 'text', true),
    field('experience', 'Driving experience and what you want to practise', 'textarea', true),
    field('testDate', 'Road test date (if scheduled)', 'date')
  ], note: 'Your instructor confirms the pickup point and vehicle. Do not enter your permit number.' },
  pastorMinistry: { name: 'pastor-ministry', color: '#324c5b', title: 'Choose an appointment type', fields: [
    { ...field('meetingPreference', 'Meeting preference', 'select'),
      options: ['', 'In person', 'By phone', 'Discuss when contacted'].map(value => ({ value, label: value || 'Select a preference' })) }
  ], note: 'Use contact details you’re comfortable receiving booking messages on. Save personal details for your conversation.' },
  cateringEvents: { name: 'catering-events', color: '#884025', title: 'Choose a menu consultation', fields: [
    field('eventDate', 'Event date (if known)', 'date'), field('guests', 'Expected guest count', 'number', true),
    field('eventDetails', 'Venue, menu ideas & dietary requirements', 'textarea', true)
  ], note: 'Book a planning appointment. The caterer confirms availability, menus and quotes separately.' },
  photographyVideo: { name: 'photography-video', color: '#643f86', title: 'Plan your shoot', fields: [
    field('shootDate', 'Proposed shoot date (if known)', 'date'), field('location', 'Venue or parish', 'text'),
    field('shootDetails', 'Type of shoot and where you’ll use the finished work', 'textarea', true)
  ], note: 'Choose a discovery call. The studio confirms shoot dates, pricing and image usage separately.' },
  tutoringCoaching: { name: 'tutoring-coaching', color: '#235f87', title: 'Choose a tutoring session', fields: [
    field('level', 'Subject, grade or exam', 'text', true), field('goals', 'Learning goals & preferred lesson format', 'textarea', true)
  ], note: 'Use a parent or guardian’s contact details when booking for a child. Please leave out school records and other private details.' },
  homeServices: { name: 'home-services', color: '#21645e', title: 'Tell us about the job', fields: [
    field('area', 'Parish & community', 'text', true), field('scope', 'Work needed and your preferred time frame', 'textarea', true)
  ], note: 'This schedules a first discussion. Please leave out access codes and ask whether an inspection is needed.' },
  musicians: { name: 'musicians', color: '#956021', title: 'Performance & studio enquiries', fields: [
    field('eventDate', 'Requested event or session date', 'date', true),
    { ...field('eventType', 'Occasion / project', 'select', true), options: ['', 'Live show', 'Wedding / private event', 'Church / worship', 'Corporate event', 'Studio recording', 'Other'].map(value => ({ value, label: value || 'Choose an occasion' })) },
    field('venue', 'Venue / location', 'text', true),
    field('performance', 'Music style, set length & sound requirements', 'textarea', true)
  ], note: 'This reserves a consultation time. The artist confirms event availability, performance fees, equipment and the final agreement separately.' },
  partyRentals: { name: 'party-rentals', color: '#773b83', title: 'Plan your hire', fields: [...rentalFields, field('items', 'Items, quantities & delivery address', 'textarea', true)], note: 'This reserves a consultation time. The company confirms equipment stock, hire dates, delivery and the final quote.' },
  carRental: { name: 'car-rental', color: '#a77525', title: 'Discuss your rental', fields: [...rentalFields, field('vehicle', 'Vehicle preference & pickup location', 'textarea', true)], note: 'This reserves a consultation time. Vehicle availability across your rental dates, documents, insurance and the rental agreement are confirmed separately.' },
  catering: { name: 'catering', color: '#8c432c', title: 'Plan your catering', fields: [field('eventDate', 'Requested event date', 'date', true), field('guests', 'Guest count', 'number', true), field('eventDetails', 'Venue, menu ideas & dietary needs', 'textarea', true)], note: 'Book a planning appointment. The business confirms the menu, event availability and final quote.' },
  detailing: { name: 'detailing', color: '#166d97', title: 'Choose your vehicle care', fields: [field('vehicle', 'Vehicle make & model', 'text', true), field('details', 'Areas needing attention / mobile service address', 'textarea')], note: 'Confirm the vehicle and service scope before the appointment.' },
  homeRepairs: { name: 'home-repairs', color: '#a95b20', title: 'Arrange a service visit', fields: [field('address', 'Service address', 'text', true), field('job', 'Describe the issue & access details', 'textarea', true)], note: 'An assessment may be needed before a final quote. Specialist work is confirmed with the business.' },
  tutoring: { name: 'tutoring', color: '#394f9c', title: 'Choose a lesson', fields: [field('level', 'Subject, grade or exam level', 'text', true), field('goals', 'Lesson goals & online / in-person preference', 'textarea', true)], note: 'For a child, use a parent or guardian’s contact details. Confirm the lesson format with the tutor.' }
};

for (const { key, trade } of kits.filter(kit => kit.trade)) {
  configurations[key] = {
    name: key, color: trade.accent, title: 'Choose the service you need',
    fields: [field('community', 'Parish and community', 'text', true), ...trade.fields.map(args => field(...args))],
    note: 'Confirm the job address and quote directly with the business. Keep gate codes and other access details out of this form.'
  };
}

function LocalServiceBooking({ tenant, services, industry }) {
  const config = configurations[industry];
  return <SharedBookingTheme tenant={tenant} services={services} theme={{
    name: config.name, serviceSectionTitle: config.title, detailsSectionTitle: 'Your booking details',
    extraFields: config.fields, footerNote: config.note,
    validateFields: (values) => {
      if (values.hireFrom && values.hireUntil && values.hireUntil < values.hireFrom) return 'The rental end date must be on or after the start date.';
      if (values.guests && (!Number.isInteger(Number(values.guests)) || Number(values.guests) < 1)) return 'Enter a guest count of at least one.';
      return null;
    },
    palette: { pageBg: '#f7f8fc', shellBg: '#ffffff', panelBg: '#ffffff', textMain: '#263345', textSubtle: '#536477', textMuted: '#6d7a8d', accent: config.color, accentStrong: config.color, strongBg: config.color, buttonText: '#ffffff', cardBorder: '#dce3eb', inputBorder: '#cbd5e1' }
  }} />;
}

export function ThemePartyRentals(props) { return <LocalServiceBooking {...props} industry="partyRentals" />; }
export function ThemeCarRental(props) { return <LocalServiceBooking {...props} industry="carRental" />; }
export function ThemeCatering(props) { return <LocalServiceBooking {...props} industry="catering" />; }
export function ThemeDetailing(props) { return <LocalServiceBooking {...props} industry="detailing" />; }
export function ThemeHomeRepairs(props) { return <LocalServiceBooking {...props} industry="homeRepairs" />; }
export function ThemeTutoring(props) { return <LocalServiceBooking {...props} industry="tutoring" />; }

export function ThemeMusicians(props) { return <LocalServiceBooking {...props} industry="musicians" />; }

export function ThemeDrivingLessons(props) { return <LocalServiceBooking {...props} industry="drivingLessons" />; }
export function ThemePastorMinistry(props) { return <LocalServiceBooking {...props} industry="pastorMinistry" />; }
export function ThemeCateringEvents(props) { return <LocalServiceBooking {...props} industry="cateringEvents" />; }
export function ThemePhotographyVideo(props) { return <LocalServiceBooking {...props} industry="photographyVideo" />; }
export function ThemeTutoringCoaching(props) { return <LocalServiceBooking {...props} industry="tutoringCoaching" />; }
export function ThemeHomeServices(props) { return <LocalServiceBooking {...props} industry="homeServices" />; }

export const TRADE_BOOKING_THEMES = Object.fromEntries(kits.filter(kit => kit.trade).map(({ key }) => [
  key,
  function TradeBooking(props) { return <LocalServiceBooking {...props} industry={key} />; }
]));
