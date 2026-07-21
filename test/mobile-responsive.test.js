const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('primary tenant admin pages opt into iPhone safe areas', () => {
  for (const page of ['index.html', 'bookings.html', 'availability.html', 'services.html', 'settings.html', 'tenants.html', 'login.html']) {
    assert.match(read(`admin/${page}`), /viewport-fit=cover/, `${page} needs viewport-fit=cover`);
  }
});

test('mobile admin rules come after desktop modal rules and use dynamic viewport units', () => {
  const css = read('admin/css/admin.css');
  assert.ok(css.indexOf('Final mobile overrides') > css.lastIndexOf('/* ── Modal'), 'final mobile overrides must follow modal base rules');
  assert.match(css, /max-height:\s*calc\(100dvh/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.availability-layout\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test('mobile workspaces do not retain desktop-only minimum widths', () => {
  const themes = read('frontend/src/pages/ThemeSelector/ThemeSelector.module.css');
  const editor = read('frontend/src/pages/Editor/EditorCanvas.module.css');
  const consoleCss = read('frontend/src/pages/PlatformConsole/PlatformConsole.module.css');
  assert.match(themes, /@media \(max-width: 700px\)[\s\S]*min-width:\s*0/);
  assert.match(editor, /\.mobileModes\s*\{[^}]*display:\s*grid/s);
  assert.match(consoleCss, /\.sidebarOpen\s*\{\s*transform:\s*translateX\(0\)/);
});

test('homepage actions are CSP-safe', () => {
  const home = read('public/index.html');
  assert.doesNotMatch(home, /onclick=/i);
  assert.match(home, /data-scroll-target="showcase"/);
});
