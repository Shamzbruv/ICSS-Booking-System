let state = {
    themes: [],
    selectedThemeId: null,
    signupToken: null
};

document.addEventListener('DOMContentLoaded', () => {
    loadThemes();
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
        // Inject Custom Theme option
        state.themes.push({
            id: 'custom',
            name: 'Custom Design',
            category: 'Bespoke Experience',
            isCustom: true
        });
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
        if (theme.isCustom) {
            previewHtml = `
                <div class="theme-preview-box" style="background: linear-gradient(135deg, #1e1e2f, #2d2d44); color: #8b5cf6;">
                    <i class="fas fa-paint-roller" style="font-size: 3rem;"></i>
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

async function finalizeDraft() {
    const name = document.getElementById('tenantName').value;
    const ownerName = document.getElementById('ownerName').value;
    const email = document.getElementById('adminEmail').value;
    const pwd = document.getElementById('adminPassword').value;
    const plan = document.getElementById('planId').value;
    const phone = document.getElementById('tenantPhone').value;
    const companySize = document.getElementById('companySize').value;
    
    if (!name || !ownerName || !email || !pwd || !phone || !companySize) {
        goToStep(1);
        const err = document.getElementById('error1');
        err.textContent = 'All fields are required.';
        err.style.display = 'block';
        return;
    }
    
    if (!state.selectedThemeId) {
        const err = document.getElementById('error2');
        err.textContent = 'Please select an industry starter kit.';
        err.style.display = 'block';
        return;
    }

    document.getElementById('finalizeDraftBtn').disabled = true;
    document.getElementById('finalizeDraftBtn').textContent = 'Creating...';

    try {
        const res = await fetch('/api/v1/payments/paypal/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenant_name: name,
                owner_name: ownerName,
                admin_email: email,
                admin_password: pwd,
                theme_id: state.selectedThemeId,
                plan_id: plan,
                phone: phone,
                company_size: companySize
            })
        });

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Failed to initialize setup.');
        }

        state.signupToken = data.signup_token;
        
        // Setup PayPal buttons using the dynamic plan_id
        // In a real app we'd map "pro" to actual PayPal Plan IDs.
        // For MVP, we use hardcoded or from env.
        const mockPayPalPlanId = plan === 'pro' ? 'P-PRO_PLAN_ID' : 'P-STARTER_PLAN_ID';
        
        document.getElementById('paypal-button-container').innerHTML = ''; // clear previous
        
        paypal.Buttons({
            style: {
                shape: 'rect',
                color: 'blue',
                layout: 'vertical',
                label: 'subscribe'
            },
            createSubscription: function(data, actions) {
                return actions.subscription.create({
                    'plan_id': mockPayPalPlanId,
                    'custom_id': state.signupToken // This securely ties PayPal sub to our DB pending_signups
                });
            },
            onApprove: function(data, actions) {
                window.location.href = `/admin/login.html?success=true`;
            }
        }).render('#paypal-button-container');

        goToStep(3);

    } catch (e) {
        document.getElementById('finalizeDraftBtn').disabled = false;
        document.getElementById('finalizeDraftBtn').textContent = 'Next: Finalize & Subscribe';
        const err = document.getElementById('error2');
        err.textContent = e.message;
        err.style.display = 'block';
    }
}
