const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('shared tenant modals use dark text on their fixed white surface', () => {
  const css = fs.readFileSync(path.join(__dirname, '../frontend/src/themes/SharedBookingTheme.module.css'), 'utf8');
  assert.match(css, /\.modalCard\s*\{[\s\S]*?--modal-text:\s*#17141c;/);
  assert.match(css, /\.modalCard h2\s*\{[\s\S]*?color:\s*var\(--modal-text\)/);
  assert.match(css, /\.modalLead,[\s\S]*?color:\s*var\(--modal-muted\)/);
  assert.match(css, /\.modalService\s*\{[\s\S]*?color:\s*var\(--modal-text\)/);
  assert.match(css, /\.modalCard \.secondaryButton\s*\{[\s\S]*?color:\s*var\(--modal-text\)/);
});
