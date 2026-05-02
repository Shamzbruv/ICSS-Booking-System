import SharedBookingTheme from './SharedBookingTheme';

export default function ThemeBarber({ tenant, services }) {
  return (
    <SharedBookingTheme
      tenant={tenant}
      services={services}
      theme={{
        name: 'barber',
        icon: 'fa-scissors',
        serviceIcon: 'fa-scissors',
        itemIcon: 'fa-cut',
        serviceSectionTitle: 'Choose a Service',
        detailsSectionTitle: 'Appointment Details',
        extraFields: [
          { name: 'notes', label: 'Style notes', type: 'textarea', placeholder: 'Fade preference, beard shape, or any request...', noteLabel: 'Style Notes' }
        ],
        footerNote: 'Secure booking. Walk-ins are subject to availability.',
        palette: {
          pageBg: '#111312',
          pageAccentA: 'rgba(180, 146, 88, 0.18)',
          pageAccentB: 'rgba(57, 64, 54, 0.22)',
          shellBg: 'rgba(21, 24, 22, 0.9)',
          shellBorder: 'rgba(180, 146, 88, 0.12)',
          shellShadow: '0 24px 52px rgba(0, 0, 0, 0.34)',
          panelBg: 'rgba(25, 28, 26, 0.96)',
          panelBorder: 'rgba(180, 146, 88, 0.12)',
          panelShadow: '0 18px 36px rgba(0, 0, 0, 0.22)',
          cardBg: '#181c19',
          cardBorder: '#30372f',
          cardHover: 'rgba(180, 146, 88, 0.36)',
          cardSelected: 'linear-gradient(180deg, #1d231f 0%, #171b18 100%)',
          cardSelectedBorder: 'rgba(180, 146, 88, 0.44)',
          softBg: 'rgba(180, 146, 88, 0.12)',
          strongBg: 'linear-gradient(180deg, #b49258 0%, #8f7140 100%)',
          strongShadow: '0 16px 28px rgba(180, 146, 88, 0.22)',
          inputBg: '#141816',
          inputBorder: '#30372f',
          textMain: '#f3efe6',
          textSubtle: '#d5c29e',
          textMuted: '#998f7a',
          accent: '#caa86d',
          accentStrong: '#e4c890',
          accentSoft: 'rgba(202, 168, 109, 0.12)',
          accentBorder: 'rgba(202, 168, 109, 0.18)',
          buttonText: '#16120c'
        }
      }}
    />
  );
}
