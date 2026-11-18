const { test } = require('node:test');
const assert = require('node:assert/strict');
const { blockingFindings } = require('../frontend/scripts/audit-dependencies.cjs');
const { advisory, packagePath } = require('../frontend/scripts/picomatch-mitigation.cjs');

test('frontend audit accepts only the advisory covered by the local picomatch mitigation', () => {
    const picomatch = {
        name: 'picomatch', severity: 'high', nodes: [packagePath],
        via: [{ name: 'picomatch', severity: 'high', url: advisory }]
    };
    const fdir = { name: 'fdir', severity: 'high', via: ['picomatch'] };
    const vite = { name: 'vite', severity: 'high', via: ['fdir', 'picomatch'] };
    const report = { picomatch, fdir, vite };
    assert.deepEqual(blockingFindings(report), []);
    assert.deepEqual(blockingFindings({ ...report, vite: {
        ...vite, via: [...vite.via, { name: 'vite', severity: 'high', url: 'https://example.com/new-advisory' }]
    } }).map(finding => finding.name), ['vite']);
    assert.deepEqual(blockingFindings({ ...report, vite: { ...vite, severity: 'critical' } })
        .map(finding => finding.name), ['vite']);
    assert.deepEqual(blockingFindings({ ...report, picomatch: {
        ...picomatch, nodes: [packagePath, 'node_modules/other-tool/node_modules/picomatch']
    } }).map(finding => finding.name), ['picomatch', 'fdir', 'vite']);
});
