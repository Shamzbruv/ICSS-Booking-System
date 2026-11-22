// Website presets — one per industry template. Each is individually designed
// (palette, type, hero treatment, section order and copy) and is the starting
// point a tenant customises in the Website Builder.
import barber from './barber';
import spa from './spa';
import mechanic from './mechanic';
import events from './events';
import fitness from './fitness';
import hairdresser from './hairdresser';
import health from './health';
import law from './law';
import nailTech from './nail-tech';
import photography from './photography';
import universal from './universal';
import landscaping from './landscaping';
import cleaning from './cleaning';

import partyRentals from './party-rentals';
import carRental from './car-rental';
import catering from './catering';
import detailing from './detailing';
import homeRepairs from './home-repairs';
import tutoring from './tutoring';
import musicians from './musicians';

import drivingLessons from './driving-lessons.js';
import influencers from './influencers.js';
import pastorMinistry from './pastor-ministry.js';
import cateringEvents from './catering-events.js';
import photographyVideo from './photography-video.js';
import tutoringCoaching from './tutoring-coaching.js';
import homeServices from './home-services.js';
import { TRADE_PRESETS } from './trade-starters.js';

export const PRESETS = {
  ...TRADE_PRESETS,
  influencers,
  'driving-lessons': drivingLessons,
  'pastor-ministry': pastorMinistry,
  'catering-events': cateringEvents,
  'photography-video': photographyVideo,
  'tutoring-coaching': tutoringCoaching,
  'home-services': homeServices,
  musicians,
  'party-rentals': partyRentals, 'car-rental': carRental, catering, detailing, 'home-repairs': homeRepairs, tutoring,
  barber, spa, mechanic, events, fitness, hairdresser, health, law,
  'nail-tech': nailTech, photography, universal, landscaping, cleaning
};

export function getPreset(key) {
  return PRESETS[key] || PRESETS.universal;
}
