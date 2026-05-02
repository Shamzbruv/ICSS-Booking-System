import SharedBookingTheme from './SharedBookingTheme';

const instructors = [
  { label: 'Any coach' },
  { label: 'Marcus (HIIT/Strength)' },
  { label: 'Jordan (Spin/Cardio)' },
  { label: 'Sasha (Yoga/Recovery)' },
  { label: 'Taylor (All-levels)' }
];

export default function ThemeFitness({ tenant, services }) {
  return (
    <SharedBookingTheme
      tenant={tenant}
      services={services}
      theme={{
        name: 'fitness',
        icon: 'fa-dumbbell',
        serviceIcon: 'fa-bolt',
        itemIcon: 'fa-fire',
        serviceSectionTitle: 'Choose a Session',
        detailsSectionTitle: 'Your Details',
        preferenceField: { label: 'Preferred coach', options: instructors, noteLabel: 'Coach' },
        extraFields: [
          {
            name: 'fitnessLevel',
            label: 'Fitness level',
            type: 'select',
            defaultValue: 'Intermediate (consistent 3-6mo)',
            options: [
              'Beginner (new to training)',
              'Intermediate (consistent 3-6mo)',
              'Advanced (training 1y+)',
            ].map((label) => ({ label })),
            noteLabel: 'Level'
          },
          { name: 'injuries', label: 'Injuries or limitations', type: 'textarea', placeholder: 'Anything we should know before class?', noteLabel: 'Injuries' },
          { name: 'goals', label: 'Goals', type: 'textarea', placeholder: 'Strength, fat loss, recovery, endurance...', noteLabel: 'Goals' }
        ],
        priceFormatter: (service) => Number(service?.price || 0) === 0 ? 'Free' : `$${Number(service.price).toLocaleString()}`,
        summaryRows: ({ selectedOption, extraState }) => [
          { label: 'Coach', value: selectedOption?.label || 'Any coach' },
          { label: 'Level', value: extraState.fitnessLevel || '—' }
        ],
        footerNote: 'Secure booking. Arrive 10 minutes early and bring water.',
        selectTimeAlert: 'Please select a class time.',
        buildNotes: ({ selectedOption, extraState }) =>
          `Coach: ${selectedOption?.label || 'Any coach'}\nLevel: ${extraState.fitnessLevel}\nInjuries: ${extraState.injuries || 'None'}\nGoals: ${extraState.goals || 'None'}`,
        palette: {
          pageBg: '#f4f6fb',
          pageAccentA: 'rgba(255, 111, 97, 0.16)',
          pageAccentB: 'rgba(77, 99, 140, 0.14)',
          shellBg: 'rgba(255, 255, 255, 0.84)',
          panelBg: 'rgba(255, 255, 255, 0.96)',
          cardBorder: '#dfe6f2',
          inputBorder: '#dfe6f2',
          textMain: '#16212f',
          textSubtle: '#4a607d',
          textMuted: '#8191a8',
          accent: '#ff6f61',
          accentStrong: '#dc5b50',
          accentSoft: 'rgba(255, 111, 97, 0.12)',
          accentBorder: 'rgba(255, 111, 97, 0.18)',
          strongBg: 'linear-gradient(180deg, #ff6f61 0%, #dd5d51 100%)',
          strongShadow: '0 16px 28px rgba(221, 93, 81, 0.22)'
        }
      }}
    />
  );
}
