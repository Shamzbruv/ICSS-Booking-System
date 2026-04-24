const fs = require('fs');

function unescapeFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  
  // The file literally contains the string: \`
  // In regex, backslash is \\ and backtick is `
  content = content.replace(/\\`/g, '`');
  
  // The file literally contains: \${
  content = content.replace(/\\\${/g, '${');
  
  fs.writeFileSync(path, content, 'utf8');
  console.log('Cleaned', path);
}

['Template/barber.html', 'Template/mechanic.html'].forEach(unescapeFile);
