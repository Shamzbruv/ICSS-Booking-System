import SharedBookingTheme from './SharedBookingTheme';

const staffMembers = [
  { label: 'Anyone available' },
  { label: 'Staff Member 1' },
  { label: 'Staff Member 2' },
  { label: 'Staff Member 3' }
];

export default function ThemeUniversal({ tenant, services }) {
  return (
    <SharedBookingTheme
      tenant={tenant}
      services={services}
      theme={{
        name: 'universal',
        icon: 'fa-calendar-check',
        serviceIcon: 'fa-list-ul',
        itemIcon: 'fa-star',
        serviceSectionTitle: 'Choose a Service',
        detailsSectionTitle: 'Your Details',
        preferenceField: { label: 'Preferred staff', options: staffMembers, noteLabel: 'Staff' },
        extraFields: [
          { name: 'notes', label: 'Booking notes', type: 'textarea', placeholder: 'Anything we should know before your appointment?', noteLabel: 'Notes' }
        ],
        buildNotes: ({ selectedOption, extraState }) =>
          `Staff: ${selectedOption?.label || 'Anyone available'}\nNotes: ${extraState.notes || 'None'}`,
        footerNote: 'Secure booking. Confirmation and payment details will be sent by email.',
        priceFormatter: (service) => Number(service?.price || 0) === 0 ? 'Free' : `$${Number(service.price).toLocaleString()}`,
        palette: {
          pageBg: '#f5f7fb',
          pageAccentA: 'rgba(108, 99, 255, 0.16)',
          pageAccentB: 'rgba(186, 198, 255, 0.18)',
          shellBg: 'rgba(255, 255, 255, 0.82)',
          panelBg: 'rgba(255, 255, 255, 0.95)',
          cardBorder: '#dfe5f6',
          inputBorder: '#dfe5f6',
          textMain: '#18223a',
          textSubtle: '#566687',
          textMuted: '#8a97b4',
          accent: '#6c63ff',
          accentStrong: '#574fdb',
          accentSoft: 'rgba(108, 99, 255, 0.12)',
          accentBorder: 'rgba(108, 99, 255, 0.18)',
          strongBg: 'linear-gradient(180deg, #6c63ff 0%, #574fdb 100%)',
          strongShadow: '0 16px 28px rgba(87, 79, 219, 0.22)'
        }
      }}
    />
  );
}
