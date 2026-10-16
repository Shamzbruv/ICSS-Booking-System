const toggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('primaryNav');
function closeMenu() { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open navigation'); }
toggle.addEventListener('click', () => { const open = nav.classList.toggle('is-open'); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); });
nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); toggle.focus(); } });
document.addEventListener('click', event => { if (!event.target.closest('.navigation')) closeMenu(); });
window.matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);
document.querySelectorAll('[data-scroll-target]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.scrollTarget)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })));
document.getElementById('year').textContent = new Date().getFullYear();

// ── "See your space" live website preview ────────────────────────────────────
(function initSpacePreview() {
  const frame = document.getElementById('spaceFrame');
  if (!frame) return;
  const scaler = document.getElementById('spaceScaler');
  const wrap = document.getElementById('spaceFrameWrap');
  const nameInput = document.getElementById('spaceName');
  const template = document.getElementById('spaceTemplate');
  const playground = document.getElementById('spacePlayground');
  const urlLabel = document.getElementById('spaceUrl');
  const widths = { desktop: 1280, tablet: 820, phone: 390 };
  const state = { name: '', color: '', page: '', device: 'desktop' };
  let timer = 0;

  const slugify = (text) => (text || 'your-business').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'your-business';

  function layout() {
    const width = widths[state.device];
    const available = scaler.clientWidth;
    const scale = Math.min(1, available / width);
    frame.style.width = `${width}px`;
    frame.style.height = `${scaler.clientHeight / scale}px`;
    frame.style.transform = `scale(${scale})`;
  }

  function query() {
    const params = new URLSearchParams();
    if (state.name) params.set('name', state.name);
    if (state.color) params.set('primary', state.color);
    return params.toString();
  }

  function update() {
    const q = query();
    frame.src = `/demo/${template.value}${state.page ? `/${state.page}` : ''}${q ? `?${q}` : ''}`;
    const pg = new URLSearchParams({ theme: template.value });
    if (state.name) pg.set('name', state.name);
    if (state.color) pg.set('primary', state.color);
    playground.href = `/playground?${pg}`;
    urlLabel.textContent = `icssbookings.com/${slugify(state.name)}${state.page ? `/${state.page}` : ''}`;
  }

  function choose(groupId, attr, key, onChange) {
    document.getElementById(groupId).addEventListener('click', (event) => {
      const button = event.target.closest(`button[data-${attr}]`);
      if (!button) return;
      document.querySelectorAll(`#${groupId} button`).forEach((b) => b.classList.toggle('is-active', b === button));
      state[key] = button.dataset[attr];
      onChange();
    });
  }

  nameInput.addEventListener('input', () => { state.name = nameInput.value.trim(); clearTimeout(timer); timer = setTimeout(update, 450); });
  template.addEventListener('change', update);
  choose('spaceSwatches', 'color', 'color', update);
  choose('spacePages', 'page', 'page', update);
  choose('spaceDevices', 'device', 'device', () => { wrap.dataset.device = state.device; requestAnimationFrame(layout); setTimeout(layout, 320); });
  document.getElementById('spaceCustomColor').addEventListener('input', (event) => {
    document.querySelectorAll('#spaceSwatches button').forEach((b) => b.classList.remove('is-active'));
    state.color = event.target.value;
    clearTimeout(timer); timer = setTimeout(update, 250);
  });
  document.getElementById('spaceControls').addEventListener('submit', (event) => event.preventDefault());
  new ResizeObserver(layout).observe(scaler);
  layout();
})();
