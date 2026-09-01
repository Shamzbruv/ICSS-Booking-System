const fs = require('fs');

let css = fs.readFileSync('admin/css/admin.css', 'utf8');

// Fix the settings card layout and drop shadows for the light theme
css = css.replace(/border: 1px solid rgba\(255, 255, 255, 0\.09\);/g, 'border: 1px solid var(--border);');
css = css.replace(/box-shadow: 0 24px 60px rgba\(6, 10, 22, 0\.22\);/g, 'box-shadow: var(--shadow-sm);');
css = css.replace(/radial-gradient\(circle at top right, rgba\(99, 102, 241, 0\.12\), transparent 32%\)/g, 'radial-gradient(circle at top right, var(--primary-glow), transparent 32%)');
css = css.replace(/radial-gradient\(circle at bottom left, rgba\(236, 72, 153, 0\.07\), transparent 28%\)/g, 'transparent');

// Fix dark background in .dashboard-body and .admin-layout that I might have missed
css = css.replace(/color: #a5b4fc;/g, 'color: var(--primary);'); 
css = css.replace(/color: #bfdbfe;/g, 'color: var(--info);');
css = css.replace(/background: rgba\(0,0,0,0\.4\);/g, 'background: var(--surface-2);'); 

fs.writeFileSync('admin/css/admin.css', css);
console.log('Fixed settings card css');
