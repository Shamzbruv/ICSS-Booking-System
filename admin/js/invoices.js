(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', async () => {
        if (!requireAuth()) return;
        populateUserUI();
        const el = id => document.getElementById(id), form = el('invoiceSettingsForm');
        let logoUrl = '', page = 1, saving = false;
        const message = text => { el('invoiceMessage').textContent = text; };
        function settings() { return { ...Object.fromEntries(new FormData(form)), logoUrl }; }
        function showLogo() { const image = el('invLogoPreview'); image.src = logoUrl || ''; image.style.display = logoUrl ? 'block' : 'none'; }
        async function download(path, filename, body) {
            const response = await fetch(`/api/v1/invoices${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${getToken()}`, 'X-Tenant-Slug': getTenantSlug(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
            if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Download failed.'); }
            const url = URL.createObjectURL(await response.blob());
            const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
        async function load() {
            try {
                const data = await apiFetch(`/api/v1/invoices?page=${page}`);
                const list = el('invoiceList'); list.replaceChildren();
                if (!data.invoices.length) list.textContent = 'Your booking invoices will appear here.';
                data.invoices.forEach(invoice => {
                    const row = document.createElement('div'); row.className = 'invoice-row';
                    const details = document.createElement('div'), title = document.createElement('strong'), info = document.createElement('p');
                    title.textContent = invoice.name;
                    info.textContent = `${String(invoice.booking_date).slice(0, 10)} · ${invoice.status.replaceAll('_', ' ')} · ${invoice.email || 'No customer email'}`;
                    details.append(title, info);
                    const button = document.createElement('button'); button.className = 'btn btn-secondary btn-sm'; button.type = 'button'; button.textContent = 'Download invoice';
                    button.addEventListener('click', async () => { button.disabled = true; try { await download(`/${invoice.booking_id}/pdf`, `invoice-${invoice.booking_id.slice(0, 8)}.pdf`); } catch (e) { message(e.message); } finally { button.disabled = false; } });
                    row.append(details, button); list.appendChild(row);
                });
                el('invPrevious').disabled = page === 1; el('invNext').disabled = !data.hasMore;
            } catch (e) { message(e.message); }
        }
        if (getUser()?.role !== 'tenant_admin') el('invoiceDesign').hidden = true;
        try {
            const data = await apiFetch('/api/v1/invoices/settings');
            for (const [name, value] of Object.entries(data.settings)) if (form.elements[name]) form.elements[name].value = value;
            logoUrl = /^(data:image\/(png|jpeg);base64,|\/media\/)/.test(data.settings.logoUrl || '') ? data.settings.logoUrl : '';
            showLogo();
        } catch (e) { message(e.message); }
        el('invLogo').addEventListener('change', async event => {
            const file = event.target.files[0]; if (!file) return;
            if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1048576) { message('Choose a PNG or JPG logo smaller than 1 MB.'); event.target.value = ''; return; }
            const reader = new FileReader(); reader.onload = () => { logoUrl = reader.result; showLogo(); message('Logo selected. Save the invoice style to use it on new invoices.'); }; reader.readAsDataURL(file);
        });
        el('invRemoveLogo').addEventListener('click', () => { logoUrl = ''; el('invLogo').value = ''; showLogo(); });
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (saving) return; saving = true; el('invSave').disabled = true;
            try { const data = await apiFetch('/api/v1/invoices/settings', { method: 'PUT', body: settings() }); logoUrl = data.settings.logoUrl; message('Invoice style saved. New bookings will use this design.'); }
            catch (e) { message(e.message); } finally { saving = false; el('invSave').disabled = false; }
        });
        el('invPreview').addEventListener('click', async () => { el('invPreview').disabled = true; try { await download('/preview', 'invoice-preview.pdf', settings()); } catch (e) { message(e.message); } finally { el('invPreview').disabled = false; } });
        el('invPrevious').addEventListener('click', () => { if (page > 1) { page--; load(); } });
        el('invNext').addEventListener('click', () => { page++; load(); });
        await load();
    });
}());
