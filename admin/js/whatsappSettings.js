(async function initWhatsAppSettings() {
    const section = document.getElementById('whatsapp-settings');
    if (!section || getUser()?.role !== 'tenant_admin') return;

    const endpoint = '/api/v1/admin/whatsapp-settings';
    const form = document.getElementById('whatsappSettingsForm');
    const status = document.getElementById('whatsappSettingsStatus');
    const enabled = document.getElementById('whatsappEnabled');
    const reminderHours = document.getElementById('whatsappReminderHours');
    const recipients = document.getElementById('whatsappRecipients');
    const template = document.getElementById('whatsappRecipientTemplate');
    const addButton = document.getElementById('addWhatsappRecipient');
    const saveButton = form.querySelector('button[type="submit"]');
    section.hidden = false;

    function addRecipient(provider = {}) {
        const row = template.content.firstElementChild.cloneNode(true);
        const phone = row.querySelector('[name="recipientPhone"]');
        const consent = row.querySelector('[name="recipientConsent"]');
        row.querySelector('[name="recipientName"]').value = provider.name || '';
        phone.value = provider.phone || '';
        consent.checked = provider.opt_in === true;
        phone.addEventListener('input', () => { consent.checked = false; });
        row.querySelector('[data-remove-recipient]').addEventListener('click', () => {
            row.remove();
            addButton.disabled = false;
        });
        recipients.appendChild(row);
        addButton.disabled = recipients.children.length >= 20;
        return row;
    }

    function render(settings) {
        enabled.checked = settings.enabled;
        reminderHours.value = settings.reminders.join(', ');
        recipients.replaceChildren();
        addButton.disabled = false;
        settings.providers.forEach(addRecipient);
        status.textContent = !settings.enabled ? 'WhatsApp is off for this business.'
            : settings.platform_enabled ? 'WhatsApp is available at checkout.'
            : 'WhatsApp will appear at checkout once ICSS Bookings enables the service.';
    }

    addButton.addEventListener('click', () => addRecipient().querySelector('input').focus());
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const hours = reminderHours.value.trim();
        const reminders = hours ? hours.split(',').map(value => Number(value.trim())) : [];
        const providers = Array.from(recipients.children, row => ({
            name: row.querySelector('[name="recipientName"]').value,
            phone: row.querySelector('[name="recipientPhone"]').value,
            opt_in: row.querySelector('[name="recipientConsent"]').checked
        }));
        saveButton.disabled = true;
        try {
            const settings = await apiFetch(endpoint, { method: 'PUT', body: { enabled: enabled.checked, providers, reminders } });
            render(settings);
            showToast('WhatsApp settings saved.', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            saveButton.disabled = false;
        }
    });

    try {
        render(await apiFetch(endpoint));
        form.hidden = false;
    } catch (err) {
        status.textContent = `Could not load WhatsApp settings. ${err.message}`;
    }
})();
