const TERMS_VERSION = '2026-05-05';
const THEME_CACHE_KEY = 'icss_theme_catalog_v1';
const THEME_CACHE_TTL = 15 * 60 * 1000;
const DRAFT_KEY = 'icss_platform_setup_draft_v1';
const STEP_ONE_FIELD_IDS = [
    'tenantName',
    'ownerName',
    'tenantPhone',
    'companySize',
    'adminEmail',
    'adminPassword',
    'confirmPassword'
];

let state = {
    themes: [],
    selectedThemeId: null,
    signupToken: null,
    paypalPlanId: null,
    paypalClientId: null,
    preparedCheckoutSignature: null,
    themesLoadedFromCache: false,
    themesLoading: true
};

document.addEventListener('DOMContentLoaded', () => {
    restoreDraft();
    bindStepOneValidation();
    bindPreviewModal();
    renderThemeSkeletons();
    loadThemes();
    syncTermsAcceptanceState();
    updateStepOneButtonState();
});

function $(id) {
    return document.getElementById(id);
}

function goToStep(step) {
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.step').forEach(indicator => indicator.classList.remove('active'));

    const panel = $(`step${step}`);
    if (panel) panel.classList.add('active');

    for (let i = 1; i <= step; i += 1) {
        $(`stepIndicator${i}`)?.classList.add('active');
    }

    window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        panel?.querySelector('input, select, button')?.focus({ preventScroll: true });
    });
}

function bindPreviewModal() {
    $('previewModal')?.addEventListener('click', (event) => {
        if (event.target === $('previewModal')) closePreview();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && $('previewModal')?.classList.contains('active')) {
            closePreview();
        }
    });
}

function bindStepOneValidation() {
    STEP_ONE_FIELD_IDS.forEach((fieldId) => {
        const field = $(fieldId);
        if (!field) return;

        const eventName = field.tagName === 'SELECT' ? 'change' : 'input';

        field.addEventListener(eventName, () => {
            invalidatePreparedCheckout();
            saveDraft();
            if (field.dataset.touched === 'true') {
                updateFieldFeedback(fieldId, { reveal: true });
            } else {
                updateFieldFeedback(fieldId, { reveal: false });
            }

            if (fieldId === 'adminPassword' || fieldId === 'confirmPassword') {
                updateFieldFeedback('adminPassword', { reveal: $('adminPassword')?.dataset.touched === 'true' });
                updateFieldFeedback('confirmPassword', { reveal: $('confirmPassword')?.dataset.touched === 'true' });
            }

            clearError(1);
            updateStepOneButtonState();
        });

        field.addEventListener('blur', () => {
            field.dataset.touched = 'true';
            updateFieldFeedback(fieldId, { reveal: true });
            if (fieldId === 'adminPassword' || fieldId === 'confirmPassword') {
                updateFieldFeedback('adminPassword', { reveal: true });
                updateFieldFeedback('confirmPassword', { reveal: true });
            }
            updateStepOneButtonState();
        });
    });

    $('acceptTerms')?.addEventListener('change', () => {
        invalidatePreparedCheckout();
        saveDraft();
        clearError(2);
        syncTermsAcceptanceState();
    });
}

function getStepOneValues() {
    return {
        tenantName: $('tenantName')?.value.trim() || '',
        ownerName: $('ownerName')?.value.trim() || '',
        tenantPhone: $('tenantPhone')?.value.trim() || '',
        companySize: $('companySize')?.value || '',
        adminEmail: $('adminEmail')?.value.trim() || '',
        adminPassword: $('adminPassword')?.value || '',
        confirmPassword: $('confirmPassword')?.value || ''
    };
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 7;
}

function getFieldError(fieldId, values = getStepOneValues()) {
    switch (fieldId) {
        case 'tenantName':
            return values.tenantName ? '' : 'Enter your business name before continuing.';
        case 'ownerName':
            return values.ownerName ? '' : 'Enter the owner\'s full name.';
        case 'tenantPhone':
            if (!values.tenantPhone) return 'Enter a phone number.';
            return validatePhone(values.tenantPhone) ? '' : 'Enter a valid phone number.';
        case 'companySize':
            return values.companySize ? '' : 'Choose your company size.';
        case 'adminEmail':
            if (!values.adminEmail) return 'Enter the owner\'s email address.';
            return validateEmail(values.adminEmail) ? '' : 'Enter a valid email address.';
        case 'adminPassword':
            if (!values.adminPassword) return 'Create a password for the owner account.';
            return values.adminPassword.length >= 8 ? '' : 'Password must be at least 8 characters.';
        case 'confirmPassword':
            if (!values.confirmPassword) return 'Confirm the password to continue.';
            return values.confirmPassword === values.adminPassword ? '' : 'Passwords do not match.';
        default:
            return '';
    }
}

function hasFieldValue(field) {
    if (!field) return false;
    return field.tagName === 'SELECT' ? Boolean(field.value) : Boolean(field.value.trim());
}

function setFieldMessage(fieldId, message) {
    const field = $(fieldId);
    const group = field?.closest('.form-group');
    if (!field || !group) return;

    let errorNode = group.querySelector('.field-error');

    if (message) {
        if (!errorNode) {
            errorNode = document.createElement('div');
            errorNode.className = 'field-error';
            group.appendChild(errorNode);
        }
        errorNode.textContent = message;
        group.classList.add('has-error');
        group.classList.remove('is-valid');
        field.setAttribute('aria-invalid', 'true');
        return;
    }

    if (errorNode) errorNode.remove();
    group.classList.remove('has-error');
    field.removeAttribute('aria-invalid');

    if (hasFieldValue(field)) {
        group.classList.add('is-valid');
    } else {
        group.classList.remove('is-valid');
    }
}

function updateFieldFeedback(fieldId, { reveal = false } = {}) {
    const field = $(fieldId);
    if (!field) return '';

    const error = getFieldError(fieldId);
    const shouldReveal = reveal || field.dataset.touched === 'true';

    if (error && shouldReveal) {
        setFieldMessage(fieldId, error);
    } else if (!error) {
        setFieldMessage(fieldId, '');
    }

    return error;
}

function isStepOneReady(values = getStepOneValues()) {
    return STEP_ONE_FIELD_IDS.every((fieldId) => !getFieldError(fieldId, values));
}

function updateStepOneButtonState() {
    const button = $('stepOneNextBtn');
    if (!button) return;

    const ready = isStepOneReady();
    button.disabled = !ready;
    button.title = ready ? '' : 'Complete every field and confirm the password to continue.';
}

function validateStepOne({ revealErrors = false, focusFirstInvalid = false } = {}) {
    const values = getStepOneValues();
    let firstInvalidField = null;

    STEP_ONE_FIELD_IDS.forEach((fieldId) => {
        if (revealErrors) {
            $(fieldId).dataset.touched = 'true';
        }

        const error = getFieldError(fieldId, values);
        const shouldReveal = revealErrors || $(fieldId)?.dataset.touched === 'true';

        if (error && shouldReveal) {
            setFieldMessage(fieldId, error);
        } else if (!error) {
            setFieldMessage(fieldId, '');
        }

        if (!firstInvalidField && error) {
            firstInvalidField = fieldId;
        }
    });

    if (firstInvalidField && focusFirstInvalid) {
        $(firstInvalidField)?.focus();
    }

    updateStepOneButtonState();

    return { valid: !firstInvalidField, values, firstInvalidField };
}

function handleStepOneNext() {
    clearError(1);
    const result = validateStepOne({ revealErrors: true, focusFirstInvalid: true });

    if (!result.valid) {
        showError(1, 'Please complete the highlighted fields before continuing.');
        return;
    }

    saveDraft();
    goToStep(2);
}

function showError(step, message) {
    const errorBox = $(`error${step}`);
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.style.display = message ? 'block' : 'none';
}

function clearError(step) {
    showError(step, '');
}

function saveDraft() {
    try {
        const draft = {
            tenantName: $('tenantName')?.value || '',
            ownerName: $('ownerName')?.value || '',
            tenantPhone: $('tenantPhone')?.value || '',
            companySize: $('companySize')?.value || '',
            adminEmail: $('adminEmail')?.value || '',
            selectedThemeId: state.selectedThemeId || '',
            acceptTerms: Boolean($('acceptTerms')?.checked)
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (error) {
        console.warn('Unable to save setup draft.', error);
    }
}

function restoreDraft() {
    try {
        const saved = sessionStorage.getItem(DRAFT_KEY);
        if (!saved) return;

        const draft = JSON.parse(saved);
        if ($('tenantName')) $('tenantName').value = draft.tenantName || '';
        if ($('ownerName')) $('ownerName').value = draft.ownerName || '';
        if ($('tenantPhone')) $('tenantPhone').value = draft.tenantPhone || '';
        if ($('companySize')) $('companySize').value = draft.companySize || '';
        if ($('adminEmail')) $('adminEmail').value = draft.adminEmail || '';
        if ($('acceptTerms')) $('acceptTerms').checked = Boolean(draft.acceptTerms);
        state.selectedThemeId = draft.selectedThemeId || null;
    } catch (error) {
        console.warn('Unable to restore setup draft.', error);
    }
}

function clearDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
}

function invalidatePreparedCheckout() {
    state.signupToken = null;
    state.paypalPlanId = null;
    state.paypalClientId = null;
    state.preparedCheckoutSignature = null;
    clearError(3);
    setCheckoutLoading(false);

    const paypalContainer = $('paypal-button-container');
    if (paypalContainer) {
        paypalContainer.innerHTML = '';
    }
}

function readThemeCache() {
    try {
        const raw = localStorage.getItem(THEME_CACHE_KEY);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        if (!cached.cachedAt || !Array.isArray(cached.themes)) return null;
        if (Date.now() - cached.cachedAt > THEME_CACHE_TTL) return null;
        return cached.themes;
    } catch {
        return null;
    }
}

function writeThemeCache(themes) {
    try {
        localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({
            cachedAt: Date.now(),
            themes
        }));
    } catch (error) {
        console.warn('Unable to cache themes.', error);
    }
}

function renderThemeSkeletons() {
    const grid = $('themesGrid');
    if (!grid) return;

    grid.innerHTML = Array.from({ length: 6 }).map(() => `
        <div class="theme-skeleton" aria-hidden="true">
            <div class="theme-skeleton__media"></div>
            <div class="theme-skeleton__body">
                <div class="theme-skeleton__line"></div>
                <div class="theme-skeleton__line theme-skeleton__line--short"></div>
            </div>
        </div>
    `).join('');

    updateThemesStatus('Loading starter kits…');
}

function renderThemeEmpty(message) {
    const grid = $('themesGrid');
    if (!grid) return;

    grid.innerHTML = `<div class="theme-empty" style="grid-column: 1 / -1;">${message}</div>`;
}

function updateThemesStatus(message) {
    const status = $('themesStatus');
    if (status) status.textContent = message;
}

function getThemeAccent(category = '') {
    const key = category.toLowerCase();
    if (key.includes('barber')) return '#f59e0b';
    if (key.includes('events')) return '#38bdf8';
    if (key.includes('fitness')) return '#22c55e';
    if (key.includes('legal')) return '#60a5fa';
    if (key.includes('hair')) return '#fb7185';
    if (key.includes('medical')) return '#2dd4bf';
    if (key.includes('nail')) return '#f472b6';
    if (key.includes('photo')) return '#c084fc';
    if (key.includes('spa')) return '#34d399';
    if (key.includes('mechanic')) return '#fb923c';
    return '#818cf8';
}

function getThemeInitials(name = '') {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('');
}

async function loadThemes() {
    const cachedThemes = readThemeCache();

    if (cachedThemes?.length) {
        state.themes = cachedThemes;
        state.themesLoadedFromCache = true;
        state.themesLoading = false;
        renderThemes();
        updateThemesStatus('Showing saved starter kits while we refresh the latest options…');
    }

    try {
        const response = await fetch('/api/v1/themes', { cache: 'force-cache' });
        if (!response.ok) throw new Error('Failed to load starter kits.');

        const data = await response.json();
        state.themes = Array.isArray(data.themes) ? data.themes : [];
        state.themesLoadedFromCache = false;
        state.themesLoading = false;
        writeThemeCache(state.themes);
        renderThemes();
    } catch (error) {
        console.error('Failed to load themes', error);
        state.themesLoading = false;

        if (!state.themes.length) {
            renderThemeEmpty('We could not load starter kits right now. Refresh the page and try again.');
            updateThemesStatus('Starter kits are temporarily unavailable.');
        } else {
            updateThemesStatus('Showing saved starter kits while live previews catch up.');
        }
    }
}

function renderThemes() {
    const grid = $('themesGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!state.themes.length) {
        renderThemeEmpty('No starter kits are available yet.');
        updateThemesStatus('Starter kits will appear here once they are available.');
        return;
    }

    if (state.selectedThemeId && !state.themes.some((theme) => theme.id === state.selectedThemeId)) {
        state.selectedThemeId = null;
        saveDraft();
    }

    state.themes.forEach((theme) => {
        const card = document.createElement('div');
        const selected = state.selectedThemeId === theme.id;
        card.className = `theme-card${selected ? ' selected' : ''}`;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-pressed', selected ? 'true' : 'false');

        const previewBox = document.createElement('div');
        previewBox.className = `theme-preview-box${theme.preview_image_url ? '' : ' theme-preview-box--placeholder'}`;

        if (theme.preview_image_url) {
            const image = document.createElement('img');
            image.src = theme.preview_image_url;
            image.alt = `${theme.name} preview`;
            image.loading = 'lazy';
            image.decoding = 'async';
            previewBox.appendChild(image);
        } else {
            previewBox.style.background = `
                radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 34%),
                linear-gradient(135deg, ${getThemeAccent(theme.category)}55, rgba(15, 23, 42, 0.96))
            `;

            const previewContent = document.createElement('div');
            previewContent.className = 'theme-preview-content';

            const chip = document.createElement('div');
            chip.className = 'theme-preview-chip';
            chip.textContent = theme.category || 'Starter kit';

            const initials = document.createElement('div');
            initials.className = 'theme-preview-initials';
            initials.textContent = getThemeInitials(theme.name || 'ICSS');

            const caption = document.createElement('div');
            caption.className = 'theme-preview-caption';
            caption.textContent = 'Fast-loading preview card. Open the full live preview only when you want a closer look.';

            previewContent.appendChild(chip);
            previewContent.appendChild(initials);
            previewContent.appendChild(caption);
            previewBox.appendChild(previewContent);
        }

        const previewButton = document.createElement('button');
        previewButton.type = 'button';
        previewButton.className = 'preview-action';
        previewButton.textContent = theme.template_path ? 'Preview' : 'Details';
        previewButton.addEventListener('click', (event) => {
            event.stopPropagation();
            previewTheme(theme.id);
        });
        previewBox.appendChild(previewButton);

        const info = document.createElement('div');
        info.className = 'theme-info';

        const name = document.createElement('div');
        name.className = 'theme-name';
        name.textContent = theme.name;

        const category = document.createElement('div');
        category.className = 'theme-category';
        category.textContent = theme.category || 'General';

        const stateLine = document.createElement('div');
        stateLine.className = 'theme-state';
        stateLine.textContent = selected
            ? 'Selected starter kit. Ready to continue.'
            : 'Select this kit or open the full preview first.';

        info.appendChild(name);
        info.appendChild(category);
        info.appendChild(stateLine);

        card.appendChild(previewBox);
        card.appendChild(info);

        card.addEventListener('click', () => selectTheme(theme.id));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectTheme(theme.id);
            }
        });

        grid.appendChild(card);
    });

    const selectedTheme = state.themes.find((theme) => theme.id === state.selectedThemeId);
    if (selectedTheme) {
        updateThemesStatus(`Starter kit selected: ${selectedTheme.name}. You can continue whenever you are ready.`);
    } else if (state.themesLoadedFromCache) {
        updateThemesStatus('Showing saved starter kits while we refresh the latest options…');
    } else {
        updateThemesStatus(`${state.themes.length} starter kits ready. Select one to continue.`);
    }

    syncTermsAcceptanceState();
}

function selectTheme(id) {
    state.selectedThemeId = id;
    invalidatePreparedCheckout();
    clearError(2);
    saveDraft();
    renderThemes();
}

function previewTheme(id) {
    const theme = state.themes.find((entry) => entry.id === id);
    if (!theme) return;

    if (!theme.template_path) {
        showError(2, 'This theme preview is not available yet. Please choose another starter kit.');
        return;
    }

    $('previewTitle').textContent = `Preview: ${theme.name}`;
    $('previewIframe').src = theme.template_path;
    $('previewModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    $('selectPreviewBtn').onclick = () => {
        selectTheme(id);
        closePreview();
    };
}

function closePreview() {
    $('previewModal')?.classList.remove('active');
    $('previewIframe').src = '';
    document.body.style.overflow = '';
}

function syncTermsAcceptanceState() {
    const checkbox = $('acceptTerms');
    const button = $('finalizeDraftBtn');
    if (!checkbox || !button) return;
    const hasSelectedTheme = state.themes.some((theme) => theme.id === state.selectedThemeId);

    if (button.dataset.loading === 'true') {
        button.disabled = true;
        return;
    }

    button.disabled = !checkbox.checked || !hasSelectedTheme;
}

function setFinalizeButtonLoading(loading) {
    const button = $('finalizeDraftBtn');
    if (!button) return;
    const hasSelectedTheme = state.themes.some((theme) => theme.id === state.selectedThemeId);

    button.dataset.loading = loading ? 'true' : 'false';
    button.textContent = loading ? 'Preparing Checkout…' : 'Next: Finalize & Subscribe';
    button.disabled = loading || !$('acceptTerms')?.checked || !hasSelectedTheme;
}

function setCheckoutLoading(loading, message = 'Preparing your secure checkout…') {
    const loader = $('checkoutLoader');
    const loaderText = $('checkoutLoaderText');
    const paypalContainer = $('paypal-button-container');

    if (loaderText) loaderText.textContent = message;
    loader?.classList.toggle('active', loading);

    if (paypalContainer && loading) {
        paypalContainer.innerHTML = '';
    }
}

function getCheckoutSignature(values, termsAccepted) {
    return JSON.stringify({
        tenantName: values.tenantName,
        ownerName: values.ownerName,
        tenantPhone: values.tenantPhone,
        companySize: values.companySize,
        adminEmail: values.adminEmail,
        adminPassword: values.adminPassword,
        themeId: state.selectedThemeId,
        termsAccepted
    });
}

async function finalizeDraft() {
    clearError(2);
    clearError(3);

    const { valid, values } = validateStepOne({ revealErrors: true, focusFirstInvalid: true });
    if (!valid) {
        goToStep(1);
        showError(1, 'Please complete the highlighted fields before continuing.');
        return;
    }

    if (!state.selectedThemeId) {
        showError(2, 'Please select an industry starter kit.');
        return;
    }

    const termsAccepted = Boolean($('acceptTerms')?.checked);
    if (!termsAccepted) {
        showError(2, 'You must accept the Terms & Conditions before continuing.');
        return;
    }

    const checkoutSignature = getCheckoutSignature(values, termsAccepted);
    if (
        state.signupToken &&
        state.paypalPlanId &&
        state.preparedCheckoutSignature === checkoutSignature &&
        $('paypal-button-container')?.children.length
    ) {
        clearError(3);
        setCheckoutLoading(false);
        goToStep(3);
        return;
    }

    setFinalizeButtonLoading(true);
    setCheckoutLoading(true, 'Preparing your secure checkout…');
    saveDraft();
    goToStep(3);

    try {
        const response = await fetch('/api/v1/payments/paypal/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenant_name: values.tenantName,
                admin_owner_name: values.ownerName,
                admin_email: values.adminEmail,
                admin_password: values.adminPassword,
                theme_id: state.selectedThemeId,
                plan_id: 'starter',
                phone: values.tenantPhone,
                company_size: values.companySize,
                terms_accepted: termsAccepted,
                terms_version: TERMS_VERSION
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to initialize setup.');
        }

        state.signupToken = data.signup_token;
        state.paypalPlanId = data.paypal_plan_id;
        state.paypalClientId = data.paypal_client_id;
        state.preparedCheckoutSignature = checkoutSignature;
        localStorage.setItem('icss_signup_email', values.adminEmail);

        setCheckoutLoading(true, 'Loading PayPal securely…');
        await loadPayPalSDK(state.paypalClientId);

        setCheckoutLoading(true, 'Finalizing secure checkout…');
        await renderPayPalButtons();

        setCheckoutLoading(false);
        setFinalizeButtonLoading(false);
        syncTermsAcceptanceState();
    } catch (error) {
        state.preparedCheckoutSignature = null;
        setCheckoutLoading(false);
        setFinalizeButtonLoading(false);
        showError(3, error.message);
    }
}

function loadPayPalSDK(clientId) {
    return new Promise((resolve, reject) => {
        const existing = $('paypal-sdk-script');

        if (window.paypal && existing?.dataset.clientId === clientId) {
            resolve();
            return;
        }

        if (existing) existing.remove();

        const script = document.createElement('script');
        script.id = 'paypal-sdk-script';
        script.dataset.clientId = clientId;
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription`;
        script.dataset.sdkIntegrationSource = 'button-factory';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load PayPal. Please refresh and try again.'));
        document.body.appendChild(script);
    });
}

async function renderPayPalButtons() {
    const containerId = 'paypal-button-container';
    const container = $(containerId);

    if (!container) throw new Error('PayPal checkout container not found.');
    if (!state.paypalPlanId) throw new Error('PayPal trial plan is not configured.');

    container.innerHTML = '';

    return paypal.Buttons({
        style: {
            shape: 'rect',
            color: 'blue',
            layout: 'vertical',
            label: 'subscribe'
        },
        createSubscription(_data, actions) {
            return actions.subscription.create({
                plan_id: state.paypalPlanId,
                custom_id: state.signupToken
            });
        },
        onApprove: async (data) => {
            try {
                const response = await fetch('/api/v1/payments/paypal/approve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        signup_token: state.signupToken,
                        subscription_id: data.subscriptionID
                    })
                });

                if (!response.ok) {
                    throw new Error('Manual provisioning trigger failed.');
                }
            } catch (error) {
                console.warn('Manual provisioning trigger failed, relying on webhook.', error);
            }

            clearDraft();
            localStorage.setItem('icss_signup_token', state.signupToken);
            window.location.href = '/provisioning';
        },
        onError() {
            setCheckoutLoading(false);
            showError(3, 'PayPal checkout encountered an error. Please try again.');
        }
    }).render(`#${containerId}`);
}
