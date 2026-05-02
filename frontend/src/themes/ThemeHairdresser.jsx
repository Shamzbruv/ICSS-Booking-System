import SharedBookingTheme from './SharedBookingTheme';

export default function ThemeHairdresser({ tenant, services }) {
  return (
    <SharedBookingTheme
      tenant={tenant}
      services={services}
      theme={{
        name: 'hairdresser',
        icon: 'fa-spa',
        serviceIcon: 'fa-scissors',
        itemIcon: 'fa-cut',
        serviceSectionTitle: 'Choose a Service',
        detailsSectionTitle: 'Your Details',
        preferenceField: {
          label: 'Stylist preference',
          options: (currentTenant) => {
            const stylists = currentTenant.branding?.stylists || [];
            if (stylists.length === 0) return [];
            return [{ label: 'Any available (recommended)' }, ...stylists.map((name) => ({ label: name }))];
          },
          noteLabel: 'Stylist'
        },
        footerNote: 'Secure booking. Cancel free up to 6 hours before.',
        palette: {
          pageBg: '#f8f3f5',
          pageAccentA: 'rgba(199, 154, 172, 0.16)',
          pageAccentB: 'rgba(220, 198, 207, 0.18)',
          shellBg: 'rgba(255, 255, 255, 0.78)',
          panelBg: 'rgba(255, 255, 255, 0.92)',
          cardBorder: '#eadbe1',
          inputBorder: '#eadbe1',
          textMain: '#261821',
          textSubtle: '#724356',
          textMuted: '#8d7280',
          accent: '#8b5268',
          accentStrong: '#724356',
          accentSoft: 'rgba(139, 82, 104, 0.12)',
          accentBorder: 'rgba(139, 82, 104, 0.18)',
          strongBg: 'linear-gradient(180deg, #9f5e76 0%, #82485d 100%)',
          strongShadow: '0 16px 28px rgba(130, 72, 93, 0.24)'
        }
      }}
    />
  );
}
