/**
 * ICSS Website Builder
 *
 * Layered editor for a tenant's public website with a pixel-accurate live
 * preview. Used in two places:
 *   - admin/customize.html  (mode: 'tenant') — autosaves a draft, publishes live
 *   - public/playground.html (mode: 'demo')  — try-before-you-buy, nothing saved
 *
 * The preview iframe renders the real React site (?preview=1). It sends the
 * section catalogue, field definitions and media size guide on load, so this
 * file never duplicates what the site can render.
 *
 *   builder → preview: icss:site-update | -navigate | -highlight | -music | -resolve | -request-defaults | -theme
 *   preview → builder: icss:site-ready  | -page | -select | -resolved | -defaults
 */
(function initSiteBuilder(global) {
    'use strict';

    const DEVICES = {
        desktop: { label: 'Desktop', width: 1366, icon: '🖥️' },
        tablet: { label: 'Tablet', width: 820, icon: '📱' },
        phone: { label: 'Phone', width: 390, icon: '📲' }
    };
    const IMAGE_MAX_EDGE = { heroImage: 2400, heroMobileImage: 1600, poster: 1920, bannerImage: 2400, featureImage: 1600, galleryImage: 1600, teamPhoto: 1000, logo: 1000 };
    const RATIO_TARGETS = { heroImage: 16 / 9, heroMobileImage: 9 / 16, poster: 16 / 9, bannerImage: 21 / 9, featureImage: 4 / 5, teamPhoto: 1, heroVideo: 16 / 9 };
    const MIN_WIDTH = { heroImage: 1600, poster: 1280, bannerImage: 1800, featureImage: 900, galleryImage: 900, teamPhoto: 500, heroVideo: 1280 };

    // ── Tiny DOM helper (no innerHTML with user content anywhere) ───────────
    function h(tag, attrs, ...children) {
        const el = document.createElement(tag);
        if (attrs) {
            for (const [key, value] of Object.entries(attrs)) {
                if (value === undefined || value === null || value === false) continue;
                if (key === 'class') el.className = value;
                else if (key === 'text') el.textContent = value;
                else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
                else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
                else if (key === 'dataset') Object.assign(el.dataset, value);
                else if (value === true) el.setAttribute(key, '');
                else el.setAttribute(key, value);
            }
        }
        for (const child of children.flat()) {
            if (child === null || child === undefined || child === false) continue;
            el.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
        }
        return el;
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const getPath = (obj, path) => path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    function setPath(obj, path, value) {
        const keys = path.split('.');
        let cursor = obj;
        keys.slice(0, -1).forEach((key) => {
            if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
            cursor = cursor[key];
        });
        cursor[keys[keys.length - 1]] = value;
    }
    const uid = (type) => `${type}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const formatBytes = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

    function ratioLabel(ratio) {
        const known = [[16 / 9, '16:9'], [9 / 16, '9:16'], [21 / 9, '21:9'], [4 / 5, '4:5'], [1, '1:1'], [3 / 2, '3:2'], [2 / 3, '2:3'], [4 / 3, '4:3'], [3 / 4, '3:4']];
        const match = known.find(([value]) => Math.abs(value - ratio) < 0.04);
        return match ? match[1] : `${ratio.toFixed(2)}:1`;
    }

    class SiteBuilder {
        constructor(options) {
            this.root = options.root;
            this.mode = options.mode || 'tenant';
            this.slug = options.slug || '';
            this.themeKey = options.themeKey || 'universal';
            this.api = options.api || null;
            this.previewBase = options.previewBase; // e.g. '/my-salon' or '/demo/barber'
            this.onReady = options.onReady || (() => {});
            this.templates = options.templates || [];
            this.ctaHref = options.ctaHref || '/onboarding';

            this.catalog = null;
            this.site = null;
            this.defaults = null;
            this.savedJson = null;
            this.publishedJson = null;
            this.history = [];
            this.future = [];
            this.page = 'home';
            this.selected = null; // { type: 'section', page, id }
            this.tab = 'layers';
            this.device = 'desktop';
            this.saveTimer = 0;
            this.saving = false;
            this.media = [];
            this.mediaUsage = { used: 0, quota: 0 };
            this.pendingRequests = new Map();
            this.initialised = false;

            this.build();
            this.bindMessages();
            this.loadPreview();
            if (this.mode === 'tenant') this.loadMedia();
        }

        // ── Layout ───────────────────────────────────────────────────────────
        build() {
            this.root.classList.add('sb');
            this.statusEl = h('span', { class: 'sb-status', 'data-state': 'loading', text: 'Loading…' });
            this.undoBtn = h('button', { type: 'button', class: 'sb-icon-btn', title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', onClick: () => this.undo() }, '↶');
            this.redoBtn = h('button', { type: 'button', class: 'sb-icon-btn', title: 'Redo (Ctrl+Shift+Z)', 'aria-label': 'Redo', onClick: () => this.redo() }, '↷');

            const deviceGroup = h('div', { class: 'sb-segment', role: 'group', 'aria-label': 'Preview device' },
                Object.entries(DEVICES).map(([key, device]) => h('button', {
                    type: 'button', class: key === this.device ? 'is-active' : '', dataset: { device: key }, title: `${device.label} preview`,
                    onClick: () => this.setDevice(key)
                }, h('span', { 'aria-hidden': 'true', text: device.icon }), h('span', { class: 'sb-hide-sm', text: device.label })))
            );
            this.deviceGroup = deviceGroup;

            this.pageSelect = h('select', { class: 'sb-select sb-page-select', 'aria-label': 'Preview page', onChange: (e) => this.goToPage(e.target.value) });

            const actions = h('div', { class: 'sb-actions' });
            if (this.mode === 'tenant') {
                this.discardBtn = h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onClick: () => this.discard() }, 'Discard');
                this.publishBtn = h('button', { type: 'button', class: 'btn btn-primary btn-sm sb-publish', onClick: () => this.confirmPublish() }, 'Publish');
                this.liveLink = h('a', { class: 'btn btn-secondary btn-sm sb-hide-sm', href: `/${this.slug}`, target: '_blank', rel: 'noreferrer' }, 'View live ↗');
                actions.append(this.liveLink, this.discardBtn, this.publishBtn);
            } else {
                this.templateSelect = h('select', { class: 'sb-select', 'aria-label': 'Template', onChange: (e) => this.switchTemplate(e.target.value) },
                    this.templates.map((t) => h('option', { value: t.key, selected: t.key === this.themeKey ? true : undefined, text: t.label })));
                this.ctaLink = h('a', { class: 'btn btn-primary btn-sm sb-publish', href: this.ctaHref }, 'Create my website →');
                actions.append(this.templateSelect, this.ctaLink);
            }

            const toolbar = h('div', { class: 'sb-toolbar' },
                h('div', { class: 'sb-toolbar-left' }, this.undoBtn, this.redoBtn, this.statusEl),
                h('div', { class: 'sb-toolbar-mid' }, this.pageSelect, deviceGroup),
                actions
            );

            this.tabsEl = h('div', { class: 'sb-tabs', role: 'tablist' });
            const tabs = [['layers', '🗂️', 'Layers'], ['style', '🎨', 'Style'], ['info', '🏷️', 'Site info'], ['music', '🎵', 'Music'], ['media', '🖼️', 'Media']];
            tabs.forEach(([key, icon, label]) => {
                this.tabsEl.appendChild(h('button', {
                    type: 'button', role: 'tab', class: key === this.tab ? 'is-active' : '', dataset: { tab: key, tour: `builder-tab-${key}` },
                    onClick: () => this.setTab(key)
                }, h('span', { 'aria-hidden': 'true', text: icon }), label));
            });
            this.panelBody = h('div', { class: 'sb-panel-body' }, h('p', { class: 'sb-muted', text: 'Loading your website…' }));
            const panel = h('aside', { class: 'sb-panel', 'data-tour': 'builder-panel' }, this.tabsEl, this.panelBody);

            this.iframe = h('iframe', { class: 'sb-frame', title: 'Live website preview' });
            this.frameScaler = h('div', { class: 'sb-frame-scaler' }, this.iframe);
            this.stage = h('div', { class: 'sb-stage', 'data-tour': 'builder-preview' }, this.frameScaler,
                h('div', { class: 'sb-stage-label' }, h('span', { class: 'sb-dot' }), 'Live preview — changes appear instantly'));

            this.mobileSwitch = h('div', { class: 'sb-mobile-switch', role: 'group', 'aria-label': 'Builder view' },
                h('button', { type: 'button', class: 'is-active', dataset: { view: 'edit' }, onClick: () => this.setMobileView('edit') }, 'Edit'),
                h('button', { type: 'button', dataset: { view: 'preview' }, onClick: () => this.setMobileView('preview') }, 'Preview'));

            this.root.replaceChildren(toolbar, h('div', { class: 'sb-body' }, panel, this.stage), this.mobileSwitch);

            this.resizeObserver = new ResizeObserver(() => this.layoutFrame());
            this.resizeObserver.observe(this.stage);

            document.addEventListener('keydown', (event) => {
                if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
                if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
                event.preventDefault();
                if (event.shiftKey) this.redo(); else this.undo();
            });
            window.addEventListener('beforeunload', (event) => {
                if (this.mode === 'tenant' && this.isDirty()) { event.preventDefault(); event.returnValue = ''; }
            });
        }

        setMobileView(view) {
            this.root.dataset.mobileView = view;
            this.mobileSwitch.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
            if (view === 'preview') this.layoutFrame();
        }

        setDevice(device) {
            this.device = device;
            this.deviceGroup.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.dataset.device === device));
            this.layoutFrame();
        }

        layoutFrame() {
            const width = DEVICES[this.device].width;
            const box = this.stage.getBoundingClientRect();
            const available = Math.max(200, box.width - 32);
            const scale = Math.min(1, available / width);
            const height = Math.max(400, (box.height - 56) / scale);
            this.iframe.style.width = `${width}px`;
            this.iframe.style.height = `${height}px`;
            this.iframe.style.transform = `scale(${scale})`;
            this.frameScaler.style.width = `${width * scale}px`;
            this.frameScaler.style.height = `${height * scale}px`;
            this.frameScaler.dataset.device = this.device;
        }

        // ── Preview bridge ───────────────────────────────────────────────────
        previewUrl(page) {
            const path = page && page !== 'home' ? `${this.previewBase}/${page}` : this.previewBase;
            return `${path}?preview=1&t=${Date.now()}`;
        }

        loadPreview(page = this.page) {
            this.iframe.src = this.previewUrl(page);
        }

        post(message) {
            const target = this.iframe.contentWindow;
            if (target) target.postMessage(message, window.location.origin);
        }

        request(type, payload, replyType) {
            const requestId = `${type}-${Date.now()}-${Math.random()}`;
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => { this.pendingRequests.delete(requestId); reject(new Error('Preview did not respond.')); }, 8000);
                this.pendingRequests.set(requestId, { resolve, timer, replyType });
                this.post({ type, requestId, ...payload });
            });
        }

        bindMessages() {
            window.addEventListener('message', (event) => {
                if (event.origin !== window.location.origin || event.source !== this.iframe.contentWindow) return;
                const data = event.data || {};
                if (data.requestId && this.pendingRequests.has(data.requestId)) {
                    const pending = this.pendingRequests.get(data.requestId);
                    clearTimeout(pending.timer);
                    this.pendingRequests.delete(data.requestId);
                    pending.resolve(data);
                    return;
                }
                switch (data.type) {
                    case 'icss:site-ready': this.handleReady(data); break;
                    case 'icss:site-page':
                        this.page = data.page;
                        if (this.pageSelect.value !== data.page) this.pageSelect.value = data.page;
                        if (this.tab === 'layers' && !this.selected) this.renderPanel();
                        break;
                    case 'icss:site-select':
                        this.selectSection(data.page, data.sectionId, { fromPreview: true });
                        break;
                    default:
                }
            });
        }

        async handleReady(data) {
            this.catalog = data.catalog;
            this.defaults = data.defaults;
            if (data.themeKey && data.themeKey !== this.themeKey) {
                this.themeKey = data.themeKey;
                if (this.templateSelect) this.templateSelect.value = data.themeKey;
            }

            if (!this.initialised || data.themeChanged) {
                this.initialised = true;
                let start = data.resolved;
                if (this.mode === 'tenant' && this.api) {
                    try {
                        const state = await this.api.loadSite();
                        this.publishedJson = state.published ? JSON.stringify(state.published) : null;
                        if (state.draft) {
                            const resolved = await this.request('icss:site-resolve', { site: state.draft });
                            start = resolved.resolved;
                        }
                    } catch (err) {
                        this.toast(err.message || 'Could not load your saved website.', 'error');
                    }
                }
                this.site = clone(start);
                this.savedJson = JSON.stringify(this.site);
                if (this.publishedJson === null && this.mode === 'tenant') this.publishedJson = '__never_published__';
                this.history = [];
                this.future = [];
                this.renderPageSelect();
                this.renderPanel();
                this.updateStatus();
                this.onReady(this);
            }
            // Every (re)load of the preview gets the current working copy.
            this.post({ type: 'icss:site-update', site: this.site });
            if (this.selected) this.post({ type: 'icss:site-highlight', sectionId: this.selected.id });
            this.layoutFrame();
        }

        // ── State changes ───────────────────────────────────────────────────
        change(mutator, { rerender = true, coalesce = null } = {}) {
            const before = JSON.stringify(this.site);
            const last = this.history[this.history.length - 1];
            if (!(coalesce && last && last.coalesce === coalesce && Date.now() - last.at < 900)) {
                this.history.push({ json: before, coalesce, at: Date.now() });
                if (this.history.length > 80) this.history.shift();
            } else {
                last.at = Date.now();
            }
            this.future = [];
            mutator(this.site);
            this.afterChange(rerender);
        }

        afterChange(rerender) {
            cancelAnimationFrame(this.postFrame);
            this.postFrame = requestAnimationFrame(() => this.post({ type: 'icss:site-update', site: this.site }));
            if (rerender) this.renderPanel();
            this.renderPageSelect();
            this.updateStatus();
            this.scheduleSave();
        }

        undo() {
            const entry = this.history.pop();
            if (!entry) return;
            this.future.push(JSON.stringify(this.site));
            this.site = JSON.parse(entry.json);
            this.afterChange(true);
        }

        redo() {
            const next = this.future.pop();
            if (!next) return;
            this.history.push({ json: JSON.stringify(this.site), at: 0 });
            this.site = JSON.parse(next);
            this.afterChange(true);
        }

        isDirty() { return this.site && JSON.stringify(this.site) !== this.savedJson; }

        scheduleSave() {
            if (this.mode !== 'tenant' || !this.api) return;
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => this.saveDraft(), 1200);
        }

        async saveDraft() {
            if (!this.isDirty() || this.saving) return;
            this.saving = true;
            this.updateStatus();
            const json = JSON.stringify(this.site);
            try {
                await this.api.saveDraft(this.site);
                this.savedJson = json;
            } catch (err) {
                this.toast(err.message || 'Draft could not be saved.', 'error');
            } finally {
                this.saving = false;
                this.updateStatus();
                if (this.isDirty()) this.scheduleSave();
            }
        }

        updateStatus() {
            this.undoBtn.disabled = this.history.length === 0;
            this.redoBtn.disabled = this.future.length === 0;
            if (!this.site) return;
            let state;
            let text;
            if (this.mode === 'demo') {
                state = 'demo'; text = 'Playground — nothing is saved';
            } else if (this.saving) {
                state = 'saving'; text = 'Saving draft…';
            } else if (this.isDirty()) {
                state = 'dirty'; text = 'Unsaved changes';
            } else if (JSON.stringify(this.site) !== this.publishedJson) {
                state = 'draft'; text = 'Draft saved · not live yet';
            } else {
                state = 'live'; text = 'Published · live';
            }
            this.statusEl.dataset.state = state;
            this.statusEl.textContent = text;
            if (this.publishBtn) this.publishBtn.disabled = state === 'live' || state === 'saving';
            if (this.discardBtn) this.discardBtn.disabled = state === 'live' || this.publishedJson === '__never_published__';
        }

        async confirmPublish() {
            const ok = await this.modalConfirm({
                title: 'Publish your website?',
                body: 'Everything you see in the preview will go live for your customers immediately. You can keep editing afterwards — changes stay in draft until you publish again.',
                confirm: 'Publish now'
            });
            if (!ok) return;
            clearTimeout(this.saveTimer);
            this.publishBtn.disabled = true;
            this.publishBtn.textContent = 'Publishing…';
            try {
                await this.api.publish(this.site);
                this.savedJson = JSON.stringify(this.site);
                this.publishedJson = this.savedJson;
                this.toast('Your website is live! 🎉');
            } catch (err) {
                this.toast(err.message || 'Publishing failed.', 'error');
            } finally {
                this.publishBtn.textContent = 'Publish';
                this.updateStatus();
            }
        }

        async discard() {
            const ok = await this.modalConfirm({
                title: 'Discard unpublished changes?',
                body: 'Your draft will be thrown away and the editor will return to the version that is currently live.',
                confirm: 'Discard changes', danger: true
            });
            if (!ok) return;
            try {
                await this.api.discard();
                const resolved = await this.request('icss:site-resolve', { site: JSON.parse(this.publishedJson) });
                this.site = clone(resolved.resolved);
                this.savedJson = JSON.stringify(this.site);
                this.publishedJson = this.savedJson;
                this.history = []; this.future = [];
                this.selected = null;
                this.afterChange(true);
                this.toast('Draft discarded.');
            } catch (err) {
                this.toast(err.message || 'Could not discard the draft.', 'error');
            }
        }

        async resetToTemplate() {
            const ok = await this.modalConfirm({
                title: 'Start again from the template?',
                body: 'This replaces your pages, sections, colours and text with the template defaults. Uploaded media stays in your library. You can undo straight after.',
                confirm: 'Reset to template', danger: true
            });
            if (!ok) return;
            const reply = await this.request('icss:site-request-defaults', {});
            this.change((site) => { Object.keys(site).forEach((k) => delete site[k]); Object.assign(site, clone(reply.defaults)); });
            this.selected = null;
            this.renderPanel();
        }

        switchTemplate(key) {
            this.initialised = false;
            this.selected = null;
            this.post({ type: 'icss:site-theme', themeKey: key });
        }

        // ── Navigation helpers ──────────────────────────────────────────────
        renderPageSelect() {
            if (!this.site) return;
            const current = this.page;
            this.pageSelect.replaceChildren(...this.site.pages.map((p) => h('option', { value: p.id, text: `${p.label}${p.visible ? '' : ' (hidden)'}` })));
            this.pageSelect.value = current;
        }

        goToPage(pageId) {
            this.page = pageId;
            this.post({ type: 'icss:site-navigate', page: pageId });
        }

        selectSection(pageId, sectionId, { fromPreview = false } = {}) {
            this.selected = { page: pageId, id: sectionId };
            if (this.tab !== 'layers') this.setTab('layers', false);
            if (pageId !== this.page) this.goToPage(pageId);
            this.post({ type: 'icss:site-highlight', sectionId });
            this.renderPanel();
            if (fromPreview) this.setMobileView('edit');
        }

        clearSelection() {
            this.selected = null;
            this.post({ type: 'icss:site-highlight', sectionId: null });
            this.renderPanel();
        }

        setTab(tab, render = true) {
            this.tab = tab;
            this.tabsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
            if (tab !== 'layers' && this.selected) {
                this.selected = null;
                this.post({ type: 'icss:site-highlight', sectionId: null });
            }
            if (render) this.renderPanel();
        }

        findSection(pageId, id) {
            const page = this.site.pages.find((p) => p.id === pageId);
            if (!page) return {};
            const index = page.sections.findIndex((s) => s.id === id);
            return { page, index, section: page.sections[index] };
        }

        // ── Panel rendering ─────────────────────────────────────────────────
        renderPanel() {
            if (!this.site || !this.catalog) return;
            const scroll = this.panelBody.scrollTop;
            let content;
            if (this.tab === 'layers') content = this.selected ? this.renderInspector() : this.renderLayers();
            else if (this.tab === 'style') content = this.renderStyle();
            else if (this.tab === 'info') content = this.renderInfo();
            else if (this.tab === 'music') content = this.renderMusic();
            else content = this.renderMediaTab();
            this.panelBody.replaceChildren(content);
            this.panelBody.scrollTop = scroll;
        }

        renderLayers() {
            const wrap = h('div', { class: 'sb-layers' });

            wrap.appendChild(h('div', { class: 'sb-card sb-switches', 'data-tour': 'builder-site-mode' },
                this.choice('Website mode', this.site.enabled === false ? 'booking' : 'site', [
                    { value: 'site', label: 'Full website' }, { value: 'booking', label: 'Booking page only' }
                ], (value) => this.change((s) => { s.enabled = value === 'site'; })),
                this.choice('Page layout', this.site.layoutMode === 'onepage' ? 'onepage' : 'pages', [
                    { value: 'pages', label: 'Separate pages' }, { value: 'onepage', label: 'One scrolling page' }
                ], (value) => this.change((s) => { s.layoutMode = value; }))
            ));

            wrap.appendChild(h('p', { class: 'sb-hint', text: 'Pages and their sections, top to bottom. Click a layer to edit it, use the arrows to reorder, and the eye to hide it.' }));

            const middle = this.site.pages.filter((p) => p.id !== 'home' && p.id !== 'book').map((p) => p.id);
            this.site.pages.forEach((page) => {
                const locked = page.id === 'home' || page.id === 'book';
                const isCurrent = page.id === this.page;
                const pageRow = h('div', { class: `sb-page ${isCurrent ? 'is-current' : ''} ${page.visible ? '' : 'is-hidden'}` });
                const head = h('div', { class: 'sb-page-head' },
                    h('button', { type: 'button', class: 'sb-page-name', onClick: () => this.goToPage(page.id), title: 'Show this page in the preview' },
                        h('span', { class: 'sb-page-icon', 'aria-hidden': 'true', text: { home: '🏠', about: '👋', gallery: '🖼️', book: '📅' }[page.id] || '📄' }),
                        h('span', { text: page.label })),
                    h('div', { class: 'sb-row-actions' },
                        !locked && h('button', { type: 'button', class: 'sb-mini', title: 'Move page left in menu', 'aria-label': 'Move page up', disabled: middle.indexOf(page.id) === 0 ? true : undefined, onClick: () => this.movePage(page.id, -1) }, '↑'),
                        !locked && h('button', { type: 'button', class: 'sb-mini', title: 'Move page right in menu', 'aria-label': 'Move page down', disabled: middle.indexOf(page.id) === middle.length - 1 ? true : undefined, onClick: () => this.movePage(page.id, 1) }, '↓'),
                        h('button', { type: 'button', class: 'sb-mini', title: locked ? 'This page is always on' : (page.visible ? 'Hide page' : 'Show page'), 'aria-label': page.visible ? 'Hide page' : 'Show page', disabled: locked ? true : undefined, onClick: () => this.change((s) => { const p = s.pages.find((x) => x.id === page.id); p.visible = !p.visible; }) }, page.visible ? '👁' : '🚫')
                    )
                );
                pageRow.appendChild(head);
                pageRow.appendChild(h('label', { class: 'sb-inline-field' }, h('span', { text: 'Menu label' }),
                    h('input', { type: 'text', value: page.label, maxlength: '30', onInput: (e) => this.change((s) => { s.pages.find((x) => x.id === page.id).label = e.target.value; }, { rerender: false, coalesce: `label-${page.id}` }) })));

                const list = h('ol', { class: 'sb-sections' });
                page.sections.forEach((section, index) => {
                    const type = this.catalog.sectionTypes[section.type] || { label: section.type, icon: '▫️' };
                    const fixedBooking = page.id === 'book' && section.type === 'booking';
                    const summary = section.props?.headline || section.props?.title || type.description;
                    list.appendChild(h('li', { class: `sb-section ${section.visible ? '' : 'is-hidden'}` },
                        h('button', { type: 'button', class: 'sb-section-main', onClick: () => this.selectSection(page.id, section.id) },
                            h('span', { class: 'sb-section-icon', 'aria-hidden': 'true', text: type.icon }),
                            h('span', { class: 'sb-section-text' }, h('strong', { text: type.label }), h('small', { text: String(summary || '').replace(/\n/g, ' ').slice(0, 60) }))),
                        h('div', { class: 'sb-row-actions' },
                            h('button', { type: 'button', class: 'sb-mini', 'aria-label': 'Move up', title: 'Move up', disabled: index === 0 ? true : undefined, onClick: () => this.moveSection(page.id, index, -1) }, '↑'),
                            h('button', { type: 'button', class: 'sb-mini', 'aria-label': 'Move down', title: 'Move down', disabled: index === page.sections.length - 1 ? true : undefined, onClick: () => this.moveSection(page.id, index, 1) }, '↓'),
                            h('button', { type: 'button', class: 'sb-mini', 'aria-label': section.visible ? 'Hide section' : 'Show section', title: fixedBooking ? 'The booking widget is always shown on the Book page' : (section.visible ? 'Hide' : 'Show'), disabled: fixedBooking ? true : undefined, onClick: () => this.change((s) => { const sec = this.findSection.call({ site: s }, page.id, section.id).section; sec.visible = !sec.visible; }) }, section.visible ? '👁' : '🚫')
                        )
                    ));
                });
                pageRow.appendChild(list);
                pageRow.appendChild(h('button', { type: 'button', class: 'sb-add', onClick: () => this.openAddSection(page.id) }, '+ Add section'));
                wrap.appendChild(pageRow);
            });

            wrap.appendChild(h('button', { type: 'button', class: 'btn btn-secondary sb-reset', onClick: () => this.resetToTemplate() }, '↺ Reset everything to the template'));
            return wrap;
        }

        choice(label, value, options, onChange) {
            return h('div', { class: 'sb-choice' }, h('span', { class: 'sb-label', text: label }),
                h('div', { class: 'sb-segment sb-segment-full' }, options.map((opt) => h('button', {
                    type: 'button', class: opt.value === value ? 'is-active' : '', onClick: () => { if (opt.value !== value) onChange(opt.value); }
                }, opt.label))));
        }

        movePage(pageId, delta) {
            this.change((site) => {
                const index = site.pages.findIndex((p) => p.id === pageId);
                const target = index + delta;
                if (target <= 0 || target >= site.pages.length - 1) return;
                [site.pages[index], site.pages[target]] = [site.pages[target], site.pages[index]];
            });
        }

        moveSection(pageId, index, delta) {
            this.change((site) => {
                const page = site.pages.find((p) => p.id === pageId);
                const target = index + delta;
                if (target < 0 || target >= page.sections.length) return;
                [page.sections[index], page.sections[target]] = [page.sections[target], page.sections[index]];
            });
        }

        openAddSection(pageId) {
            const types = Object.entries(this.catalog.sectionTypes).filter(([type]) => {
                if (type === 'booking') return pageId !== 'book';
                return true;
            });
            const close = this.modal(h('div', { class: 'sb-add-grid' },
                types.map(([type, def]) => h('button', {
                    type: 'button', class: 'sb-add-card',
                    onClick: () => {
                        close();
                        const id = uid(type);
                        this.change((site) => {
                            const page = site.pages.find((p) => p.id === pageId);
                            const props = clone(this.templateProps(type) || this.catalog.sectionDefaults[type] || {});
                            const at = page.id === 'book' ? Math.max(0, page.sections.findIndex((s) => s.type === 'booking')) : page.sections.length;
                            page.sections.splice(at === -1 ? page.sections.length : at, 0, { id, type, visible: true, props });
                        });
                        this.selectSection(pageId, id);
                    }
                }, h('span', { class: 'sb-add-icon', 'aria-hidden': 'true', text: def.icon }), h('strong', { text: def.label }), h('small', { text: def.description })))
            ), { title: 'Add a section', wide: true });
        }

        // Use the template's own copy for a new section when it has one.
        templateProps(type) {
            if (!this.defaults) return null;
            for (const page of this.defaults.pages) {
                const match = page.sections.find((s) => s.type === type);
                if (match) return match.props;
            }
            return null;
        }

        renderInspector() {
            const { page, index, section } = this.findSection(this.selected.page, this.selected.id);
            if (!section) { this.selected = null; return this.renderLayers(); }
            const type = this.catalog.sectionTypes[section.type];
            const fixedBooking = page.id === 'book' && section.type === 'booking';
            const wrap = h('div', { class: 'sb-inspector' });
            wrap.appendChild(h('div', { class: 'sb-inspector-head' },
                h('button', { type: 'button', class: 'sb-back', onClick: () => this.clearSelection() }, '← Layers'),
                h('div', { class: 'sb-inspector-title' }, h('span', { 'aria-hidden': 'true', text: type.icon }), h('div', {}, h('strong', { text: type.label }), h('small', { text: `${page.label} page · layer ${index + 1} of ${page.sections.length}` })))
            ));
            if (type.description) wrap.appendChild(h('p', { class: 'sb-hint', text: type.description }));
            if (section.type === 'services') wrap.appendChild(h('p', { class: 'sb-callout', text: 'Service names, prices and durations come from your Services page, so they are always accurate.' }));
            if (section.type === 'booking') wrap.appendChild(h('p', { class: 'sb-callout', text: 'Booking colours, payment options and form fields are set in the Booking widget tab and in Settings.' }));

            const fields = h('div', { class: 'sb-fields' });
            type.fields.forEach((field) => {
                const node = this.renderField(field, section.props, (key, value, opts) => this.change((site) => {
                    const target = this.findSection.call({ site }, page.id, section.id).section;
                    setPath(target.props, key, value);
                }, opts), `sec-${section.id}`);
                if (node) fields.appendChild(node);
            });
            wrap.appendChild(fields);

            wrap.appendChild(h('div', { class: 'sb-inspector-actions' },
                h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onClick: () => this.change((site) => { const t = this.findSection.call({ site }, page.id, section.id).section; t.visible = !t.visible; }), disabled: fixedBooking ? true : undefined }, section.visible ? 'Hide section' : 'Show section'),
                h('button', { type: 'button', class: 'btn btn-secondary btn-sm', disabled: section.type === 'booking' ? true : undefined, onClick: () => {
                    const id = uid(section.type);
                    this.change((site) => { const p = site.pages.find((x) => x.id === page.id); p.sections.splice(index + 1, 0, { ...clone(section), id }); });
                    this.selectSection(page.id, id);
                } }, 'Duplicate'),
                h('button', { type: 'button', class: 'btn btn-danger btn-sm', disabled: fixedBooking ? true : undefined, onClick: async () => {
                    const ok = await this.modalConfirm({ title: `Delete ${type.label}?`, body: 'You can undo this straight after.', confirm: 'Delete', danger: true });
                    if (!ok) return;
                    this.change((site) => { const p = site.pages.find((x) => x.id === page.id); p.sections.splice(index, 1); });
                    this.clearSelection();
                } }, 'Delete')
            ));
            return wrap;
        }

        renderStyle() {
            const wrap = h('div', { class: 'sb-fields' });
            wrap.appendChild(h('p', { class: 'sb-hint', text: 'Colours, fonts and shapes apply across every page. Pick a brand colour with strong contrast against its button text.' }));
            const palettes = this.paletteSuggestions();
            if (palettes.length) {
                wrap.appendChild(h('div', { class: 'sb-field' }, h('span', { class: 'sb-label', text: 'Quick palettes' }),
                    h('div', { class: 'sb-palettes' }, palettes.map((p) => h('button', {
                        type: 'button', class: 'sb-palette', title: p.name,
                        onClick: () => this.change((site) => { site.style.colors = { ...site.style.colors, ...p.colors }; site.style.mode = p.mode; })
                    }, h('span', { style: { background: p.colors.background } }), h('span', { style: { background: p.colors.primary } }), h('span', { style: { background: p.colors.accent } }), h('em', { text: p.name }))))));
            }
            this.catalog.styleFields.forEach((field) => {
                const node = this.renderField(field, this.site.style, (key, value, opts) => this.change((site) => setPath(site.style, key, value), opts), 'style');
                if (node) wrap.appendChild(node);
            });
            const contrast = this.contrastWarning();
            if (contrast) wrap.appendChild(h('p', { class: 'sb-warning', text: contrast }));
            wrap.appendChild(h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => this.change((site) => { site.style = clone(this.defaults.style); }) }, '↺ Reset style to the template'));
            return wrap;
        }

        paletteSuggestions() {
            const base = this.defaults?.style?.colors;
            const list = [];
            if (base) list.push({ name: 'Template', mode: this.defaults.style.mode, colors: base });
            list.push(
                { name: 'Midnight gold', mode: 'dark', colors: { background: '#0f1115', surface: '#181b22', text: '#f4f1ea', muted: '#a8a397', primary: '#d4af37', primaryText: '#14110a', accent: '#f0d58c', heroText: '#ffffff' } },
                { name: 'Island fresh', mode: 'light', colors: { background: '#fbfdfb', surface: '#eef6f1', text: '#10291d', muted: '#4f6b5c', primary: '#0f9d58', primaryText: '#ffffff', accent: '#ffcc00', heroText: '#ffffff' } },
                { name: 'Coral sunset', mode: 'light', colors: { background: '#fffaf7', surface: '#fff0e8', text: '#2d1a14', muted: '#7d5d52', primary: '#e8604c', primaryText: '#ffffff', accent: '#f6b26b', heroText: '#ffffff' } },
                { name: 'Royal ink', mode: 'dark', colors: { background: '#0c0e1d', surface: '#151934', text: '#eef0ff', muted: '#a0a6cc', primary: '#7c6ef7', primaryText: '#ffffff', accent: '#4fd1c5', heroText: '#ffffff' } },
                { name: 'Soft blush', mode: 'light', colors: { background: '#fff8f8', surface: '#fdecee', text: '#3a1f26', muted: '#8a6670', primary: '#c25b7a', primaryText: '#ffffff', accent: '#f3b8a5', heroText: '#ffffff' } }
            );
            return list;
        }

        contrastWarning() {
            const c = this.site.style.colors || {};
            const lum = (hex) => {
                const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
                if (!m) return null;
                const v = parseInt(m[1], 16);
                return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; })
                    .reduce((acc, x, i) => acc + x * [0.2126, 0.7152, 0.0722][i], 0);
            };
            const ratio = (a, b) => { const la = lum(a); const lb = lum(b); if (la === null || lb === null) return 21; return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
            if (ratio(c.text, c.background) < 4.5) return '⚠️ Main text is hard to read on the page background. Increase the contrast.';
            if (ratio(c.primaryText, c.primary) < 3) return '⚠️ Button text is hard to read on your brand colour. Try white or black button text.';
            return null;
        }

        renderInfo() {
            const wrap = h('div', { class: 'sb-groups' });
            const groups = [
                ['brand', 'Brand & logo', 'Your logo and name appear in the menu, footer and browser tab.'],
                ['contact', 'Contact details', 'Shown in the Contact section, footer and mobile menu.'],
                ['nav', 'Menu', 'How the top navigation looks and behaves.'],
                ['announcement', 'Announcement bar', 'A slim banner above the menu for promotions or notices.'],
                ['social', 'Social links', 'Paste the full link to each profile.'],
                ['seo', 'Google & sharing', 'What appears in Google results and link previews.'],
                ['footer', 'Footer', '']
            ];
            groups.forEach(([key, title, hint], index) => {
                const body = h('div', { class: 'sb-fields' });
                if (hint) body.appendChild(h('p', { class: 'sb-hint', text: hint }));
                (this.catalog.globalFields[key] || []).forEach((field) => {
                    const node = this.renderField(field, this.site[key] || {}, (path, value, opts) => this.change((site) => { site[key] = site[key] || {}; setPath(site[key], path, value); }, opts), `g-${key}`);
                    if (node) body.appendChild(node);
                });
                wrap.appendChild(h('details', { class: 'sb-group', open: index === 0 ? true : undefined }, h('summary', { text: title }), body));
            });
            return wrap;
        }

        renderMusic() {
            const wrap = h('div', { class: 'sb-fields' });
            wrap.appendChild(h('p', { class: 'sb-hint', text: 'Add theme music that plays while customers browse. Browsers block sound until a visitor taps the page, so a small "Play music" button appears and music starts on their first tap.' }));
            (this.catalog.globalFields.music || []).forEach((field) => {
                const node = this.renderField(field, this.site.music || {}, (path, value, opts) => this.change((site) => { site.music = site.music || {}; setPath(site.music, path, value); }, opts), 'music');
                if (node) wrap.appendChild(node);
            });
            wrap.appendChild(h('div', { class: 'sb-inline-buttons' },
                h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onClick: () => this.post({ type: 'icss:site-music', play: true }) }, '▶ Play in preview'),
                h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onClick: () => this.post({ type: 'icss:site-music', play: false }) }, '❚❚ Stop')));
            wrap.appendChild(h('p', { class: 'sb-callout', text: 'Only upload music you own or have a licence to use publicly. Royalty-free libraries such as YouTube Audio Library or Pixabay Music are good sources.' }));
            return wrap;
        }

        renderMediaTab() {
            const wrap = h('div', { class: 'sb-media-tab' });
            wrap.appendChild(this.renderGuideTable());
            if (this.mode === 'tenant') {
                const pct = this.mediaUsage.quota ? Math.min(100, (this.mediaUsage.used / this.mediaUsage.quota) * 100) : 0;
                wrap.appendChild(h('div', { class: 'sb-usage' },
                    h('div', { class: 'sb-usage-bar' }, h('span', { style: { width: `${pct}%` } })),
                    h('small', { text: `${formatBytes(this.mediaUsage.used || 0)} of ${formatBytes(this.mediaUsage.quota || 0)} used` })));
            }
            wrap.appendChild(h('label', { class: 'btn btn-primary sb-upload-btn' }, '⬆ Upload photos, video or music',
                h('input', { type: 'file', accept: 'image/*,video/mp4,video/webm,video/quicktime,audio/*', multiple: true, hidden: true, onChange: async (e) => {
                    for (const file of e.target.files) {
                        try { await this.uploadFile(file, null); } catch (err) { this.toast(err.message, 'error'); }
                    }
                    this.renderPanel();
                } })));
            const grid = h('div', { class: 'sb-media-grid' });
            if (!this.media.length) grid.appendChild(h('p', { class: 'sb-muted', text: 'No uploads yet. Files you upload anywhere in the builder are kept here for reuse.' }));
            this.media.forEach((item) => grid.appendChild(h('div', { class: 'sb-media-item' },
                this.mediaThumb(item.url, item.kind),
                h('div', { class: 'sb-media-meta' },
                    h('strong', { text: item.filename || item.kind }),
                    h('small', { text: [formatBytes(item.size_bytes), item.width && item.height ? `${item.width}×${item.height}` : '', item.duration_seconds ? `${Math.round(item.duration_seconds)}s` : ''].filter(Boolean).join(' · ') })),
                this.mode === 'tenant' && h('button', { type: 'button', class: 'sb-mini', 'aria-label': 'Delete file', title: 'Delete file', onClick: async () => {
                    const used = JSON.stringify(this.site).includes(item.url);
                    const ok = await this.modalConfirm({ title: 'Delete this file?', body: used ? 'This file is used on your website. Deleting it will leave an empty space there until you replace it.' : 'This permanently removes the file from your library.', confirm: 'Delete', danger: true });
                    if (!ok) return;
                    try { await this.api.deleteMedia(item.id); await this.loadMedia(); this.renderPanel(); } catch (err) { this.toast(err.message, 'error'); }
                } }, '🗑'))));
            wrap.appendChild(grid);
            return wrap;
        }

        renderGuideTable() {
            const guide = this.catalog.mediaGuide;
            const labels = { heroImage: 'Hero photo', heroMobileImage: 'Hero photo (phones)', heroVideo: 'Hero / background video', poster: 'Video poster', bannerImage: 'Page banners', featureImage: 'Text + image photos', galleryImage: 'Gallery photos', teamPhoto: 'Team photos', logo: 'Logo', music: 'Theme music' };
            return h('details', { class: 'sb-group', open: true }, h('summary', { text: '📐 Size & quality guide' }),
                h('p', { class: 'sb-hint', text: 'Follow these sizes for sharp results that still load fast on phones. Photos you upload are automatically resized and compressed.' }),
                h('div', { class: 'sb-guide-table' }, Object.entries(guide).map(([key, g]) => h('div', { class: 'sb-guide-row' },
                    h('strong', { text: labels[key] || key }),
                    h('span', { text: `${g.ratio} · ${g.size}` }),
                    h('small', { text: g.format })))));
        }

        // ── Generic field renderer ──────────────────────────────────────────
        renderField(field, holder, onChange, scope) {
            if (field.showIf) {
                const visible = Object.entries(field.showIf).every(([key, values]) => values.includes(getPath(holder, key)));
                if (!visible) return null;
            }
            const value = getPath(holder, field.key);
            const id = `${scope}-${field.key}`.replace(/[^A-Za-z0-9_-]/g, '-');
            const label = h('label', { class: 'sb-label', for: id, text: field.label });

            switch (field.type) {
                case 'text':
                    return h('div', { class: 'sb-field' }, label, h('input', { id, type: 'text', class: 'sb-input', value: value ?? '', maxlength: '400',
                        onInput: (e) => onChange(field.key, e.target.value, { rerender: false, coalesce: id }) }));
                case 'textarea':
                    return h('div', { class: 'sb-field' }, label, h('textarea', { id, class: 'sb-input', rows: String(field.rows || 3), maxlength: '3000',
                        onInput: (e) => onChange(field.key, e.target.value, { rerender: false, coalesce: id }) }, value ?? ''));
                case 'select':
                    return h('div', { class: 'sb-field' }, label, h('select', { id, class: 'sb-input', onChange: (e) => onChange(field.key, e.target.value) },
                        field.options.map((opt) => h('option', { value: opt.value, selected: opt.value === value ? true : undefined, text: opt.label }))));
                case 'toggle':
                    return h('label', { class: 'sb-toggle' }, h('input', { type: 'checkbox', checked: value ? true : undefined, onChange: (e) => onChange(field.key, e.target.checked) }),
                        h('span', { class: 'sb-toggle-ui', 'aria-hidden': 'true' }), h('span', { text: field.label }));
                case 'range': {
                    const out = h('output', { text: field.max <= 1 ? `${Math.round((value ?? 0) * 100)}%` : String(value ?? 0) });
                    return h('div', { class: 'sb-field' }, h('div', { class: 'sb-label-row' }, label, out),
                        h('input', { id, type: 'range', min: String(field.min), max: String(field.max), step: String(field.step), value: String(value ?? field.min),
                            onInput: (e) => { const v = Number(e.target.value); out.textContent = field.max <= 1 ? `${Math.round(v * 100)}%` : String(v); onChange(field.key, v, { rerender: false, coalesce: id }); } }));
                }
                case 'color': {
                    const safe = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
                    const hex = h('input', { type: 'text', class: 'sb-input sb-hex', value: safe, maxlength: '7', 'aria-label': `${field.label} hex value`,
                        onChange: (e) => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(field.key, e.target.value); } });
                    return h('div', { class: 'sb-field sb-color' }, label, h('div', { class: 'sb-color-row' },
                        h('input', { id, type: 'color', value: safe, onInput: (e) => { hex.value = e.target.value; onChange(field.key, e.target.value, { rerender: false, coalesce: id }); } }), hex));
                }
                case 'media':
                    return this.renderMediaField(field, value, onChange, id);
                case 'list':
                    return this.renderListField(field, Array.isArray(value) ? value : [], onChange, id);
                default:
                    return null;
            }
        }

        renderMediaField(field, value, onChange, id) {
            const guide = this.catalog.mediaGuide[field.guide];
            const status = h('div', { class: 'sb-upload-status', hidden: true });
            const preview = h('div', { class: 'sb-media-preview' }, value ? this.mediaThumb(value, field.accept) : h('span', { class: 'sb-muted', text: 'Nothing selected' }));
            const urlInput = h('input', { id, type: 'url', class: 'sb-input', placeholder: field.allowExternal ? 'Paste a link (MP4, YouTube or Vimeo)…' : 'Paste a link or upload…', value: value || '',
                onChange: (e) => onChange(field.key, e.target.value.trim()) });
            const accept = field.accept === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : field.accept === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/x-m4a';
            const fileInput = h('input', { type: 'file', accept, hidden: true, onChange: async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                status.hidden = false;
                status.className = 'sb-upload-status';
                status.replaceChildren(h('div', { class: 'sb-progress' }, h('span', { style: { width: '4%' } })), h('small', { text: `Preparing ${file.name}…` }));
                try {
                    const result = await this.uploadFile(file, field.guide, (pct, text) => {
                        status.querySelector('.sb-progress span').style.width = `${pct}%`;
                        status.querySelector('small').textContent = text;
                    });
                    onChange(field.key, result.url);
                    if (result.warnings.length) this.toast(result.warnings[0], 'warning');
                } catch (err) {
                    status.className = 'sb-upload-status is-error';
                    status.replaceChildren(h('small', { text: err.message }));
                }
            } });
            const buttons = h('div', { class: 'sb-inline-buttons' },
                h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onClick: () => fileInput.click() }, '⬆ Upload'),
                (this.media.some((m) => m.kind === field.accept)) && h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onClick: () => this.openLibrary(field.accept, (url) => onChange(field.key, url)) }, '📁 Library'),
                value && h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onClick: () => onChange(field.key, '') }, 'Remove'),
                fileInput);
            const guideBox = guide && h('div', { class: 'sb-guide' },
                h('div', {}, h('span', { 'aria-hidden': 'true', text: '📐 ' }), h('strong', { text: guide.ratio }), ` · ${guide.size}`),
                h('div', { text: guide.format }),
                guide.tip && h('div', { class: 'sb-guide-tip', text: guide.tip }));
            return h('div', { class: 'sb-field sb-media-field' }, h('span', { class: 'sb-label', text: field.label }), preview, buttons, status, urlInput, guideBox);
        }

        mediaThumb(url, kind) {
            if (kind === 'audio' || /\.(mp3|m4a|aac|ogg|wav)(\?|$)/i.test(url)) return h('div', { class: 'sb-thumb sb-thumb-audio' }, h('span', { text: '🎵' }), h('audio', { src: url, controls: true, preload: 'none' }));
            if (kind === 'video' || /\.(mp4|webm|mov)(\?|$)/i.test(url)) {
                if (/youtube|youtu\.be|vimeo/i.test(url)) return h('div', { class: 'sb-thumb sb-thumb-icon', text: '▶ Linked video' });
                return h('video', { class: 'sb-thumb', src: url, muted: true, preload: 'metadata', playsinline: true });
            }
            const img = h('img', { class: 'sb-thumb', src: url, alt: '', loading: 'lazy' });
            img.addEventListener('error', () => img.replaceWith(h('div', { class: 'sb-thumb sb-thumb-icon', text: 'Image unavailable' })));
            return img;
        }

        renderListField(field, items, onChange, id) {
            const wrap = h('div', { class: 'sb-field sb-list' }, h('span', { class: 'sb-label', text: field.label }));
            items.forEach((item, index) => {
                const title = item.title || item.name || item.caption || item.q || item.day || item.value || `${field.itemLabel} ${index + 1}`;
                const body = h('div', { class: 'sb-fields' });
                field.fields.forEach((sub) => {
                    const node = this.renderField(sub, item, (key, value, opts) => {
                        const next = clone(items);
                        setPath(next[index], key, value);
                        onChange(field.key, next, opts);
                    }, `${id}-${index}`);
                    if (node) body.appendChild(node);
                });
                const move = (delta) => {
                    const next = clone(items);
                    const target = index + delta;
                    if (target < 0 || target >= next.length) return;
                    [next[index], next[target]] = [next[target], next[index]];
                    onChange(field.key, next);
                };
                wrap.appendChild(h('details', { class: 'sb-list-item' },
                    h('summary', {},
                        h('span', { class: 'sb-list-title', text: String(title).slice(0, 48) }),
                        h('span', { class: 'sb-row-actions' },
                            h('button', { type: 'button', class: 'sb-mini', 'aria-label': 'Move up', disabled: index === 0 ? true : undefined, onClick: (e) => { e.preventDefault(); move(-1); } }, '↑'),
                            h('button', { type: 'button', class: 'sb-mini', 'aria-label': 'Move down', disabled: index === items.length - 1 ? true : undefined, onClick: (e) => { e.preventDefault(); move(1); } }, '↓'),
                            h('button', { type: 'button', class: 'sb-mini', 'aria-label': 'Remove', onClick: (e) => { e.preventDefault(); onChange(field.key, items.filter((_, i) => i !== index)); } }, '✕'))),
                    body));
            });
            if (items.length < 24) {
                wrap.appendChild(h('button', { type: 'button', class: 'sb-add', onClick: () => onChange(field.key, [...clone(items), {}]) }, `+ Add ${field.itemLabel.toLowerCase()}`));
            }
            const galleryLike = field.fields.length <= 2 && field.fields[0]?.type === 'media';
            if (galleryLike) {
                wrap.appendChild(h('label', { class: 'sb-add sb-add-upload' }, '⬆ Upload several photos at once',
                    h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true, onChange: async (e) => {
                        const added = [];
                        for (const file of [...e.target.files].slice(0, 24 - items.length)) {
                            try {
                                const result = await this.uploadFile(file, field.fields[0].guide);
                                added.push({ [field.fields[0].key]: result.url });
                            } catch (err) { this.toast(err.message, 'error'); }
                        }
                        if (added.length) onChange(field.key, [...clone(items), ...added]);
                    } })));
            }
            return wrap;
        }

        // ── Media handling ──────────────────────────────────────────────────
        async loadMedia() {
            if (!this.api) return;
            try {
                const data = await this.api.listMedia();
                this.media = data.media || [];
                this.mediaUsage = { used: data.used_bytes || 0, quota: data.quota_bytes || 0 };
            } catch (err) {
                console.warn('Media library unavailable:', err.message);
            }
        }

        openLibrary(kind, onPick) {
            const items = this.media.filter((m) => m.kind === kind);
            const close = this.modal(h('div', { class: 'sb-library' }, items.map((item) => h('button', {
                type: 'button', class: 'sb-library-item', onClick: () => { close(); onPick(item.url); }
            }, this.mediaThumb(item.url, item.kind), h('small', { text: item.filename || '' })))), { title: 'Choose from your library', wide: true });
        }

        readImage(file) {
            return new Promise((resolve, reject) => {
                const url = URL.createObjectURL(file);
                const img = new Image();
                img.onload = () => resolve({ img, url });
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read. Try a JPG or PNG.')); };
                img.src = url;
            });
        }

        readMediaMeta(file, tag) {
            return new Promise((resolve) => {
                const url = URL.createObjectURL(file);
                const el = document.createElement(tag);
                el.preload = 'metadata';
                el.onloadedmetadata = () => { resolve({ width: el.videoWidth || null, height: el.videoHeight || null, duration: el.duration || null }); URL.revokeObjectURL(url); };
                el.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
                el.src = url;
            });
        }

        async optimiseImage(file, guideKey) {
            const { img, url } = await this.readImage(file);
            const maxEdge = IMAGE_MAX_EDGE[guideKey] || 1800;
            const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
            const width = Math.round(img.naturalWidth * scale);
            const height = Math.round(img.naturalHeight * scale);
            const keepPng = file.type === 'image/png' && guideKey === 'logo';
            const isGif = file.type === 'image/gif';
            if (isGif || (scale === 1 && file.size < 350 * 1024 && !keepPng && file.type !== 'image/png')) {
                URL.revokeObjectURL(url);
                return { blob: file, width: img.naturalWidth, height: img.naturalHeight, originalWidth: img.naturalWidth, originalHeight: img.naturalHeight };
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            const toBlob = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
            let blob = keepPng ? await toBlob('image/png') : await toBlob('image/webp', 0.82);
            if (!blob || (!keepPng && blob.type !== 'image/webp')) blob = await toBlob('image/jpeg', 0.84);
            return { blob, width, height, originalWidth: img.naturalWidth, originalHeight: img.naturalHeight };
        }

        async uploadFile(file, guideKey, onProgress = () => {}) {
            const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : null;
            if (!kind) throw new Error('Unsupported file type.');
            const warnings = [];
            let blob = file;
            let meta = {};
            const guide = guideKey || (kind === 'video' ? 'heroVideo' : kind === 'audio' ? 'music' : 'galleryImage');

            if (kind === 'image') {
                onProgress(10, 'Optimising photo…');
                const result = await this.optimiseImage(file, guide);
                blob = result.blob;
                meta = { width: result.width, height: result.height };
                const target = RATIO_TARGETS[guide];
                const actual = result.originalWidth / result.originalHeight;
                if (target && Math.abs(actual - target) / target > 0.12) {
                    warnings.push(`This photo is ${ratioLabel(actual)}; ${ratioLabel(target)} works best here, so some edges will be cropped.`);
                }
                if (MIN_WIDTH[guide] && result.originalWidth < MIN_WIDTH[guide]) {
                    warnings.push(`This photo is only ${result.originalWidth}px wide and may look soft. Aim for at least ${MIN_WIDTH[guide]}px.`);
                }
            } else {
                meta = await this.readMediaMeta(file, kind === 'video' ? 'video' : 'audio');
                if (kind === 'video') {
                    if (file.size > 40 * 1024 * 1024) throw new Error('Videos must be under 40 MB. Export at 1080p or 720p, 8–20 seconds, without sound.');
                    if (file.size > 15 * 1024 * 1024) warnings.push(`This video is ${formatBytes(file.size)}. Under 15 MB loads much faster on phones.`);
                    if (meta.duration > 30) warnings.push(`This video is ${Math.round(meta.duration)} seconds. A short 8–20 second loop works best as a background.`);
                    if (meta.width && meta.height && Math.abs(meta.width / meta.height - 16 / 9) > 0.2) warnings.push('Background videos look best in 16:9 landscape.');
                } else {
                    if (file.size > 12 * 1024 * 1024) throw new Error('Music must be under 12 MB. Export as MP3 at 128–192 kbps.');
                    if (file.size > 5 * 1024 * 1024) warnings.push(`This track is ${formatBytes(file.size)}. Under 5 MB starts faster for visitors.`);
                }
            }

            if (this.mode === 'demo' || !this.api) {
                const url = URL.createObjectURL(blob);
                this.media.unshift({ id: url, kind, url, filename: file.name, size_bytes: blob.size, width: meta.width, height: meta.height, duration_seconds: meta.duration });
                onProgress(100, 'Ready (playground only — not saved)');
                return { url, warnings };
            }

            const media = await this.api.uploadMedia(blob, {
                filename: file.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/webp' ? '.webp' : blob.type === 'image/jpeg' && kind === 'image' ? '.jpg' : file.name.match(/\.[^.]+$/)?.[0] || ''),
                ...meta
            }, (pct) => onProgress(15 + pct * 0.85, `Uploading… ${Math.round(pct)}%`));
            await this.loadMedia();
            onProgress(100, `Uploaded ${formatBytes(media.size_bytes)}`);
            return { url: media.url, warnings };
        }

        // ── Modals & toasts ─────────────────────────────────────────────────
        modal(content, { title, wide } = {}) {
            const overlay = h('div', { class: 'sb-modal-overlay' });
            const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
            const onKey = (e) => { if (e.key === 'Escape') close(); };
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
            overlay.appendChild(h('div', { class: `sb-modal ${wide ? 'sb-modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true' },
                h('div', { class: 'sb-modal-head' }, h('h3', { text: title || '' }), h('button', { type: 'button', class: 'sb-mini', 'aria-label': 'Close', onClick: close }, '✕')),
                content));
            document.body.appendChild(overlay);
            document.addEventListener('keydown', onKey);
            overlay.querySelector('button')?.focus();
            return close;
        }

        modalConfirm({ title, body, confirm, danger }) {
            return new Promise((resolve) => {
                let done = false;
                const finish = (value) => { if (done) return; done = true; close(); resolve(value); };
                const close = this.modal(h('div', { class: 'sb-confirm' },
                    h('p', { text: body }),
                    h('div', { class: 'sb-inline-buttons sb-confirm-actions' },
                        h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => finish(false) }, 'Cancel'),
                        h('button', { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onClick: () => finish(true) }, confirm))), { title });
                const observer = new MutationObserver(() => { if (!document.body.contains(document.querySelector('.sb-confirm'))) { observer.disconnect(); if (!done) { done = true; resolve(false); } } });
                observer.observe(document.body, { childList: true });
            });
        }

        toast(message, type = 'success') {
            if (typeof global.showToast === 'function') { global.showToast(message, type === 'warning' ? 'success' : type); return; }
            const el = h('div', { class: `sb-toast sb-toast-${type}`, text: message });
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 4200);
        }
    }

    // ── API adapter for the tenant admin ────────────────────────────────────
    SiteBuilder.tenantApi = function tenantApi(slug, apiFetch, getToken) {
        const base = `/api/v1/tenants/${encodeURIComponent(slug)}`;
        return {
            loadSite: () => apiFetch(`${base}/site`),
            saveDraft: (site) => apiFetch(`${base}/site/draft`, { method: 'PUT', body: { site } }),
            publish: (site) => apiFetch(`${base}/site/publish`, { method: 'POST', body: { site } }),
            discard: () => apiFetch(`${base}/site/draft`, { method: 'DELETE' }),
            listMedia: () => apiFetch(`${base}/media`),
            deleteMedia: (id) => apiFetch(`${base}/media/${id}`, { method: 'DELETE' }),
            uploadMedia: (blob, meta, onProgress) => new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${base}/media`);
                const token = getToken();
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.setRequestHeader('X-Tenant-Slug', slug);
                xhr.setRequestHeader('Content-Type', blob.type);
                xhr.setRequestHeader('X-File-Name', encodeURIComponent(meta.filename || 'upload'));
                if (meta.width) xhr.setRequestHeader('X-Media-Width', String(meta.width));
                if (meta.height) xhr.setRequestHeader('X-Media-Height', String(meta.height));
                if (meta.duration) xhr.setRequestHeader('X-Media-Duration', String(meta.duration));
                xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress((e.loaded / e.total) * 100); };
                xhr.onload = () => {
                    let data = {};
                    try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
                    if (xhr.status >= 200 && xhr.status < 300) resolve(data.media);
                    else reject(new Error(data.error || (xhr.status === 413 ? 'That file is too large.' : `Upload failed (${xhr.status}).`)));
                };
                xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
                xhr.send(blob);
            })
        };
    };

    global.SiteBuilder = SiteBuilder;
})(window);
