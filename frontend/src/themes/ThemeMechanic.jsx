import SharedBookingTheme from './SharedBookingTheme';

const advisors = [
  { label: 'First Available' },
  { label: 'Mike (Master Tech)' },
  { label: 'Dave (Brakes/Suspension)' },
  { label: 'Sarah (Diagnostics)' }
];

export default function ThemeMechanic({ tenant, services }) {
  return (
    <SharedBookingTheme
      tenant={tenant}
      services={services}
      theme={{
        name: 'mechanic',
        icon: 'fa-wrench',
        serviceIcon: 'fa-screwdriver-wrench',
        itemIcon: 'fa-car',
        serviceSectionTitle: 'Choose a Service',
        detailsSectionTitle: 'Vehicle Details',
        preferenceField: { label: 'Preferred technician', options: advisors, noteLabel: 'Technician' },
        extraFields: [
          { name: 'notes', label: 'Vehicle info / symptoms', type: 'textarea', placeholder: 'Vehicle make/model, warning lights, noises, or concerns...', noteLabel: 'Vehicle Info/Symptoms' }
        ],
        summaryRows: ({ selectedOption }) => [
          { label: 'Technician', value: selectedOption?.label || 'First Available' }
        ],
        buildNotes: ({ selectedOption, extraState }) =>
          `Technician: ${selectedOption?.label || 'First Available'}\nVehicle Info/Symptoms: ${extraState.notes || 'None'}`,
        footerNote: 'Secure service booking. Drop-off times are confirmed in your follow-up email.',
        selectTimeAlert: 'Please select a drop-off time.',
        palette: {
          pageBg: '#f4f6f8',
          pageAccentA: 'rgba(255, 123, 0, 0.14)',
          pageAccentB: 'rgba(61, 77, 92, 0.16)',
          shellBg: 'rgba(255, 255, 255, 0.84)',
          panelBg: 'rgba(255, 255, 255, 0.96)',
          cardBorder: '#dce3ea',
          inputBorder: '#dce3ea',
          textMain: '#15202c',
          textSubtle: '#4e6277',
          textMuted: '#8392a4',
          accent: '#ff7b00',
          accentStrong: '#d86700',
          accentSoft: 'rgba(255, 123, 0, 0.12)',
          accentBorder: 'rgba(255, 123, 0, 0.18)',
          strongBg: 'linear-gradient(180deg, #ff7b00 0%, #d86700 100%)',
          strongShadow: '0 16px 28px rgba(216, 103, 0, 0.22)',
          buttonText: '#13181f'
        }
      }}
    />
  );
}
