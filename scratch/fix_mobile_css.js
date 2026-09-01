const fs = require('fs');

let css = fs.readFileSync('admin/css/admin.css', 'utf8');

// Fix .table-wrap overflow
css = css.replace(/\.table-wrap \{\n([^\}]+)overflow: hidden;/g, '.table-wrap {\n$1overflow-x: auto;\n    overflow-y: hidden;');

// Fix .main-content min-width
css = css.replace(/\.main-content \{\n    margin-left: var\(--sidebar-w\);\n    flex: 1;/g, '.main-content {\n    margin-left: var(--sidebar-w);\n    flex: 1;\n    min-width: 0;');

// Deduplicate the end of the file if needed
let duplicatedBlock = `/* Final mobile overrides intentionally live after the base modal rules. */
.availability-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
@media (max-width: 700px) {
    html, body { min-height: 100dvh; }
    .sidebar { height: 100dvh; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
    .hamburger { top: calc(14px + env(safe-area-inset-top)); left: calc(14px + env(safe-area-inset-left)); min-width: 44px; min-height: 44px; }
    .main-content { min-height: 100dvh; padding-top: calc(72px + env(safe-area-inset-top)); padding-right: max(16px, env(safe-area-inset-right)); padding-bottom: calc(24px + env(safe-area-inset-bottom)); padding-left: max(16px, env(safe-area-inset-left)); }
    .availability-layout { grid-template-columns: 1fr; gap: 16px; }
    button, .btn, .nav-item, .action-btn, .modal-close { min-height: 44px; }
    input, select, textarea, .form-control { font-size: 16px !important; min-height: 44px; }
    .modal-overlay { align-items: flex-end; padding: 0; }
    .modal { width: 100%; max-width: none; max-height: calc(100dvh - env(safe-area-inset-top)); margin: 0; padding: 22px 18px calc(18px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; }
    .modal-footer { position: sticky; bottom: calc(-18px - env(safe-area-inset-bottom)); flex-direction: column; padding: 12px 0 calc(12px + env(safe-area-inset-bottom)); background: var(--surface); }
    .modal-footer > * { width: 100%; }
}`;

// If it appears twice at the end, replace with a single instance
let matchCount = css.split('/* Final mobile overrides intentionally live after the base modal rules. */').length - 1;
if (matchCount > 1) {
    // Just find the last index and slice it out
    let lastIndex = css.lastIndexOf('/* Final mobile overrides intentionally live after the base modal rules. */');
    css = css.substring(0, lastIndex).trim() + '\n';
}

fs.writeFileSync('admin/css/admin.css', css);
console.log('Fixed mobile layout issues');
