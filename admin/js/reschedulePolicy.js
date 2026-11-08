/* Settings → Rescheduling & cancellations */
(function initReschedulePolicy() {
    'use strict';
    const form = document.getElementById('reschedulePolicyForm');
    if (!form || typeof apiFetch !== 'function') return;
    const slug = getTenantSlug();
    const bools = ['allowClientReschedule', 'allowClientCancel', 'requireApproval', 'reasonRequired'];
    const nums = ['cutoffHours', 'maxReschedules'];
    const field = (key) => document.getElementById(`rp_${key}`);

    function read() {
        const policy = {};
        bools.forEach((key) => { policy[key] = field(key).checked; });
        nums.forEach((key) => { policy[key] = Number(field(key).value || 0); });
        return policy;
    }

    function summarise() {
        const p = read();
        const parts = [];
        if (!p.allowClientReschedule && !p.allowClientCancel) parts.push('Clients will see your contact details and be asked to get in touch to make changes.');
        else {
            const can = [p.allowClientReschedule && 'reschedule', p.allowClientCancel && 'cancel'].filter(Boolean).join(' or ');
            parts.push(`Clients can ${can} online until ${p.cutoffHours} hour${p.cutoffHours === 1 ? '' : 's'} before their appointment.`);
            if (p.allowClientReschedule) parts.push(`Up to ${p.maxReschedules} reschedule${p.maxReschedules === 1 ? '' : 's'} per booking${p.requireApproval ? ', each approved by you' : ''}.`);
        }
        document.getElementById('rp_summary').textContent = parts.join(' ');
        field('maxReschedules').disabled = !p.allowClientReschedule;
        field('requireApproval').disabled = !p.allowClientReschedule;
    }

    async function load() {
        try {
            const { policy } = await apiFetch(`/api/v1/tenants/${encodeURIComponent(slug)}/reschedule-policy`);
            bools.forEach((key) => { field(key).checked = Boolean(policy[key]); });
            nums.forEach((key) => { field(key).value = policy[key]; });
            summarise();
        } catch (err) {
            document.getElementById('rp_summary').textContent = err.message;
        }
    }

    form.addEventListener('input', summarise);
    form.addEventListener('change', summarise);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type=submit]');
        button.disabled = true;
        try {
            const { policy } = await apiFetch(`/api/v1/tenants/${encodeURIComponent(slug)}/reschedule-policy`, { method: 'PUT', body: { policy: read() } });
            nums.forEach((key) => { field(key).value = policy[key]; });
            summarise();
            showToast('Rescheduling rules saved.');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            button.disabled = false;
        }
    });
    load();
})();
