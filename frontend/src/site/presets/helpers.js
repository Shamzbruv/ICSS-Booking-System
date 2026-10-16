// Shared helpers for theme website presets.
// Stock photography is served from Unsplash's CDN at sizes matched to each slot;
// tenants replace it with their own uploads in the Website Builder.
export function stock(id, width = 1600, height) {
  const params = new URLSearchParams({ auto: 'format', fit: 'crop', q: '72', w: String(width) });
  if (height) params.set('h', String(height));
  return `https://images.unsplash.com/photo-${id}?${params}`;
}

export const hero = (id) => stock(id, 1920, 1080);
export const portrait = (id) => stock(id, 1200, 1500);
export const square = (id) => stock(id, 800, 800);
export const banner = (id) => stock(id, 2400, 1000);
export const tile = (id) => stock(id, 1000, 1250);

export function page(id, sections, extra = {}) {
  return { id, visible: true, ...extra, sections };
}

export function section(id, type, props = {}, visible = true) {
  return { id, type, visible, props };
}
