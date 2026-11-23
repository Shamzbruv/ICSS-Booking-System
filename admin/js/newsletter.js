(() => {
    'use strict';
    if (!requireAuth()) return;

    const el = id => document.getElementById(id);
    const request = (path, options) => apiFetch('/api/v1/newsletter/' + path, options);
    const number = new Intl.NumberFormat();
    const statuses = { subscribed:'Subscribed', pending:'Awaiting confirmation', unsubscribed:'Unsubscribed' };
    const date = value => value ? new Date(value).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' }) : '';
    let settings;
    let page = 1;
    let subscriberRequest;
    let previewRequest;
    let previewTimer;
    let historyTimer;
    let historyRequest;
    let subscriber = null;
    let confirmedCount = 0;
    let retry;
    let saving = false;
    let sending = false;

    function node(tag, value) {
        const element = document.createElement(tag);
        element.textContent = value;
        return element;
    }

    function notice(id, text = '', error = false) {
        const item = el(id);
        item.textContent = text;
        item.toggleAttribute('data-error', error);
    }

    function audience(person, focus = true) {
        subscriber = person;
        el('newsletterRecipient').textContent = person?.email || 'All subscribed readers';
        el('useAll').hidden = !person;
        if (focus) {
            el('composeTitle').focus();
            el('composeTitle').scrollIntoView({ block:'start' });
        }
    }

    function subscriberRow(person) {
        const row = document.createElement('li');
        const info = document.createElement('div');
        const dateLabel = person.subscribed_at ? 'Joined ' + date(person.subscribed_at) : 'Requested ' + date(person.requested_at);
        info.append(node('strong',person.email), node('small', statuses[person.status] + ' · ' + dateLabel));
        row.append(info);
        if (person.status === 'subscribed') {
            const action = node('button','Email subscriber');
            action.type = 'button';
            action.className = 'btn btn-secondary';
            action.setAttribute('aria-label', 'Email ' + person.email);
            action.addEventListener('click', () => audience(person));
            row.append(action);
        }
        return row;
    }

    async function loadSubscribers() {
        subscriberRequest?.abort();
        const controller = new AbortController();
        subscriberRequest = controller;
        notice('subscriberState','Loading subscribers…');
        const params = new URLSearchParams({ page, search:el('subscriberSearch').value, status:el('subscriberFilter').value });
        try {
            const data = await request('subscribers?' + params, { signal:controller.signal });
            confirmedCount = data.totals.subscribed;
            el('emailAll').disabled = !confirmedCount;
            el('subscriberTotals').textContent = `${number.format(confirmedCount)} subscribed · ${number.format(data.totals.pending)} pending · ${number.format(data.totals.unsubscribed)} unsubscribed`;
            el('subscriberList').replaceChildren(...data.subscribers.map(subscriberRow));
            el('subscriberPage').textContent = 'Page ' + number.format(page);
            el('subscriberPrevious').disabled = page === 1;
            el('subscriberNext').disabled = !data.more;
            notice('subscriberState', data.subscribers.length ? '' : 'No subscribers match this view.');
        } catch (error) {
            if (error.name !== 'AbortError') notice('subscriberState',error.message,true);
        }
    }

    function readDesign() {
        return {
            layout:el('designLayout').value,
            accent:el('designInherit').checked ? '' : el('designAccent').value,
            background:el('designBackground').value,
            showLogo:el('designShowLogo').checked,
            footer:el('designFooter').value
        };
    }

    function readMessage() {
        return {
            subject:el('messageSubject').value, heading:el('messageHeading').value, body:el('messageBody').value,
            image:el('messageImage').value, actionLabel:el('messageActionLabel').value, actionUrl:el('messageActionUrl').value
        };
    }

    async function preview() {
        previewRequest?.abort();
        const controller = new AbortController();
        previewRequest = controller;
        try {
            const data = await request('preview', { method:'POST', body:{ design:readDesign(), message:readMessage() }, signal:controller.signal });
            el('designPreview').srcdoc = data.html;
            notice('previewNotice');
        } catch (error) {
            if (error.name !== 'AbortError') notice('previewNotice',error.message,true);
        }
    }

    async function saveSettings(part) {
        if (saving) return;
        saving = true;
        const design = part === 'design';
        const button = el(design ? 'saveDesign' : 'saveSignup');
        const status = design ? 'composerNotice' : 'newsletterNotice';
        const changes = { enabled: design ? settings.enabled : el('signupEnabled').checked,
            design: design ? readDesign() : settings.design };
        button.disabled = true;
        try {
            settings = await request('settings', { method:'PUT', body:changes });
            notice(status,design ? 'Default email design saved.' : settings.enabled ? 'Website signups are on.' : 'Website signups are off.');
        } catch (error) {
            notice(status,error.message,true);
        } finally {
            saving = false;
            button.disabled = false;
        }
    }

    async function loadHistory() {
        clearTimeout(historyTimer);
        historyRequest?.abort();
        const controller = new AbortController();
        historyRequest = controller;
        try {
            const { campaigns } = await request('campaigns', { signal:controller.signal });
            el('newsletterHistory').replaceChildren(...campaigns.map(campaign => {
                const row = document.createElement('li');
                const info = document.createElement('div');
                info.append(node('strong',campaign.subject),node('small',date(campaign.created_at)));
                const counts = [`${number.format(campaign.sent)} sent`,`${number.format(campaign.queued)} queued`];
                if (campaign.failed) counts.push(`${number.format(campaign.failed)} failed`);
                if (campaign.skipped) counts.push(`${number.format(campaign.skipped)} skipped`);
                row.append(info,node('small',counts.join(' · ')));
                return row;
            }));
            notice('historyState',campaigns.length ? '' : 'Sent and queued emails will appear here.');
            if (campaigns.some(campaign => campaign.queued)) historyTimer = setTimeout(loadHistory, 12000);
        } catch (error) {
            if (error.name !== 'AbortError') notice('historyState',error.message,true);
        }
    }

    async function send(event) {
        event.preventDefault();
        if (sending) return;
        if (!subscriber && !confirmedCount) {
            notice('composerNotice','There are no confirmed subscribers yet.',true);
            return;
        }
        const content = {
            audience:subscriber ? 'individual' : 'all', subscriberId:subscriber?.id,
            message:readMessage(), design:readDesign()
        };
        const label = subscriber?.email || 'all confirmed subscribers';
        if (!window.confirm(`Send this newsletter to ${label}?`)) return;
        sending = true;
        el('sendNewsletter').disabled = true;
        notice('composerNotice','Queueing email…');
        const signature = JSON.stringify(content);
        if (retry?.signature !== signature) retry = { signature, id:crypto.randomUUID() };
        try {
            const result = await request('campaigns', { method:'POST', body:{ ...content, requestId:retry.id } });
            retry = null;
            notice('composerNotice',result.recipients ? `Queued for ${number.format(result.recipients)} recipient${result.recipients === 1 ? '' : 's'}.` : 'This email has already been queued.');
            await loadHistory();
        } catch (error) {
            notice('composerNotice',error.message,true);
        } finally {
            sending = false;
            el('sendNewsletter').disabled = false;
        }
    }

    async function init() {
        try {
            settings = await request('settings');
            el('tenantName').textContent = settings.brand.name;
            const design = settings.design;
            el('signupEnabled').checked = settings.enabled;
            el('designLayout').value = design.layout;
            el('designInherit').checked = !design.accent;
            el('designAccent').value = design.accent || settings.brand.accent;
            el('designAccent').disabled = !design.accent;
            el('designBackground').value = design.background;
            el('designShowLogo').checked = design.showLogo;
            el('designFooter').value = design.footer;
            el('newsletterWorkspace').hidden = false;
            notice('newsletterNotice');
            await Promise.all([loadSubscribers(),loadHistory(),preview()]);
        } catch (error) {
            notice('newsletterNotice',error.message,true);
        }
    }

    el('subscriberSearchForm').addEventListener('submit', event => { event.preventDefault(); page=1; loadSubscribers(); });
    el('subscriberFilter').addEventListener('change', () => { page=1; loadSubscribers(); });
    el('subscriberPrevious').addEventListener('click', () => { page=Math.max(1,page-1); loadSubscribers(); });
    el('subscriberNext').addEventListener('click', () => { page++; loadSubscribers(); });
    el('emailAll').addEventListener('click', () => audience(null));
    el('useAll').addEventListener('click', () => audience(null,false));
    el('designInherit').addEventListener('change', (event) => { el('designAccent').disabled = event.target.checked; });
    el('newsletterCompose').addEventListener('input', () => {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(preview, 400);
    });
    el('newsletterCompose').addEventListener('submit', send);
    el('saveDesign').addEventListener('click', () => saveSettings('design'));
    el('saveSignup').addEventListener('click', () => saveSettings('signup'));
    el('refreshHistory').addEventListener('click', loadHistory);
    notice('newsletterNotice','Loading newsletter…');
    init();
})();
