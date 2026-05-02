import SharedBookingTheme from './SharedBookingTheme';

const therapists = [
  { label: 'Any available' },
  { label: 'Jade (holistic facialist)' },
  { label: 'Maya (massage & bodywork)' },
  { label: 'Elena (clinical esthetician)' }
];

export default function ThemeSpa({ tenant, services }) {
  return (
    <SharedBookingTheme
      tenant={tenant}
      services={services}
      theme={{
        name: 'spa',
        icon: 'fa-leaf',
        serviceIcon: 'fa-spa',
        itemIcon: 'fa-water',
        serviceSectionTitle: 'Choose a Treatment',
        detailsSectionTitle: 'Guest Details',
        preferenceField: { label: 'Preferred therapist', options: therapists, noteLabel: 'Therapist' },
        extraFields: [
          { name: 'birthDate', label: 'Date of birth', type: 'date', noteLabel: 'DOB' },
          { name: 'allergies', label: 'Allergies or sensitivities', type: 'textarea', placeholder: 'Products, ingredients, or medical concerns...', noteLabel: 'Allergies' },
          { name: 'requests', label: 'Treatment goals', type: 'textarea', placeholder: 'Relaxation, tension areas, skin goals, pressure preference...', noteLabel: 'Requests' }
        ],
        summaryRows: ({ selectedOption }) => [
          { label: 'Therapist', value: selectedOption?.label || 'Any available' }
        ],
        buildNotes: ({ selectedOption, extraState }) =>
          `Therapist: ${selectedOption?.label || 'Any available'}\nDOB: ${extraState.birthDate || 'N/A'}\nAllergies: ${extraState.allergies || 'None'}\nRequests: ${extraState.requests || 'None'}`,
        footerNote: 'Secure booking. Please arrive 10 minutes early for your intake.',
        palette: {
          pageBg: '#f3f7f2',
          pageAccentA: 'rgba(120, 155, 122, 0.16)',
          pageAccentB: 'rgba(198, 220, 200, 0.18)',
          shellBg: 'rgba(255, 255, 255, 0.82)',
          panelBg: 'rgba(255, 255, 255, 0.95)',
          cardBorder: '#dce9dc',
          inputBorder: '#dce9dc',
          textMain: '#1d2b22',
          textSubtle: '#526f58',
          textMuted: '#89a08f',
          accent: '#6d8f72',
          accentStrong: '#55705b',
          accentSoft: 'rgba(109, 143, 114, 0.12)',
          accentBorder: 'rgba(109, 143, 114, 0.18)',
          strongBg: 'linear-gradient(180deg, #6d8f72 0%, #55705b 100%)',
          strongShadow: '0 16px 28px rgba(85, 112, 91, 0.22)'
        }
      }}
    />
  );
}
