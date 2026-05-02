import SharedBookingTheme from './SharedBookingTheme';

const attorneys = [
  { label: 'First Available' },
  { label: 'Sarah Meridian (Managing Partner)' },
  { label: 'David Chen (Corporate)' },
  { label: 'Michelle Williams (Family Law)' },
  { label: 'Raj Patel (Estate Planning)' },
  { label: 'Chioma Okonkwo (Litigation)' }
];

export default function ThemeLaw({ tenant, services }) {
  return (
    <SharedBookingTheme
      tenant={tenant}
      services={services}
      theme={{
        name: 'law',
        icon: 'fa-scale-balanced',
        serviceIcon: 'fa-briefcase',
        itemIcon: 'fa-gavel',
        serviceSectionTitle: 'Choose a Consultation',
        detailsSectionTitle: 'Client Intake',
        preferenceField: { label: 'Preferred attorney', options: attorneys, noteLabel: 'Attorney' },
        extraFields: [
          { name: 'company', label: 'Company (optional)', type: 'text', placeholder: 'Business or organization name', noteLabel: 'Company' },
          {
            name: 'matterType',
            label: 'Matter type',
            type: 'select',
            defaultValue: 'Family Law',
            options: ['Family Law', 'Corporate', 'Real Estate', 'Estate Planning', 'Litigation'].map((label) => ({ label })),
            noteLabel: 'Matter'
          },
          { name: 'description', label: 'Brief description', type: 'textarea', placeholder: 'Share the background for your consultation...', noteLabel: 'Description' }
        ],
        summaryRows: ({ selectedOption, extraState }) => [
          { label: 'Attorney', value: selectedOption?.label || 'First Available' },
          { label: 'Matter', value: extraState.matterType || '—' }
        ],
        buildNotes: ({ selectedOption, extraState }) =>
          `Attorney: ${selectedOption?.label || 'First Available'}\nCompany: ${extraState.company || 'N/A'}\nMatter: ${extraState.matterType}\nDescription: ${extraState.description || 'None'}`,
        footerNote: 'Secure consultation booking. Documents can be shared after confirmation.',
        palette: {
          pageBg: '#f3f4f8',
          pageAccentA: 'rgba(25, 52, 92, 0.18)',
          pageAccentB: 'rgba(184, 150, 86, 0.14)',
          shellBg: 'rgba(255, 255, 255, 0.84)',
          panelBg: 'rgba(255, 255, 255, 0.96)',
          cardBorder: '#dee4ef',
          inputBorder: '#dee4ef',
          textMain: '#182338',
          textSubtle: '#475778',
          textMuted: '#7e89a1',
          accent: '#1f3e6f',
          accentStrong: '#173053',
          accentSoft: 'rgba(31, 62, 111, 0.11)',
          accentBorder: 'rgba(31, 62, 111, 0.18)',
          strongBg: 'linear-gradient(180deg, #1f3e6f 0%, #173053 100%)',
          strongShadow: '0 16px 28px rgba(23, 48, 83, 0.22)',
          buttonText: '#ffffff'
        }
      }}
    />
  );
}
