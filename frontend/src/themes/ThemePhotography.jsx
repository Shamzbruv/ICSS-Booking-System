import SharedBookingTheme from './SharedBookingTheme';

export default function ThemePhotography({ tenant, services }) {
  return (
    <SharedBookingTheme
      tenant={tenant}
      services={services}
      theme={{
        name: 'photography',
        icon: 'fa-camera',
        serviceIcon: 'fa-images',
        itemIcon: 'fa-camera-retro',
        serviceSectionTitle: 'Choose a Session',
        detailsSectionTitle: 'Session Details',
        extraFields: [
          {
            name: 'vibe',
            label: 'Creative direction',
            type: 'select',
            defaultValue: 'Editorial / fashion',
            options: ['Editorial / fashion', 'Minimal / clean', 'Warm / romantic', 'Bold / cinematic'].map((label) => ({ label })),
            noteLabel: 'Vibe'
          },
          { name: 'specialRequests', label: 'Special requests', type: 'textarea', placeholder: 'Location ideas, mood references, deliverables, wardrobe notes...', noteLabel: 'Requests' }
        ],
        priceFormatter: (service) => Number(service?.price || 0) === 0 ? 'Custom' : `$${Number(service.price).toLocaleString()}`,
        totalFormatter: (_, service) => Number(service?.price || 0) === 0 ? 'Custom quote' : `$${Number(service?.price || 0).toLocaleString()}`,
        totalLabel: 'Session total',
        buildNotes: ({ extraState }) =>
          `Vibe: ${extraState.vibe}\nRequests: ${extraState.specialRequests || 'None'}`,
        footerNote: 'Secure booking. Final creative details can be confirmed after checkout.',
        palette: {
          pageBg: '#f5f1ee',
          pageAccentA: 'rgba(146, 119, 88, 0.16)',
          pageAccentB: 'rgba(73, 63, 55, 0.16)',
          shellBg: 'rgba(255, 255, 255, 0.82)',
          panelBg: 'rgba(255, 255, 255, 0.95)',
          cardBorder: '#e6dbd1',
          inputBorder: '#e6dbd1',
          textMain: '#241d18',
          textSubtle: '#6f5e50',
          textMuted: '#9a897b',
          accent: '#8a6a50',
          accentStrong: '#6f5641',
          accentSoft: 'rgba(138, 106, 80, 0.11)',
          accentBorder: 'rgba(138, 106, 80, 0.18)',
          strongBg: 'linear-gradient(180deg, #8a6a50 0%, #6f5641 100%)',
          strongShadow: '0 16px 28px rgba(111, 86, 65, 0.22)'
        }
      }}
    />
  );
}
