const { spawnSync } = require('node:child_process');
const { advisory, packagePath, verifyMitigation } = require('./picomatch-mitigation.cjs');

function blockingFindings(vulnerabilities) {
  function mitigated(name, visited = []) {
    const finding = vulnerabilities[name];
    if (!finding?.via?.length || visited.includes(name)) return false;
    return finding.via.every(cause => {
      if (typeof cause === 'string') return mitigated(cause, [...visited, name]);
      return name === 'picomatch' && cause.name === name && cause.url === advisory
        && cause.severity === 'high' && finding.nodes?.length === 1 && finding.nodes[0] === packagePath;
    });
  }

  return Object.values(vulnerabilities).filter(finding =>
    finding.severity === 'critical' || (finding.severity === 'high' && !mitigated(finding.name))
  );
}

function audit() {
  verifyMitigation();
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'audit', '--json', '--audit-level=high'], {
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
    timeout: 120_000
  });
  const report = JSON.parse(result.stdout || '{}');
  if (![0, 1].includes(result.status) || report.error || !report.vulnerabilities || !report.metadata) {
    throw new Error(result.error?.message || report.error?.summary || result.stderr || 'npm audit failed.');
  }
  console.log(JSON.stringify(report, null, 2));
  const blocking = blockingFindings(report.vulnerabilities);
  if (result.status === 1 && !Object.values(report.vulnerabilities).some(finding => ['high', 'critical'].includes(finding.severity))) {
    throw new Error('npm audit failed without reporting a high or critical finding.');
  }
  if (blocking.length) throw new Error(`Frontend audit failed for: ${blocking.map(finding => finding.name).join(', ')}`);
  if (result.status === 1) console.log(`Verified local mitigation for the build-only picomatch advisory ${advisory}`);
}

if (require.main === module) audit();

module.exports = { blockingFindings };
