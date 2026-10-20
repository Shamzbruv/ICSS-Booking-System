import SharedBookingTheme from './SharedBookingTheme';

export default function ThemeLandscaping({ tenant, services }) {
  return <SharedBookingTheme tenant={tenant} services={services} theme={{
    name: 'landscaping', icon: 'fa-leaf', serviceIcon: 'fa-leaf', itemIcon: 'fa-check',
    serviceSectionTitle: 'Garden & lawn services', detailsSectionTitle: 'Your visit details',
    preferenceField: { label: 'Preferred team member', noteLabel: 'Team member', options: (currentTenant) => {
      const members = currentTenant.branding?.stylists || [];
      return members.length ? [{ label: 'Anyone available' }, ...members.map((label) => ({ label }))] : [];
    } },
    extraFields: [{ name: 'notes', label: 'Property & access details', type: 'textarea', placeholder: 'Service address, garden size, access instructions, and what you would like help with…', noteLabel: 'Property details' }],
    buildNotes: ({ extraState, selectedOption }) => `Property details: ${extraState.notes || 'None provided'}\nTeam member: ${selectedOption?.label || 'Anyone available'}`,
    footerNote: 'Book your visit online. Please include your service address and access details.',
    palette: {
      pageBg: '#edf3e8', shellBg: '#ffffff', panelBg: '#ffffff', cardBg: '#ffffff',
      cardBorder: '#dbe5e3', inputBorder: '#c9d9d7', textMain: '#173c3b', textSubtle: '#4d6865', textMuted: '#647d79',
      accent: '#24553e', accentStrong: '#24553e', accentSoft: '#edf3e8', accentBorder: '#b6d7ce',
      strongBg: '#24553e', buttonText: '#ffffff'
    }
  }} />;
}
