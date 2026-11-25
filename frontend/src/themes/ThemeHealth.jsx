import SharedBookingTheme from './SharedBookingTheme';

export default function ThemeHealth({ tenant, services }) {
  return (
    <SharedBookingTheme
      tenant={tenant}
      services={services}
      theme={{
        name: 'health',
        icon: 'fa-heart-pulse',
        serviceIcon: 'fa-notes-medical',
        itemIcon: 'fa-stethoscope',
        serviceSectionTitle: 'Choose a Visit',
        detailsSectionTitle: 'Patient Details',
        privacyNotice: 'Use this form to schedule an appointment. Contact the practice directly about symptoms, medications, insurance or medical records.',
        receiptLabel: 'Bank transfer receipt only',
        receiptHelperText: 'Upload only proof of payment. Contact the practice directly about insurance and medical documents.',
        priceFormatter: (service) => Number(service?.price || 0) === 0 ? 'Cost varies' : `$${Number(service.price).toLocaleString()}`,
        totalFormatter: (_, service) => Number(service?.price || 0) === 0 ? 'Contact the practice' : `$${Number(service?.price || 0).toLocaleString()}`,
        totalLabel: 'Estimated cost',
        footerNote: 'Please review the cancellation policy in your confirmation email.',
        palette: {
          pageBg: '#f2f8f7',
          pageAccentA: 'rgba(67, 130, 137, 0.16)',
          pageAccentB: 'rgba(169, 213, 210, 0.18)',
          shellBg: 'rgba(255, 255, 255, 0.82)',
          panelBg: 'rgba(255, 255, 255, 0.95)',
          cardBorder: '#d8ebea',
          inputBorder: '#d8ebea',
          textMain: '#153137',
          textSubtle: '#45747c',
          textMuted: '#7b9da2',
          accent: '#2c7a80',
          accentStrong: '#215f64',
          accentSoft: 'rgba(44, 122, 128, 0.12)',
          accentBorder: 'rgba(44, 122, 128, 0.18)',
          strongBg: 'linear-gradient(180deg, #2c7a80 0%, #245f64 100%)',
          strongShadow: '0 16px 28px rgba(36, 95, 100, 0.22)'
        }
      }}
    />
  );
}
