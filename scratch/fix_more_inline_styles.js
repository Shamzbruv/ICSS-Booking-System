const fs = require('fs');
const path = require('path');

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory()) {
            walkSync(filePath, callback);
        }
    });
}

walkSync('admin', function(filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Date input fields
        if (content.includes('color: white')) {
            content = content.replace(/color:\s*white/g, 'color: var(--text)');
            modified = true;
        }
        if (content.includes('color-scheme: dark')) {
            content = content.replace(/color-scheme:\s*dark/g, 'color-scheme: light');
            modified = true;
        }
        
        // rgba backgrounds and borders
        if (content.match(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,[^)]+\)/)) {
            content = content.replace(/background:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.0[34]\s*\)/g, 'background: var(--surface-2)');
            content = content.replace(/border:\s*1px\s+solid\s+rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*\.05\s*\)/g, 'border: 1px solid var(--border)');
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log('Fixed inline styles in', filePath);
        }
    }
});
