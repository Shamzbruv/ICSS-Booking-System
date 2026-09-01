const fs = require('fs');

let css = fs.readFileSync('admin/css/admin.css', 'utf8');

css = css.replace(/background:\s*linear-gradient\(180deg,\s*rgba\(14,\s*18,\s*32,\s*0\.96\),\s*rgba\(15,\s*18,\s*30,\s*0\.88\)\);/g, 'background: var(--surface);');
css = css.replace(/background:\s*rgba\(30,\s*41,\s*59,\s*0\.58\);/g, 'background: rgba(0,0,0,0.4);');
css = css.replace(/background:\s*linear-gradient\(180deg,\s*rgba\(17,\s*20,\s*32,\s*0\.88\),\s*rgba\(17,\s*20,\s*32,\s*0\.72\)\);/g, 'background: var(--surface-2);');
css = css.replace(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.03\);/g, 'background: var(--surface-3);');
css = css.replace(/background:\s*linear-gradient\(135deg,\s*rgba\(255,\s*255,\s*255,\s*0\.04\),\s*rgba\(255,\s*255,\s*255,\s*0\.02\)\);/g, 'background: var(--surface-3);');
css = css.replace(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.08\);/g, 'background: var(--surface-3);');

// Change text color overrides in `.plan-card h3`, etc.
css = css.replace(/color:\s*#fff;/g, 'color: var(--text);');
css = css.replace(/color:\s*#ffffff;/g, 'color: var(--text);');
css = css.replace(/color:\s*#a1a1aa;/g, 'color: var(--text-dim);');
css = css.replace(/color:\s*#8888aa;/g, 'color: var(--text-dim);');
css = css.replace(/color:\s*#000;/g, 'color: white;'); // for buttons that were primary

// Change border rgba
css = css.replace(/border:\s*1px\s+solid\s+rgba\(255,\s*255,\s*255,\s*0\.0[58]\);/g, 'border: 1px solid var(--border);');
css = css.replace(/border-bottom:\s*1px\s+solid\s+rgba\(255,\s*255,\s*255,\s*0\.0[58]\);/g, 'border-bottom: 1px solid var(--border);');
css = css.replace(/border-top:\s*1px\s+solid\s+rgba\(255,\s*255,\s*255,\s*0\.0[58]\);/g, 'border-top: 1px solid var(--border);');

fs.writeFileSync('admin/css/admin.css', css);
console.log('Fixed admin.css');
