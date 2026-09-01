const fs = require('fs');

let css = fs.readFileSync('admin/css/admin.css', 'utf8');

css = css.replace(/rgba\(14,\s*18,\s*32,\s*0\)/g, 'rgba(255,255,255,0)');
css = css.replace(/rgba\(14,\s*18,\s*32,\s*0\.96\)/g, 'var(--surface)');
css = css.replace(/rgba\(15,\s*19,\s*31,\s*0\.82\)/g, 'var(--surface)');
css = css.replace(/rgba\(15,\s*19,\s*31,\s*0\.95\)/g, 'var(--surface)');
css = css.replace(/rgba\(15,\s*19,\s*31,\s*\.98\)/g, 'var(--surface)');
css = css.replace(/background:\s*linear-gradient\(180deg,\s*var\(--surface\),\s*var\(--surface\)\);/g, 'background: var(--surface);');

fs.writeFileSync('admin/css/admin.css', css);
console.log('Fixed more admin.css dark colors');
