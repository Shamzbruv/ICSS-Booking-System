const { createHash } = require('node:crypto');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const advisory = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const packagePath = 'node_modules/picomatch';
const frontendPath = join(__dirname, '..');
const parser = join(frontendPath, packagePath, 'lib/parse.js');
const before = '4e1e05447668aa1e94366c5516a2bcd8f5fff800cc92b1d0cd7d77703b8618c4';
const after = 'b9924341023d0c01bceffc089469c6e8881d42e22cac690f3c169776f2490ba3';
const digest = contents => createHash('sha256').update(contents).digest('hex');

function verifyMitigation() {
  const { packages } = require('../package-lock.json');
  const copies = Object.keys(packages).filter(path => path.endsWith('/picomatch'));
  const installed = require(join(frontendPath, packagePath, 'package.json'));
  if (copies.length !== 1 || copies[0] !== packagePath || packages[packagePath].dev !== true
      || packages[packagePath].version !== '4.0.7' || installed.version !== '4.0.7'
      || digest(readFileSync(parser)) !== after) {
    throw new Error(`Cannot verify the local picomatch mitigation for ${advisory}.`);
  }
}

if (require.main === module && (process.env.NODE_ENV !== 'production' || existsSync(parser))) {
  const source = readFileSync(parser, 'utf8');
  if (digest(source) === before) {
    // For repeated extglobs, use the parser's existing safe flattening or
    // literal fallback. Remove this mitigation when a fixed release is available.
    const mitigated = source.replace(
      "if ((token.type === 'plus' || token.type === 'star') && analysis.risky) {",
      "if (token.type === 'plus' || token.type === 'star') {"
    );
    if (digest(mitigated) === after) writeFileSync(parser, mitigated);
  }
  verifyMitigation();
}

module.exports = { advisory, packagePath, verifyMitigation };
