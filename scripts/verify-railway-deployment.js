/** Railway's native GitHub integration deploys main; this only verifies it. */
const RAILWAY_CONTEXT = 'ICSS Booking System - ICSS-Booking-System';

async function verifyRailwayDeployment({
    repository = process.env.GITHUB_REPOSITORY,
    sha = process.env.GITHUB_SHA,
    token = process.env.GH_TOKEN,
    fetchStatus = global.fetch,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    attempts = 60,
    pollMs = 5000
} = {}) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^[a-f0-9]{40}$/i.test(sha || '') || !token) {
        throw new Error('GITHUB_REPOSITORY, GITHUB_SHA and GH_TOKEN are required to verify deployment.');
    }
    for (let attempt = 0; attempt < attempts; attempt++) {
        const response = await fetchStatus(`https://api.github.com/repos/${repository}/commits/${sha}/statuses?per_page=100`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' },
            redirect: 'error',
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error(`Cannot read deployment status: GitHub returned HTTP ${response.status}.`);
        // GitHub returns newest statuses first; ignore superseded old entries.
        const status = (await response.json()).find(item => item.context === RAILWAY_CONTEXT);
        if (status?.state === 'success') return status;
        if (status && ['failure', 'error'].includes(status.state)) {
            throw new Error(`Railway deployment failed for ${sha}: ${status.target_url || 'see commit status'}`);
        }
        if (attempt < attempts - 1) await sleep(pollMs);
    }
    throw new Error(`Railway did not confirm deployment of ${sha} within the verification window.`);
}

if (require.main === module) {
    verifyRailwayDeployment()
        .then(status => console.log(`Railway successfully deployed ${process.env.GITHUB_SHA}. ${status.target_url || ''}`))
        .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { verifyRailwayDeployment, RAILWAY_CONTEXT };
