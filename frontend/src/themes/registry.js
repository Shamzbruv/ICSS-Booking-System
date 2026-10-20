// Maps a tenant's template to its booking widget component.
import ThemeBarber from './ThemeBarber';
import ThemeSpa from './ThemeSpa';
import ThemeMechanic from './ThemeMechanic';
import ThemeEvents from './ThemeEvents';
import ThemeFitness from './ThemeFitness';
import ThemeHairdresser from './ThemeHairdresser';
import ThemeHealth from './ThemeHealth';
import ThemeLaw from './ThemeLaw';
import ThemeNailTech from './ThemeNailTech';
import ThemePhotography from './ThemePhotography';
import ThemeUniversal from './ThemeUniversal';
import ThemeLandscaping from './ThemeLandscaping';
import ThemeCleaning from './ThemeCleaning';

import { ThemePartyRentals, ThemeCarRental, ThemeCatering, ThemeDetailing, ThemeHomeRepairs, ThemeTutoring } from './ThemeLocalServices';

export const BOOKING_THEMES = {
  'party-rentals': ThemePartyRentals,
  'car-rental': ThemeCarRental,
  catering: ThemeCatering,
  detailing: ThemeDetailing,
  'home-repairs': ThemeHomeRepairs,
  tutoring: ThemeTutoring,
  barber: ThemeBarber,
  spa: ThemeSpa,
  mechanic: ThemeMechanic,
  events: ThemeEvents,
  fitness: ThemeFitness,
  hairdresser: ThemeHairdresser,
  health: ThemeHealth,
  law: ThemeLaw,
  'nail-tech': ThemeNailTech,
  photography: ThemePhotography,
  landscaping: ThemeLandscaping,
  cleaning: ThemeCleaning,
  universal: ThemeUniversal
};

const LEGACY_NAMES = {
  'Island Occasion Rentals': 'party-rentals',
  'Island Drive Rentals': 'car-rental',
  'Yaad Table Catering': 'catering',
  'Fresh Ride Detailing': 'detailing',
  'YaadFix Home Services': 'home-repairs',
  'BrightPath Tutoring': 'tutoring',
  'Iron & Blade': 'barber',
  'Botanica Spa': 'spa',
  'Pro Auto Care': 'mechanic',
  'Gather & Grace': 'events',
  'Pulse Studio': 'fitness',
  'Blush & Braids': 'hairdresser',
  'Serenity Health': 'health',
  'Meridian Law': 'law',
  'Elegant Nails': 'nail-tech',
  'Polished & Pure': 'nail-tech',
  'Lumina Lens': 'photography',
  'GreenScape Landscaping': 'landscaping',
  'FreshStart Cleaning': 'cleaning'
};

export function resolveThemeKey(tenant) {
  if (tenant?.themeKey && BOOKING_THEMES[tenant.themeKey]) return tenant.themeKey;
  if (tenant?.themeCode === 'nail-tech') return 'nail-tech';
  return LEGACY_NAMES[tenant?.themeName] || 'universal';
}

export function getBookingTheme(key) {
  return BOOKING_THEMES[key] || ThemeUniversal;
}
