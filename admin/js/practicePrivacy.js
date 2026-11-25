function showPracticePrivacy(themeKey, { applied = false } = {}) {
    const panel = document.getElementById('practicePrivacy');
    if (!panel) return;
    if (themeKey !== 'health') {
        panel.hidden = true;
        return;
    }

    const openPatients = panel.querySelector('[data-patients-link]');
    const accessNote = panel.querySelector('[data-patient-access]');
    openPatients.hidden = !canOpenPatients();
    accessNote.hidden = canOpenPatients();
    panel.querySelector('[data-public-booking-link]').href = '/' + encodeURIComponent(getTenantSlug()) + '/book';
    panel.querySelector('[data-practice-status]').textContent = applied ? 'Medical template applied' : 'Medical template active';
    panel.hidden = false;
}

async function loadPracticePrivacy() {
    try {
        const slug = encodeURIComponent(getTenantSlug());
        const info = await apiFetch('/api/v1/tenants/' + slug + '/theme');
        showPracticePrivacy(info.theme_key);
        return info;
    } catch (error) {
        if (error.status !== 403) console.warn('Could not load the practice template:', error.message);
        return null;
    }
}
