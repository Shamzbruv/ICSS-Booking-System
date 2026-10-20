import SharedBookingTheme from './SharedBookingTheme';

const field = (name, label, type = 'text', required = false) => ({ name, label, noteLabel: label, type, required });
const rentalFields = [field('hireFrom', 'Requested rental start', 'date', true), field('hireUntil', 'Requested rental end', 'date', true)];
const configurations = {
  partyRentals: { name: 'party-rentals', color: '#773b83', title: 'Plan your hire', fields: [...rentalFields, field('items', 'Items, quantities & delivery address', 'textarea', true)], note: 'This reserves a consultation time. The company confirms equipment stock, hire dates, delivery and the final quote.' },
  carRental: { name: 'car-rental', color: '#a77525', title: 'Discuss your rental', fields: [...rentalFields, field('vehicle', 'Vehicle preference & pickup location', 'textarea', true)], note: 'This reserves a consultation time. Vehicle availability across your rental dates, documents, insurance and the rental agreement are confirmed separately.' },
  catering: { name: 'catering', color: '#8c432c', title: 'Plan your catering', fields: [field('eventDate', 'Requested event date', 'date', true), field('guests', 'Guest count', 'number', true), field('eventDetails', 'Venue, menu ideas & dietary needs', 'textarea', true)], note: 'Book a planning appointment. The business confirms the menu, event availability and final quote.' },
  detailing: { name: 'detailing', color: '#166d97', title: 'Choose your vehicle care', fields: [field('vehicle', 'Vehicle make & model', 'text', true), field('details', 'Areas needing attention / mobile service address', 'textarea')], note: 'Confirm the vehicle and service scope before the appointment.' },
  homeRepairs: { name: 'home-repairs', color: '#a95b20', title: 'Arrange a service visit', fields: [field('address', 'Service address', 'text', true), field('job', 'Describe the issue & access details', 'textarea', true)], note: 'An assessment may be needed before a final quote. Specialist work is confirmed with the business.' },
  tutoring: { name: 'tutoring', color: '#394f9c', title: 'Choose a lesson', fields: [field('level', 'Subject, grade or exam level', 'text', true), field('goals', 'Lesson goals & online / in-person preference', 'textarea', true)], note: 'For a child, use a parent or guardian’s contact details. Confirm the lesson format with the tutor.' }
};

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
