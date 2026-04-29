const fs = require('fs');
const path = require('path');

const templateDir = path.join(__dirname, '../../Template');
const themesDir = path.join(__dirname, '../../frontend/src/themes');
const files = fs.readdirSync(templateDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const content = fs.readFileSync(path.join(templateDir, file), 'utf-8');
    const name = file.replace('.html', '');
    const ThemeName = 'Theme' + name.charAt(0).toUpperCase() + name.slice(1).replace(/_./g, x => x[1].toUpperCase());

    // Extract CSS
    const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/i);
    let css = styleMatch ? styleMatch[1] : '';
    // Scope CSS
    css = css.replace(/body\s*\{/g, `.${ThemeName}Body {`)
             .replace(/\*\s*\{/g, `.${ThemeName}Wrapper * {`);
             
    fs.writeFileSync(path.join(themesDir, `${ThemeName}.module.css`), css);

    // Extract Body
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<script>/i);
    let html = bodyMatch ? bodyMatch[1] : '';

    const component = `import React from 'react';
import styles from './${ThemeName}.module.css';

export default function ${ThemeName}({ tenant, services, onBook }) {
    return (
        <div className={styles.${ThemeName}Wrapper}>
            <div className={styles.${ThemeName}Body} dangerouslySetInnerHTML={{ __html: \`
${html.replace(/`/g, '\\`').replace(/\$/g, '\\$')}
            \`}} />
        </div>
    );
}
`;
    fs.writeFileSync(path.join(themesDir, `${ThemeName}.jsx`), component);
    console.log(`Generated ${ThemeName}`);
});
