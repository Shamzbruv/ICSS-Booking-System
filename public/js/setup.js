let state = {
    themes: [],
    selectedThemeId: null,
    signupToken: null,
    paypalPlanId: null,
    paypalClientId: null
};
const TERMS_VERSION = '2026-05-05';

document.addEventListener('DOMContentLoaded', () => {
    loadThemes();
    syncTermsAcceptanceState();
});

function goToStep(step) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    
    document.getElementById(`step${step}`).classList.add('active');
    
    for (let i = 1; i <= step; i++) {
        document.getElementById(`stepIndicator${i}`).classList.add('active');
    }
}

async function loadThemes() {
    try {
        const res = await fetch('/api/v1/themes');
        const data = await res.json();
        state.themes = data.themes || [];
        renderThemes();
    } catch (e) {
        console.error('Failed to load themes', e);
    }
}

function renderThemes() {
    const grid = document.getElementById('themesGrid');
    grid.innerHTML = '';

    state.themes.forEach(theme => {
        const card = document.createElement('div');
        card.className = 'theme-card';
        if (state.selectedThemeId === theme.id) card.classList.add('selected');

        let previewHtml = '';
        if (theme.template_path) {
            previewHtml = `
                <div class="theme-preview-box" style="position: relative; overflow: hidden; background: #fff;">
                    <iframe src="${theme.template_path}" 
                            style="position: absolute; top: 0; left: 0; width: 400%; height: 400%; transform: scale(0.25); transform-origin: top left; border: none; pointer-events: none;" 
                            tabindex="-1" loading="lazy"></iframe>
                    <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.02); z-index: 10;"></div>
                    <button class="preview-action" style="position: absolute; z-index: 20;" onclick="event.stopPropagation(); previewTheme('${theme.id}')">Preview</button>
                </div>
            `;
        } else {
            previewHtml = `
                <div class="theme-preview-box" style="background: rgba(255, 255, 255, 0.05); color: #6366f1;">
                    <i class="fas fa-image" style="font-size: 2.5rem;"></i>
                    <button class="preview-action" onclick="event.stopPropagation(); previewTheme('${theme.id}')">Preview</button>
                </div>
            `;
        }

        card.innerHTML = `
            ${previewHtml}
            <div class="theme-info">
                <div class="theme-name">${theme.name}</div>
                <div class="theme-category">${theme.category}</div>
            </div>
        `;
        
        card.onclick = () => selectTheme(theme.id);
        grid.appendChild(card);
    });
}

function selectTheme(id) {
    state.selectedThemeId = id;
    renderThemes();
}

function previewTheme(id) {
    const theme = state.themes.find(t => t.id === id);
    if (!theme) return;
    
    document.getElementById('previewTitle').textContent = `Preview: ${theme.name}`;
    document.getElementById('previewIframe').src = theme.template_path;
    document.getElementById('previewModal').classList.add('active');

    document.getElementById('selectPreviewBtn').onclick = () => {
        selectTheme(id);
        closePreview();
    };
}

function closePreview() {
    document.getElementById('previewModal').classList.remove('active');
    document.getElementById('previewIframe').src = '';
}

function syncTermsAcceptanceState() {
    const checkbox = document.getElementById('acceptTerms');
    const button = document.getElementById('finalizeDraftBtn');
    if (!checkbox || !button) return;
    if (button.dataset.loading === 'true') return;
    button.disabled = !checkbox.checked;
}

async function finalizeDraft() {
    const name        = document.getElementById('tenantName').value.trim();
    const ownerName   = document.getElementById('ownerName').value.trim();
    const email       = document.getElementById('adminEmail').value.trim();
    const pwd         = document.getElementById('adminPassword').value;
    const confirmPwd  = document.getElementById('confirmPassword').value;
    const phone       = document.getElementById('tenantPhone').value.trim();
    const companySize = document.getElementById('companySize').value;
    const termsAccepted = Boolean(document.getElementById('acceptTerms')?.checked);
    
    if (!name || !ownerName || !email || !pwd || !phone || !companySize) {
        goToStep(1);
        const err = document.getElementById('error1');
        err.textContent = 'All fields are required.';
        err.style.display = 'block';
        return;
    }

    if (pwd !== confirmPwd) {
        goToStep(1);
        const err = document.getElementById('error1');
        err.textContent = 'Passwords do not match.';
        err.style.display = 'block';
        return;
    }
    
    if (!state.selectedThemeId) {
        const err = document.getElementById('error2');
        err.textContent = 'Please select an industry starter kit.';
        err.style.display = 'block';
        return;
    }

    if (!termsAccepted) {
        const err = document.getElementById('error2');
        err.textContent = 'You must accept the Terms & Conditions before continuing.';
        err.style.display = 'block';
        return;
    }

    document.getElementById('finalizeDraftBtn').disabled = true;
    document.getElementById('finalizeDraftBtn').dataset.loading = 'true';
    document.getElementById('finalizeDraftBtn').textContent = 'Setting up...';

    try {
        const res = await fetch('/api/v1/payments/paypal/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenant_name:      name,
                admin_owner_name: ownerName,
                admin_email:      email,
                admin_password:   pwd,
                theme_id:         state.selectedThemeId,
                plan_id:          'starter',
                phone:            phone,
                company_size:     companySize,
                terms_accepted:   termsAccepted,
                terms_version:    TERMS_VERSION
            })
        });

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Failed to initialize setup.');
        }

        state.signupToken = data.signup_token;
        state.paypalPlanId = data.paypal_plan_id;
        state.paypalClientId = data.paypal_client_id;
        localStorage.setItem('icss_signup_email', email);

        await loadPayPalSDK(state.paypalClientId);
        await renderPayPalButtons();

        goToStep(3);

    } catch (e) {
        document.getElementById('finalizeDraftBtn').dataset.loading = 'false';
        document.getElementById('finalizeDraftBtn').textContent = 'Next: Finalize & Subscribe';
        syncTermsAcceptanceState();
        const err = document.getElementById('error2');
        err.textContent = e.message;
        err.style.display = 'block';
    }
}

function loadPayPalSDK(clientId) {
    return new Promise((resolve, reject) => {
        const existing = document.getElementById('paypal-sdk-script');

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
    const container = document.getElementById(containerId);
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
            createSubscription: function(data, actions) {
                return actions.subscription.create({
                    plan_id:   state.paypalPlanId,
                    custom_id: state.signupToken // Ties PayPal subscription to our pending_signups row
                });
            },
            onApprove: async function(data) {
                try {
                    const res = await fetch('/api/v1/payments/paypal/approve', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            signup_token: state.signupToken,
                            subscription_id: data.subscriptionID
                        })
                    });
                    if (!res.ok) {
                        throw new Error('Manual provisioning trigger failed.');
                    }
                } catch (err) {
                    console.warn('Manual provisioning trigger failed, relying on webhook.', err);
                }

                // Store token in localStorage for the React frontend to read during polling
                localStorage.setItem('icss_signup_token', state.signupToken);
                window.location.href = '/provisioning';
            },
            onError: function() {
                const err = document.getElementById('error3');
                err.textContent = 'PayPal checkout encountered an error. Please try again.';
                err.style.display = 'block';
            }
        }).render(`#${containerId}`);
}
