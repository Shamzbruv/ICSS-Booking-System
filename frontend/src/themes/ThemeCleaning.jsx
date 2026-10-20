import SharedBookingTheme from './SharedBookingTheme';

export default function ThemeCleaning({ tenant, services }) {
  return <SharedBookingTheme tenant={tenant} services={services} theme={{
    name: 'cleaning', icon: 'fa-broom', serviceIcon: 'fa-broom', itemIcon: 'fa-check',
    serviceSectionTitle: 'Choose your clean', detailsSectionTitle: 'Your visit details',
    preferenceField: { label: 'Preferred team member', noteLabel: 'Team member', options: (currentTenant) => {
      const members = currentTenant.branding?.stylists || [];
      return members.length ? [{ label: 'Anyone available' }, ...members.map((label) => ({ label }))] : [];
    } },
    extraFields: [{ name: 'notes', label: 'Property & access details', type: 'textarea', placeholder: 'Service address, property size, areas to focus on, pets, and entry instructions…', noteLabel: 'Property details' }],
    buildNotes: ({ extraState, selectedOption }) => `Property details: ${extraState.notes || 'None provided'}\nTeam member: ${selectedOption?.label || 'Anyone available'}`,
    footerNote: 'Book your visit online. Please include your service address and access details.',
    palette: {
      pageBg: '#e8f5f8', shellBg: '#ffffff', panelBg: '#ffffff', cardBg: '#ffffff',
      cardBorder: '#dbe5e3', inputBorder: '#c9d9d7', textMain: '#173c3b', textSubtle: '#4d6865', textMuted: '#647d79',
      accent: '#176b87', accentStrong: '#176b87', accentSoft: '#e8f5f8', accentBorder: '#b6d7ce',
      strongBg: '#176b87', buttonText: '#ffffff'
    }
  }} />;
}
