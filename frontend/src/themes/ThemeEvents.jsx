import SharedBookingTheme from './SharedBookingTheme';

const rentals = [
  { id: 'tables', name: 'Farm Tables (8)', price: 240, description: 'Warm wood dining setup' },
  { id: 'chairs', name: 'Crossback Chairs (40)', price: 320, description: 'Guest seating package' },
  { id: 'linens', name: 'Premium Linens', price: 180, description: 'Neutral layered tablescape' },
  { id: 'lighting', name: 'String Lighting', price: 290, description: 'Ambient evening lighting' },
  { id: 'bar', name: 'Mobile Bar Setup', price: 400, description: 'Bar station and styling' },
  { id: 'lounge', name: 'Lounge Furniture Set', price: 550, description: 'Soft seating cluster' }
];

export default function ThemeEvents({ tenant, services }) {
  return (
    <SharedBookingTheme
      tenant={tenant}
      services={services}
      theme={{
        name: 'events',
        icon: 'fa-champagne-glasses',
        serviceIcon: 'fa-calendar-days',
        itemIcon: 'fa-star',
        serviceSectionTitle: 'Choose a Package',
        detailsSectionTitle: 'Host Details',
        timeLabel: 'Choose a start time',
        addons: { title: 'Enhancements', items: rentals },
        extraFields: [
          {
            name: 'guestCount',
            label: 'Guest count',
            type: 'select',
            defaultValue: '40-75 guests',
            options: ['20-40 guests', '40-75 guests', '75-120 guests', '120+ guests'].map((label) => ({ label })),
            noteLabel: 'Guest Count'
          },
          { name: 'venue', label: 'Venue / address', type: 'text', required: true, placeholder: 'Venue name or event address', noteLabel: 'Venue' },
          { name: 'notes', label: 'Special notes', type: 'textarea', placeholder: 'Dietary, setup preferences, timing notes...', noteLabel: 'Event Notes' }
        ],
        summaryRows: ({ selectedAddonItems, extraState }) => [
          { label: 'Enhancements', value: selectedAddonItems.length ? `${selectedAddonItems.length} selected` : 'None' },
          { label: 'Guest count', value: extraState.guestCount || '—' }
        ],
        calculateTotal: ({ selectedService, selectedAddonItems }) =>
          Number(selectedService?.price || 0) + selectedAddonItems.reduce((sum, item) => sum + Number(item.price || 0), 0),
        totalLabel: 'Estimated total',
        bookButtonLabel: 'Request Booking',
        footerNote: 'Secure event request. Deposit and confirmation terms apply.',
        buildNotes: ({ extraState, selectedAddonItems }) => {
          const rentalsList = selectedAddonItems.length ? selectedAddonItems.map((item) => `${item.name} (+$${item.price})`).join(', ') : 'None';
          return `Venue: ${extraState.venue}\nGuests: ${extraState.guestCount}\nRentals: ${rentalsList}\nNotes: ${extraState.notes || 'None'}`;
        },
        palette: {
          pageBg: '#f6f0ea',
          pageAccentA: 'rgba(155, 123, 87, 0.18)',
          pageAccentB: 'rgba(201, 176, 151, 0.18)',
          shellBg: 'rgba(255, 251, 247, 0.82)',
          panelBg: 'rgba(255, 253, 250, 0.95)',
          cardBorder: '#e7d6c8',
          inputBorder: '#e7d6c8',
          textMain: '#2f241f',
          textSubtle: '#7a5f4c',
          textMuted: '#a18a7d',
          accent: '#9b6f4e',
          accentStrong: '#7a583f',
          accentSoft: 'rgba(155, 111, 78, 0.1)',
          accentBorder: 'rgba(155, 111, 78, 0.18)',
          strongBg: 'linear-gradient(180deg, #8d5f3d 0%, #6f492f 100%)',
          strongShadow: '0 16px 28px rgba(111, 73, 47, 0.22)'
        }
      }}
    />
  );
}
