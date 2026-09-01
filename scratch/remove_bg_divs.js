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

// Remove the global backgrounds completely from all admin html files
walkSync('admin', function(filePath) {
    if (filePath.endsWith('.html')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        if (content.includes('<div class="gradient-bg"></div>')) {
            content = content.replace(/<!-- Global Backgrounds -->\s*<div class="gradient-bg"><\/div>/g, '');
            content = content.replace(/<div class="gradient-bg"><\/div>/g, '');
            modified = true;
        }

        if (content.includes('<div class="grid-pattern"></div>')) {
            content = content.replace(/<div class="grid-pattern"><\/div>/g, '');
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log('Removed global background divs from', filePath);
        }
    }
});
