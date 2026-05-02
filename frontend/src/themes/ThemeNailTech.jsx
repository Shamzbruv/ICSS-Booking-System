import SharedBookingTheme from './SharedBookingTheme';

const techs = [
  { label: 'First available' },
  { label: 'Sophia (Gel expert)' },
  { label: 'Olivia (Nail art queen)' },
  { label: 'Ava (Acrylic specialist)' },
  { label: 'Mia (Dip & pedicure)' }
];

export default function ThemeNailTech({ tenant, services }) {
  return (
    <SharedBookingTheme
      tenant={tenant}
      services={services}
      theme={{
        name: 'nailtech',
        icon: 'fa-hand-sparkles',
        serviceIcon: 'fa-palette',
        itemIcon: 'fa-gem',
        serviceSectionTitle: 'Choose a Service',
        detailsSectionTitle: 'Your Details',
        preferenceField: { label: 'Preferred nail tech', options: techs, noteLabel: 'Nail Tech' },
        extraFields: [
          { name: 'colorPref', label: 'Color preference', type: 'text', placeholder: 'Soft pink, chrome silver, classic red...', noteLabel: 'Color' },
          { name: 'nailNotes', label: 'Design notes', type: 'textarea', placeholder: 'Shape, inspiration, nail art ideas...', noteLabel: 'Notes' }
        ],
        summaryRows: ({ selectedOption, extraState }) => [
          { label: 'Nail tech', value: selectedOption?.label || 'First available' },
          { label: 'Color', value: extraState.colorPref || 'Open' }
        ],
        buildNotes: ({ selectedOption, extraState }) =>
          `Nail Tech: ${selectedOption?.label || 'First available'}\nColor: ${extraState.colorPref || 'None'}\nNotes: ${extraState.nailNotes || 'None'}`,
        footerNote: 'Secure booking. Bring any reference photos to your appointment.',
        priceFormatter: (service) => Number(service?.price || 0) === 0 ? 'Free' : `$${Number(service.price).toLocaleString()}`,
        palette: {
          pageBg: '#fbf4f7',
          pageAccentA: 'rgba(219, 128, 168, 0.16)',
          pageAccentB: 'rgba(235, 208, 220, 0.16)',
          shellBg: 'rgba(255, 255, 255, 0.82)',
          panelBg: 'rgba(255, 255, 255, 0.95)',
          cardBorder: '#eed7e3',
          inputBorder: '#eed7e3',
          textMain: '#2b1722',
          textSubtle: '#7f4c66',
          textMuted: '#a77a8f',
          accent: '#d86d9a',
          accentStrong: '#b65580',
          accentSoft: 'rgba(216, 109, 154, 0.12)',
          accentBorder: 'rgba(216, 109, 154, 0.18)',
          strongBg: 'linear-gradient(180deg, #d86d9a 0%, #b65580 100%)',
          strongShadow: '0 16px 28px rgba(182, 85, 128, 0.22)'
        }
      }}
    />
  );
}
