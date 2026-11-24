(() => {
    'use strict';
    if (!requireAuth()) return;
    const el = id => document.getElementById(id);
    const api = (path, options) => apiFetch('/api/v1/patients' + path, options);
    const fields = { name:'patientName', preferredName:'patientPreferredName', email:'patientEmail',
        phone:'patientPhone', birthDate:'patientBirthDate', reference:'patientReference' };
    const bookingId = new URLSearchParams(location.search).get('booking');
    let booking = null;
    let selected = null;
    let createRequestId;
    let page = 1;
    let visitPage = 1;
    let searchRequest;
    let profileRequest;
    let saving = false;

    function status(message = '', error = false) {
        el('patientStatus').textContent = message;
        el('patientStatus').toggleAttribute('data-error', error);
    }

    if (!canOpenPatients()) {
        status('Sign in directly as an active practice administrator to open patient records.',true);
        return;
    }

    function textNode(tag, value) {
        const node = document.createElement(tag);
        node.textContent = value;
        return node;
    }

    function updateActions() {
        const linking = booking && !booking.patient_id;
        el('patientLink').hidden = !(linking && selected && !selected.archived);
        el('patientArchive').hidden = !selected;
        el('patientArchive').textContent = selected?.archived ? 'Restore patient' : 'Archive patient';
        el('patientUnlink').hidden = !booking?.patient_id;
        el('patientSave').textContent = !selected && linking ? 'Save and link booking' : 'Save patient';
    }

    async function loadBooking() {
        if (!bookingId) return;
        ({ booking } = await api('/bookings/' + encodeURIComponent(bookingId)));
        el('patientBookingContext').hidden = false;
        el('patientBookingDescription').textContent = [
            booking.name, formatDate(booking.booking_date), formatTime(booking.booking_time),
            booking.patient_id ? 'Patient linked' : 'Choose an existing patient or add a profile to link this appointment.'
        ].join(' · ');
        updateActions();
    }

    async function loadDirectory(nextPage = 1) {
        searchRequest?.abort();
        const request = new AbortController();
        searchRequest = request;
        el('patientDirectoryStatus').textContent = 'Loading patients…';
        el('patientPrevious').disabled = true;
        el('patientNext').disabled = true;
        try {
            const result = await api('/search', { method:'POST', signal:request.signal, body:{
                search:el('patientSearchText').value, archived:el('patientArchived').checked, page:nextPage
            } });
            if (request.signal.aborted) return;
            page = nextPage;
            el('patientResults').replaceChildren(...result.patients.map(patient => {
                const row = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'patient-row';
                button.dataset.patient = patient.id;
                button.setAttribute('aria-current', String(selected?.id === patient.id));
                button.append(textNode('strong',patient.name));
                const detail = [patient.preferredName,patient.reference].filter(Boolean).join(' · ');
                if (detail) button.append(textNode('small',detail));
                button.addEventListener('click', () => { if (!saving) openProfile(patient.id); });
                row.append(button);
                return row;
            }));
            el('patientDirectoryStatus').textContent = result.patients.length ? '' : 'No matching patients.';
            el('patientPage').textContent = 'Page ' + page;
            el('patientPrevious').disabled = page <= 1;
            el('patientNext').disabled = !result.more;
        } catch (error) {
            if (!request.signal.aborted) el('patientDirectoryStatus').textContent = error.message;
        }
    }

    function showForm(profile, heading) {
        for (const [field,input] of Object.entries(fields)) el(input).value = profile[field] || '';
        el('patientEditorTitle').textContent = heading;
        el('patientEmpty').hidden = true;
        el('patientForm').hidden = false;
        updateActions();
    }

    function createProfile() {
        if (saving) return;
        profileRequest?.abort();
        selected = null;
        createRequestId = crypto.randomUUID();
        el('patientHistorySection').hidden = true;
        el('patientVisits').replaceChildren();
        status();
        // Use booking contacts as a starting point only after the administrator chooses Add patient.
        showForm(booking && !booking.patient_id ? booking : {},'New patient');
        el('patientName').focus();
    }

    async function openProfile(id, nextPage = 1) {
        profileRequest?.abort();
        const request = new AbortController();
        profileRequest = request;
        try {
            const result = await api('/' + encodeURIComponent(id) + '?page=' + nextPage, { signal:request.signal });
            if (request.signal.aborted) return;
            selected = result.patient;
            visitPage = nextPage;
            showForm(selected,selected.archived ? 'Archived patient' : 'Patient profile');
            document.querySelectorAll('#patientResults [data-patient]').forEach(button => {
                button.setAttribute('aria-current',String(button.dataset.patient === id));
            });
            el('patientHistorySection').hidden = false;
            el('patientVisits').replaceChildren(...(result.visits.length ? result.visits.map(visit => {
                const row = document.createElement('li');
                const link = textNode('a',visit.service_name || 'Appointment');
                link.href = 'bookings.html?booking=' + encodeURIComponent(visit.id);
                row.append(link,textNode('small',[formatDate(visit.booking_date),formatTime(visit.booking_time),visit.status?.replaceAll('_',' ')].filter(Boolean).join(' · ')));
                return row;
            }) : [textNode('li','No appointments linked yet.')]));
            el('patientVisitsPrevious').disabled = nextPage <= 1;
            el('patientVisitsNext').disabled = !result.more;
            el('patientEditorTitle').focus();
        } catch (error) {
            if (!request.signal.aborted) status(error.message,true);
        }
    }

    async function mutate(action) {
        if (saving) return;
        profileRequest?.abort();
        saving = true;
        const buttons = ['patientSave','patientLink','patientUnlink','patientArchive','patientAdd'];
        buttons.forEach(button => { el(button).disabled = true; });
        status('Saving…');
        try { await action(); }
        catch (error) { status(error.message,true); }
        finally {
            saving = false;
            buttons.forEach(button => { el(button).disabled = false; });
        }
    }

    el('patientAdd').addEventListener('click',createProfile);
    el('patientSearch').addEventListener('submit',event => { event.preventDefault(); loadDirectory(); });
    el('patientArchived').addEventListener('change',() => loadDirectory());
    el('patientPrevious').addEventListener('click',() => loadDirectory(page-1));
    el('patientNext').addEventListener('click',() => loadDirectory(page+1));
    el('patientVisitsPrevious').addEventListener('click',() => { if (!saving && selected) openProfile(selected.id,visitPage-1); });
    el('patientVisitsNext').addEventListener('click',() => { if (!saving && selected) openProfile(selected.id,visitPage+1); });
    el('patientForm').addEventListener('submit',event => {
        event.preventDefault();
        mutate(async () => {
            const profile = Object.fromEntries(Object.entries(fields).map(([field,input])=>[field,el(input).value]));
            const path = selected ? '/' + encodeURIComponent(selected.id) : '';
            const link = !selected && booking && !booking.patient_id ? bookingId : undefined;
            const result = await api(path,{method:selected ? 'PATCH' : 'POST',body:{profile,bookingId:link,requestId:selected ? undefined : createRequestId}});
            const id = selected?.id || result.id;
            if (link) await loadBooking();
            await Promise.all([loadDirectory(),openProfile(id)]);
            status(link ? 'Patient saved and appointment linked.' : 'Patient saved.');
        });
    });
    el('patientLink').addEventListener('click',() => mutate(async () => {
        if (!booking || !selected || booking.patient_id) return;
        await api('/bookings/' + encodeURIComponent(bookingId), { method:'PUT', body:{patientId:selected.id} });
        await loadBooking();
        await openProfile(selected.id);
        status('Appointment linked to the patient.');
    }));
    el('patientUnlink').addEventListener('click',() => {
        if (!booking?.patient_id || !window.confirm('Unlink this appointment from the patient record?')) return;
        mutate(async () => {
            await api('/bookings/' + encodeURIComponent(bookingId), { method:'DELETE', body:{patientId:booking.patient_id} });
            await loadBooking();
            if (selected) await openProfile(selected.id);
            status('Appointment unlinked.');
        });
    });
    el('patientArchive').addEventListener('click',() => mutate(async () => {
        if (!selected) return;
        const { id, archived } = selected;
        await api('/' + encodeURIComponent(id), { method:'PATCH', body:{archived:!archived} });
        await Promise.all([loadDirectory(),openProfile(id)]);
        status(archived ? 'Patient restored.' : 'Patient archived.');
    }));

    populateUserUI();
    el('patientWorkspace').hidden = false;
    Promise.all([loadDirectory(),loadBooking()]).then(() => {
        el('patientAdd').hidden = false;
        if (booking?.patient_id) return openProfile(booking.patient_id);
    }).catch(error => status(error.message,true));
    window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
})();
