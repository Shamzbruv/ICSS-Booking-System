/* Staff-assisted phone bookings. Customer availability is always rechecked by the server. */
(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', async () => {
        const form = document.getElementById('assistedBookingForm');
        if (!form || !getToken()) return;
        const el = id => document.getElementById(id);
        const serviceInput = el('callerService'), dateInput = el('callerDate'), timeInput = el('callerTime');
        const submit = el('callerSubmit'), result = el('callerResult');
        let services = [], requestVersion = 0, busy = false, completed = false;
        const option = (text, value = '') => new Option(text, value);
        function paymentHint() {
            const service = services.find(item => item.id === serviceInput.value);
            if (!service) return;
            const amount = Number(service.price || 0);
            const requirement = service.payment_requirement_type || 'none';
            const due = requirement === 'full' ? amount : requirement === 'deposit'
                ? Math.min(amount, service.deposit_type === 'fixed' ? Number(service.deposit_amount || 0) : amount * Number(service.deposit_amount || 0) / 100) : 0;
            el('callerPaymentHint').textContent = due > 0
                ? `Required payment: ${service.currency || 'JMD'} ${due.toLocaleString()}. ${el('callerPayment').value === 'in_person' ? 'Booking stays pending until payment is received and verified.' : 'The normal checkout or receipt rules apply.'}`
                : 'No payment is required to reserve this appointment.';
        }
        async function loadTimes() {
            const version = ++requestVersion;
            submit.disabled = true;
            timeInput.replaceChildren(option('Choose a service and date'));
            paymentHint();
            if (!serviceInput.value || !dateInput.value) return;
            el('callerAvailability').textContent = 'Checking available times…';
            try {
                const params = new URLSearchParams({ date: dateInput.value, service_id: serviceInput.value });
                const data = await apiFetch(`/api/v1/availability?${params}`);
                if (version !== requestVersion) return;
                timeInput.replaceChildren(option('Select an available time'));
                (data.slots || []).forEach(slot => {
                    const item = option(`${slot.label || slot.time}${slot.available ? '' : ` — ${slot.message || slot.adminReason || 'Unavailable'}`}`, slot.time);
                    item.disabled = !slot.available;
                    timeInput.appendChild(item);
                });
                const available = (data.slots || []).some(slot => slot.available);
                el('callerAvailability').textContent = data.message || (available ? 'Times shown in the business timezone.' : 'No appointments available. Choose another date.');
                submit.disabled = completed || !available;
            } catch (err) {
                if (version === requestVersion) el('callerAvailability').textContent = err.message;
            }
        }
        serviceInput.addEventListener('change', loadTimes);
        dateInput.addEventListener('change', loadTimes);
        el('callerPayment').addEventListener('change', paymentHint);
        el('callerReset').addEventListener('click', () => {
            if (busy) return;
            ++requestVersion;
            form.reset(); completed = false; result.replaceChildren();
            el('callerAvailability').textContent = '';
            timeInput.replaceChildren(option('Choose a service and date')); submit.disabled = true;
            el('callerName').focus();
        });
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (busy || completed || !form.reportValidity()) return;
            busy = true; submit.disabled = true; result.textContent = 'Creating booking…';
            try {
                const file = el('callerReceipt').files[0];
                if (file && (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 3 * 1024 * 1024)) throw new Error('Choose a JPG, PNG or WebP receipt under 3 MB.');
                const receipt = file ? await new Promise((resolve, reject) => {
                    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read the receipt.')); reader.readAsDataURL(file);
                }) : null;
                const data = await apiFetch('/api/v1/bookings/assisted', { method: 'POST', body: {
                    name: el('callerName').value.trim(), phone: el('callerPhone').value.trim(), email: el('callerEmail').value.trim(),
                    service_id: serviceInput.value, date: dateInput.value, time: timeInput.value, notes: el('callerNotes').value.trim(),
                    payment_handling: el('callerPayment').value, verbal_consent: el('callerConsent').checked, terms_accepted: el('callerConsent').checked,
                    whatsapp_opt_in: el('callerWhatsApp').checked, receipt_image: receipt
                } });
                completed = true;
                const booking = data.booking;
                result.textContent = `Booking recorded for ${booking.name}. Reference: ${String(booking.id).slice(0, 8).toUpperCase()}. ${booking.booking_date} at ${String(booking.booking_time).slice(0, 5)}. Status: ${booking.status.replaceAll('_', ' ')}.`;
                if (data.amountDue > 0) result.appendChild(document.createTextNode(` Required payment: ${data.currency} ${Number(data.amountDue).toLocaleString()}.`));
                if (data.checkoutUrl && /^https?:$/.test(new URL(data.checkoutUrl, location.origin).protocol)) {
                    const link = document.createElement('a'); link.href = data.checkoutUrl; link.textContent = ' Open customer payment link'; link.target = '_blank'; link.rel = 'noreferrer'; result.appendChild(link);
                }
                if (typeof loadBookings === 'function') loadBookings();
            } catch (err) { result.textContent = err.message; }
            finally { busy = false; submit.disabled = completed; }
        });
        try {
            const [serviceData, tenant] = await Promise.all([apiFetch('/api/v1/public/services'), apiFetch('/api/v1/public/tenant')]);
            services = serviceData.services || [];
            serviceInput.replaceChildren(option(services.length ? 'Choose a service' : 'Add a service first'));
            services.forEach(service => serviceInput.appendChild(option(`${service.name} · ${service.duration_minutes || 30} min`, service.id)));
            const timezone = tenant.branding?.timezone || 'America/Jamaica';
            const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
            const part = type => parts.find(item => item.type === type).value;
            const today = `${part('year')}-${part('month')}-${part('day')}`;
            dateInput.min = today;
            const max = new Date(`${today}T12:00:00Z`); max.setUTCDate(max.getUTCDate() + 30); dateInput.max = max.toISOString().slice(0, 10);
            el('callerPolicy').textContent = tenant.site?.policies?.bookingTerms || 'Explain your business booking and cancellation policy to the customer before recording their agreement.';
        } catch (err) { result.textContent = `Could not prepare phone bookings: ${err.message}`; }
    });
})();
