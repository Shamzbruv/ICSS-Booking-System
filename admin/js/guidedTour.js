(function initializeGuidedTour(global) {
    const MOBILE_BREAKPOINT = 720;
    const COMPACT_SIDEBAR_BREAKPOINT = 900;
    const MOBILE_MARGIN = 16;
    const DESKTOP_MARGIN = 20;
    const TARGET_GAP = 18;
    const SPOTLIGHT_COLLISION_PADDING = 12;

    class GuidedTour {
        constructor(options = {}) {
            this.steps = Array.isArray(options.steps) ? options.steps : [];
            this.storageKey = options.storageKey || 'guidedTourCompleted';
            this.currentStep = 0;
            this.currentTarget = null;
            this.currentState = null;
            this.isOpen = false;
            this.isPreparingStep = false;
            this.pendingViewportRefresh = false;
            this.renderToken = 0;
            this.repositionFrame = 0;
            this.previouslyFocused = null;
            this.boundHandleKeydown = this.handleKeydown.bind(this);
            this.boundHandleViewportChange = this.handleViewportChange.bind(this);
            this.build();
        }

        build() {
            this.root = document.createElement('div');
            this.root.className = 'tour-root';
            this.root.hidden = true;
            this.root.innerHTML = `
                <div class="tour-overlay" aria-hidden="true"></div>
                <div class="tour-spotlight" aria-hidden="true"></div>
                <section
                    class="tour-card"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="guidedTourTitle"
                    aria-describedby="guidedTourMessage"
                    tabindex="-1"
                >
                    <div class="tour-card__accent" aria-hidden="true"></div>
                    <div class="tour-step-row">
                        <span class="tour-step-count" id="guidedTourStepCount">Step 1 of 1</span>
                        <span class="tour-step-hint">Guided walkthrough</span>
                    </div>
                    <div class="tour-progress" aria-hidden="true">
                        <span class="tour-progress-fill"></span>
                    </div>
                    <p class="tour-context-label" id="guidedTourContextLabel" hidden></p>
                    <div class="tour-copy">
                        <h2 class="tour-title" id="guidedTourTitle"></h2>
                        <p class="tour-message" id="guidedTourMessage"></p>
                    </div>
                    <div class="tour-actions">
                        <button type="button" class="btn btn-secondary tour-back-btn">Back</button>
                        <button type="button" class="btn btn-secondary tour-skip-btn">Skip Tutorial</button>
                        <button type="button" class="btn btn-secondary tour-show-btn" hidden>Show me</button>
                        <button type="button" class="btn btn-primary tour-next-btn">Okay, Next</button>
                    </div>
                </section>
            `;

            document.body.appendChild(this.root);

            this.overlay = this.root.querySelector('.tour-overlay');
            this.spotlight = this.root.querySelector('.tour-spotlight');
            this.card = this.root.querySelector('.tour-card');
            this.stepCount = this.root.querySelector('.tour-step-count');
            this.progressFill = this.root.querySelector('.tour-progress-fill');
            this.contextLabelEl = this.root.querySelector('.tour-context-label');
            this.titleEl = this.root.querySelector('.tour-title');
            this.messageEl = this.root.querySelector('.tour-message');
            this.backButton = this.root.querySelector('.tour-back-btn');
            this.skipButton = this.root.querySelector('.tour-skip-btn');
            this.showButton = this.root.querySelector('.tour-show-btn');
            this.nextButton = this.root.querySelector('.tour-next-btn');

            this.backButton.addEventListener('click', () => this.previous());
            this.skipButton.addEventListener('click', () => this.skip());
            this.showButton.addEventListener('click', () => this.showCurrentTargetOnMobile());
            this.nextButton.addEventListener('click', () => this.next());
            this.overlay.addEventListener('click', () => {
                if (this.card) this.card.focus({ preventScroll: true });
            });
        }

        start(options = {}) {
            const force = options.force === true;
            const requestedStep = Number.isInteger(options.stepIndex) ? options.stepIndex : 0;
            if (!this.steps.length) return false;
            if (!force && this.isCompleted()) return false;

            this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            this.currentStep = Math.max(0, Math.min(this.steps.length - 1, requestedStep));
            this.isOpen = true;
            this.root.hidden = false;
            this.root.classList.add('is-open');
            document.body.classList.add('tour-open');
            this.attachEvents();
            this.renderCurrentStep();
            return true;
        }

        next() {
            if (!this.isOpen) return;
            if (this.currentStep >= this.steps.length - 1) {
                this.finish();
                return;
            }
            this.currentStep += 1;
            this.renderCurrentStep();
        }

        previous() {
            if (!this.isOpen || this.currentStep === 0) return;
            this.currentStep -= 1;
            this.renderCurrentStep();
        }

        skip() {
            this.markCompleted();
            this.close();
        }

        finish() {
            this.markCompleted();
            this.close();
        }

        close() {
            this.isOpen = false;
            this.isPreparingStep = false;
            this.pendingViewportRefresh = false;
            this.renderToken += 1;
            this.detachEvents();
            this.clearHighlight();
            this.root.classList.remove('is-open', 'is-preparing', 'has-spotlight', 'tour-peek-mode');
            this.root.hidden = true;
            document.body.classList.remove('tour-open', 'tour-lock-scroll');
            this.releaseSidebarLayer();
            this.resetCardPosition();

            if (this.repositionFrame) {
                global.cancelAnimationFrame(this.repositionFrame);
                this.repositionFrame = 0;
            }

            if (this.previouslyFocused && typeof this.previouslyFocused.focus === 'function') {
                this.previouslyFocused.focus({ preventScroll: true });
            }
        }

        isCompleted() {
            try {
                return global.localStorage.getItem(this.storageKey) === 'true';
            } catch {
                return false;
            }
        }

        markCompleted() {
            try {
                global.localStorage.setItem(this.storageKey, 'true');
            } catch {
                // Ignore storage errors so the tour can still finish gracefully.
            }
        }

        attachEvents() {
            global.addEventListener('keydown', this.boundHandleKeydown);
            global.addEventListener('resize', this.boundHandleViewportChange, { passive: true });
            global.addEventListener('scroll', this.boundHandleViewportChange, { passive: true, capture: true });

            if (global.visualViewport) {
                global.visualViewport.addEventListener('resize', this.boundHandleViewportChange, { passive: true });
                global.visualViewport.addEventListener('scroll', this.boundHandleViewportChange, { passive: true });
            }
        }

        detachEvents() {
            global.removeEventListener('keydown', this.boundHandleKeydown);
            global.removeEventListener('resize', this.boundHandleViewportChange);
            global.removeEventListener('scroll', this.boundHandleViewportChange, true);

            if (global.visualViewport) {
                global.visualViewport.removeEventListener('resize', this.boundHandleViewportChange);
                global.visualViewport.removeEventListener('scroll', this.boundHandleViewportChange);
            }
        }

        handleKeydown(event) {
            if (!this.isOpen) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                this.skip();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                this.next();
            } else if (event.key === 'ArrowLeft' && this.currentStep > 0) {
                event.preventDefault();
                this.previous();
            }
        }

        handleViewportChange() {
            if (!this.isOpen) return;

            // Don't reposition while we are in a mobile peek (Show me) sequence.
            if (this.root.classList.contains('tour-peek-mode')) return;

            if (this.isPreparingStep) {
                this.pendingViewportRefresh = true;
                return;
            }

            if (this.repositionFrame) {
                global.cancelAnimationFrame(this.repositionFrame);
            }

            this.repositionFrame = global.requestAnimationFrame(() => {
                this.repositionFrame = 0;
                if (!this.isOpen) return;
                this.renderCurrentStep();
            });
        }

        async renderCurrentStep() {
            if (!this.isOpen) return;

            const step = this.steps[this.currentStep];
            if (!step) {
                this.finish();
                return;
            }

            const token = ++this.renderToken;
            this.isPreparingStep = true;
            this.pendingViewportRefresh = false;
            this.root.classList.add('is-preparing');
            document.body.classList.remove('tour-lock-scroll');

            try {
                this.updateCard(step);
                this.clearHighlight();

                const state = await this.prepareStep(step, token);
                if (!this.isOpen || token !== this.renderToken) return;

                this.applyLayout(state);
                this.currentState = state;
                this.currentTarget = state.target || null;
                this.card.focus({ preventScroll: true });
            } finally {
                if (this.isOpen && token === this.renderToken) {
                    this.root.classList.remove('is-preparing');
                    document.body.classList.add('tour-lock-scroll');
                }
                this.isPreparingStep = false;

                if (this.pendingViewportRefresh && this.isOpen && token === this.renderToken) {
                    this.pendingViewportRefresh = false;
                    this.handleViewportChange();
                }
            }
        }

        updateCard(step) {
            const stepNumber = this.currentStep + 1;
            const totalSteps = this.steps.length;
            const isFirstStep = this.currentStep === 0;
            const isLastStep = this.currentStep === totalSteps - 1;
            // Use window.innerWidth (layout viewport) — not visualViewport.width — so that
            // zoom level and on-screen keyboard changes on desktop don't cause a false mobile read.
            const isMobile = global.innerWidth <= MOBILE_BREAKPOINT;
            const message = isMobile && step.mobileMessage ? step.mobileMessage : (step.message || '');

            this.stepCount.textContent = `Step ${stepNumber} of ${totalSteps}`;
            this.titleEl.textContent = step.title || 'Guided Tour';
            this.messageEl.textContent = message;
            this.progressFill.style.width = `${(stepNumber / totalSteps) * 100}%`;
            this.backButton.disabled = isFirstStep;
            this.backButton.classList.toggle('is-disabled', isFirstStep);
            this.skipButton.hidden = isLastStep;
            this.nextButton.textContent = isLastStep ? 'I understand' : 'Okay, Next';

            // Show me button: only on mobile when the step has a target to preview.
            const hasTarget = !!(step.mobileTarget || step.target);
            this.showButton.hidden = !(isMobile && hasTarget);

            // Context label: always shown on mobile when there is a label or target.
            if (this.contextLabelEl) {
                const label = step.mobileContextLabel || step.title || '';
                const shouldShow = isMobile && !!(label && hasTarget);
                this.contextLabelEl.textContent = shouldShow ? `Related area: ${label}` : '';
                this.contextLabelEl.hidden = !shouldShow;
            }
        }

        async prepareStep(step, token) {
            const state = await this.buildStepState(step, token);
            if (!this.isOpen || token !== this.renderToken) return state;

            // Mobile always uses modal-only mode. No live target highlighting.
            if (state.isMobile) {
                return {
                    ...state,
                    target: null,
                    mode: 'mobile-modal',
                    spotlightEnabled: false,
                    mobileContextFocus: false
                };
            }

            // Desktop: center mode or anchored spotlight.
            if (state.mode === 'center') {
                state.target = null;
                state.spotlightEnabled = false;
                return state;
            }

            return this.prepareDesktopStep(state, token);
        }

        async buildStepState(step, token) {
            const initialViewport = this.getViewportRect();
            const isMobile = initialViewport.width <= MOBILE_BREAKPOINT;
            const compactSidebar = initialViewport.width <= COMPACT_SIDEBAR_BREAKPOINT;
            const reduceMotion = this.prefersReducedMotion();

            // ── Mobile: clean modal state, no target resolution, no sidebar magic ──
            if (isMobile) {
                this.releaseSidebarLayer();

                if (typeof global.closeSidebar === 'function') {
                    global.closeSidebar();
                }

                await this.wait(80, token);
                if (!this.isOpen || token !== this.renderToken) {
                    return this.createFallbackState(step, true);
                }

                const viewport = this.getViewportRect();
                const safe = this.getSafeArea(viewport);

                return {
                    step,
                    isMobile: true,
                    compactSidebar,
                    sidebarTarget: false,
                    viewport,
                    safe,
                    target: null,
                    placement: 'mobile-bottom',
                    mode: 'mobile-modal',
                    reduceMotion,
                    spotlightEnabled: false,
                    mobileContextFocus: false
                };
            }

            // ── Desktop: resolve target and compute layout mode ──
            let target = this.resolveTarget(step, false);
            let sidebarTarget = this.isSidebarTarget(target);

            await this.syncSidebarState(sidebarTarget && compactSidebar, token);
            if (!this.isOpen || token !== this.renderToken) {
                return this.createFallbackState(step, false);
            }

            const viewport = this.getViewportRect();
            const safe = this.getSafeArea(viewport);
            target = this.resolveTarget(step, false);
            sidebarTarget = this.isSidebarTarget(target);

            const placement = this.getPlacement(step, false);
            const mode = this.getLayoutMode({
                isMobile: false,
                sidebarTarget,
                placement,
                target
            });

            return {
                step,
                isMobile: false,
                compactSidebar,
                sidebarTarget,
                viewport,
                safe,
                target,
                placement,
                mode,
                reduceMotion,
                spotlightEnabled: this.shouldUseSpotlight(step, false, target, mode)
            };
        }

        async prepareDesktopStep(state, token) {
            if (!state.target) {
                return {
                    ...state,
                    mode: 'center',
                    spotlightEnabled: false
                };
            }

            this.scrollTargetIntoView(state.target, state.reduceMotion, 'center');
            await this.wait(state.reduceMotion ? 80 : 260, token);
            if (!this.isOpen || token !== this.renderToken) return state;

            const viewport = this.getViewportRect();
            const safe = this.getSafeArea(viewport);
            const target = this.resolveTarget(state.step, false);

            return {
                ...state,
                viewport,
                safe,
                target,
                spotlightEnabled: this.shouldUseSpotlight(state.step, false, target, 'anchored')
            };
        }

        applyLayout(state) {
            // Mobile modal: fixed bottom card, no spotlight, no focus target.
            if (state.isMobile && state.mode === 'mobile-modal') {
                const cardFrame = this.measureCardFrame('mobile-sheet', state.viewport, state.safe);
                this.applyCardFrame('mobile-sheet', cardFrame);
                this.hideSpotlight();
                return;
            }

            const layoutMode = state.mode === 'anchored'
                ? 'anchored'
                : state.mode === 'center'
                    ? 'center'
                    : 'mobile-sheet';

            let cardFrame;
            if (layoutMode === 'anchored') {
                cardFrame = this.computeAnchoredFrame(state);
            } else if (layoutMode === 'center') {
                cardFrame = this.measureCardFrame('center', state.viewport, state.safe);
            } else {
                cardFrame = state.cardFrame || this.measureCardFrame('mobile-sheet', state.viewport, state.safe);
            }

            this.applyCardFrame(layoutMode, cardFrame);

            const cardRect = this.card.getBoundingClientRect();
            if (state.spotlightEnabled && state.target && this.rectsOverlap(cardRect, state.target.getBoundingClientRect(), SPOTLIGHT_COLLISION_PADDING)) {
                state.spotlightEnabled = false;
            }

            this.syncSpotlight(state);
        }

        // ── Mobile "Show me" peek system ────────────────────────────────────────

        async showCurrentTargetOnMobile() {
            if (!this.isOpen) return;

            const step = this.steps[this.currentStep];
            if (!step) return;

            const target = this.resolveTarget(step, true);
            if (!this.isElementUsable(target)) return;

            const token = ++this.renderToken;
            const reduceMotion = this.prefersReducedMotion();

            // 1. Hide the tutorial card and overlay by entering peek mode.
            document.body.classList.remove('tour-lock-scroll');
            this.root.classList.add('tour-peek-mode');
            this.clearMobilePeekHighlight();

            // Small pause so the CSS transition runs and the card is truly hidden.
            await this.wait(80, token);
            if (!this.isOpen || token !== this.renderToken) return;

            // 2. Determine whether this is a menu-related step.
            const isMenuRelated =
                step.mobileTarget === '[data-tour="mobile-menu-button"]' ||
                step.target === '[data-tour="account-panel"]' ||
                step.target === '[data-tour="sidebar-navigation"]';

            if (isMenuRelated) {
                // Show the hamburger button instead of trying to open the sidebar.
                const menuButton = document.querySelector('[data-tour="mobile-menu-button"]');

                if (menuButton && this.isElementUsable(menuButton)) {
                    menuButton.scrollIntoView({
                        behavior: reduceMotion ? 'auto' : 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });

                    await this.wait(reduceMotion ? 80 : 260, token);
                    if (!this.isOpen || token !== this.renderToken) return;

                    menuButton.classList.add('tour-peek-highlight');
                    await this.wait(1700, token);
                    menuButton.classList.remove('tour-peek-highlight');
                }
            } else {
                // 3. Scroll the real section into view.
                target.scrollIntoView({
                    behavior: reduceMotion ? 'auto' : 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });

                await this.wait(reduceMotion ? 80 : 300, token);
                if (!this.isOpen || token !== this.renderToken) return;

                // 4. Apply pulse highlight.
                target.classList.add('tour-peek-highlight');

                // 5. Wait ~1.7 s then remove.
                await this.wait(1700, token);
                target.classList.remove('tour-peek-highlight');
            }

            if (!this.isOpen || token !== this.renderToken) return;

            // 6. Restore the tutorial card.
            this.root.classList.remove('tour-peek-mode');
            document.body.classList.add('tour-lock-scroll');

            // Re-render the same step (keeps user on same step, restores card position).
            this.renderCurrentStep();
        }

        clearMobilePeekHighlight() {
            document.querySelectorAll('.tour-peek-highlight').forEach((el) => {
                el.classList.remove('tour-peek-highlight');
            });
        }

        // ── Target resolution ────────────────────────────────────────────────────

        resolveTarget(step, isMobile) {
            const candidate = isMobile && step?.mobileTarget ? step.mobileTarget : step?.target;
            return this.resolveTargetCandidate(candidate);
        }

        resolveTargetCandidate(candidate) {
            if (!candidate) return null;
            if (candidate instanceof Element) {
                return this.isRenderableTarget(candidate) ? candidate : null;
            }

            if (typeof candidate !== 'string') return null;

            try {
                const target = document.querySelector(candidate);
                return this.isRenderableTarget(target) ? target : null;
            } catch {
                return null;
            }
        }

        isRenderableTarget(target) {
            return target instanceof Element && target.getClientRects().length > 0;
        }

        isElementUsable(target) {
            if (!this.isRenderableTarget(target)) return false;

            const rect = target.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) return false;

            const style = global.getComputedStyle(target);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (Number.parseFloat(style.opacity || '1') <= 0.05) return false;

            return true;
        }

        isSidebarTarget(target) {
            return !!target?.closest('.sidebar');
        }

        getPlacement(step, isMobile) {
            if (!step) return 'center';
            if (isMobile) {
                return step.mobilePlacement || (step.placement === 'center' ? 'center' : 'bottom-sheet');
            }
            return step.placement || 'right';
        }

        getLayoutMode({ isMobile, sidebarTarget, placement, target }) {
            if (placement === 'center' || !target) {
                return 'center';
            }

            if (!isMobile) {
                return 'anchored';
            }

            return 'mobile-modal';
        }

        shouldUseSpotlight(step, isMobile, target, mode) {
            if (!target || mode === 'center' || mode === 'mobile-modal') return false;
            if (isMobile) return false; // Mobile never uses spotlight.
            return step.spotlight !== false;
        }

        createFallbackState(step, isMobile) {
            const viewport = this.getViewportRect();
            return {
                step,
                isMobile,
                compactSidebar: viewport.width <= COMPACT_SIDEBAR_BREAKPOINT,
                sidebarTarget: false,
                viewport,
                safe: this.getSafeArea(viewport),
                target: null,
                placement: 'center',
                mode: isMobile ? 'mobile-modal' : 'center',
                reduceMotion: this.prefersReducedMotion(),
                spotlightEnabled: false,
                mobileContextFocus: false
            };
        }

        async syncSidebarState(shouldOpen, token) {
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            const compactSidebar = this.isCompactSidebar();

            if (!sidebar || !compactSidebar) {
                this.releaseSidebarLayer();
                return;
            }

            if (shouldOpen) {
                sidebar.classList.add('tour-sidebar-open');
                backdrop?.classList.add('tour-sidebar-open');
                if (typeof global.openSidebar === 'function') {
                    global.openSidebar();
                }
                await this.wait(260, token);
                return;
            }

            this.releaseSidebarLayer();
            if (typeof global.closeSidebar === 'function') {
                global.closeSidebar();
            }
            await this.wait(220, token);
        }

        releaseSidebarLayer() {
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            sidebar?.classList.remove('tour-sidebar-open');
            backdrop?.classList.remove('tour-sidebar-open');
        }

        scrollTargetIntoView(target, reduceMotion, block = 'center') {
            if (!target) return;

            try {
                target.scrollIntoView({
                    behavior: reduceMotion ? 'auto' : 'smooth',
                    block,
                    inline: 'nearest'
                });
            } catch {
                target.scrollIntoView();
            }
        }

        // ── Layout / frame computation ───────────────────────────────────────────

        measureCardFrame(layoutMode, viewport, safe) {
            this.card.dataset.layout = layoutMode;
            this.card.classList.toggle('tour-card--centered', layoutMode === 'center');

            const availableWidth = Math.max(0, safe.right - safe.left);
            const availableHeight = Math.max(0, safe.bottom - safe.top);
            const maxWidth = layoutMode === 'anchored'
                ? Math.min(420, availableWidth)
                : layoutMode === 'center'
                    ? Math.min(viewport.width > MOBILE_BREAKPOINT ? 420 : availableWidth, availableWidth)
                    : availableWidth;
            const maxHeight = layoutMode === 'mobile-sheet'
                ? Math.min(560, viewport.height * 0.68, availableHeight)
                : availableHeight;

            this.card.style.left = `${safe.left}px`;
            this.card.style.top = `${safe.top}px`;
            this.card.style.right = 'auto';
            this.card.style.bottom = 'auto';
            this.card.style.width = `${Math.max(0, maxWidth)}px`;
            this.card.style.maxWidth = `${Math.max(0, maxWidth)}px`;
            this.card.style.maxHeight = `${Math.max(0, maxHeight)}px`;

            const rect = this.card.getBoundingClientRect();
            const frame = {
                width: rect.width,
                height: Math.min(rect.height, maxHeight),
                maxHeight
            };

            if (layoutMode === 'mobile-sheet') {
                frame.left = safe.left;
                frame.top = Math.max(safe.top, safe.bottom - frame.height);
            } else if (layoutMode === 'center') {
                frame.left = this.clamp(
                    safe.left + ((safe.right - safe.left - frame.width) / 2),
                    safe.left,
                    safe.right - frame.width
                );
                frame.top = this.clamp(
                    safe.top + ((safe.bottom - safe.top - frame.height) / 2),
                    safe.top,
                    safe.bottom - frame.height
                );
            } else {
                frame.left = safe.left;
                frame.top = safe.top;
            }

            frame.right = frame.left + frame.width;
            frame.bottom = frame.top + frame.height;
            return frame;
        }

        computeAnchoredFrame(state) {
            const baseFrame = this.measureCardFrame('anchored', state.viewport, state.safe);
            const targetRect = state.target?.getBoundingClientRect();
            if (!targetRect) {
                return this.measureCardFrame('center', state.viewport, state.safe);
            }

            const preferredOrder = this.getDesktopPlacementOrder(state.placement);
            const candidates = preferredOrder.map((placement) => this.buildAnchoredCandidate(placement, targetRect, baseFrame, state.safe));
            candidates.sort((a, b) => a.score - b.score);

            return candidates[0]?.frame || this.measureCardFrame('center', state.viewport, state.safe);
        }

        getDesktopPlacementOrder(placement) {
            const orders = {
                right: ['right', 'left', 'bottom', 'top'],
                left: ['left', 'right', 'bottom', 'top'],
                bottom: ['bottom', 'top', 'right', 'left'],
                top: ['top', 'bottom', 'right', 'left']
            };

            return orders[placement] || ['right', 'left', 'bottom', 'top'];
        }

        buildAnchoredCandidate(placement, targetRect, cardFrame, safe) {
            const raw = {
                left: safe.left,
                top: safe.top
            };

            if (placement === 'right') {
                raw.left = targetRect.right + TARGET_GAP;
                raw.top = targetRect.top + ((targetRect.height - cardFrame.height) / 2);
            } else if (placement === 'left') {
                raw.left = targetRect.left - cardFrame.width - TARGET_GAP;
                raw.top = targetRect.top + ((targetRect.height - cardFrame.height) / 2);
            } else if (placement === 'bottom') {
                raw.left = targetRect.left + ((targetRect.width - cardFrame.width) / 2);
                raw.top = targetRect.bottom + TARGET_GAP;
            } else {
                raw.left = targetRect.left + ((targetRect.width - cardFrame.width) / 2);
                raw.top = targetRect.top - cardFrame.height - TARGET_GAP;
            }

            const left = this.clamp(raw.left, safe.left, safe.right - cardFrame.width);
            const top = this.clamp(raw.top, safe.top, safe.bottom - cardFrame.height);
            const frame = {
                ...cardFrame,
                left,
                top,
                right: left + cardFrame.width,
                bottom: top + cardFrame.height
            };

            const overlapPenalty = this.rectsOverlap(frame, targetRect, SPOTLIGHT_COLLISION_PADDING) ? 10000 : 0;
            const overflowPenalty =
                Math.abs(left - raw.left) +
                Math.abs(top - raw.top);

            return {
                placement,
                frame,
                score: overlapPenalty + overflowPenalty
            };
        }

        applyCardFrame(layoutMode, frame) {
            this.card.dataset.layout = layoutMode;
            this.card.classList.toggle('tour-card--centered', layoutMode === 'center');
            this.card.style.left = `${frame.left}px`;
            this.card.style.top = `${frame.top}px`;
            this.card.style.right = 'auto';
            this.card.style.bottom = 'auto';
            this.card.style.width = `${frame.width}px`;
            this.card.style.maxWidth = `${frame.width}px`;
            this.card.style.maxHeight = `${frame.maxHeight}px`;
        }

        // ── Viewport helpers ─────────────────────────────────────────────────────

        getViewportRect() {
            const vv = global.visualViewport;
            if (vv) {
                return {
                    top: vv.offsetTop,
                    left: vv.offsetLeft,
                    width: vv.width,
                    height: vv.height,
                    right: vv.offsetLeft + vv.width,
                    bottom: vv.offsetTop + vv.height
                };
            }

            return {
                top: 0,
                left: 0,
                width: global.innerWidth,
                height: global.innerHeight,
                right: global.innerWidth,
                bottom: global.innerHeight
            };
        }

        getSafeArea(viewport = this.getViewportRect()) {
            const margin = viewport.width <= MOBILE_BREAKPOINT ? MOBILE_MARGIN : DESKTOP_MARGIN;
            const topOffset = this.getSafeTopOffset(viewport, margin);

            return {
                top: topOffset,
                left: viewport.left + margin,
                right: viewport.right - margin,
                bottom: viewport.bottom - margin,
                width: Math.max(0, viewport.width - (margin * 2)),
                height: Math.max(0, viewport.bottom - topOffset - margin)
            };
        }

        getSafeTopOffset(viewport, margin) {
            const hamburger = document.getElementById('hamburgerBtn');
            if (!hamburger) return viewport.top + margin;

            const rect = hamburger.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 &&
                global.getComputedStyle(hamburger).display !== 'none';

            if (!isVisible) return viewport.top + margin;
            return Math.max(viewport.top + margin, rect.bottom + 12);
        }

        // ── Spotlight ────────────────────────────────────────────────────────────

        syncSpotlight(state) {
            if (!this.spotlight) return;

            if (!state?.spotlightEnabled || !state.target || !this.isRenderableTarget(state.target)) {
                this.hideSpotlight();
                return;
            }

            const targetRect = state.target.getBoundingClientRect();
            const cardRect = this.card.getBoundingClientRect();
            const viewport = state.viewport || this.getViewportRect();
            const radius = global.getComputedStyle(state.target).borderRadius || '18px';

            const spotlightRect = this.expandRect(targetRect, 10, viewport);

            if (this.rectsOverlap(spotlightRect, cardRect, 8)) {
                this.hideSpotlight();
                return;
            }

            this.spotlight.style.left = `${spotlightRect.left}px`;
            this.spotlight.style.top = `${spotlightRect.top}px`;
            this.spotlight.style.width = `${spotlightRect.width}px`;
            this.spotlight.style.height = `${spotlightRect.height}px`;
            this.spotlight.style.borderRadius = radius;
            this.root.classList.add('has-spotlight');
            this.spotlight.classList.add('is-visible');
        }

        hideSpotlight() {
            this.root.classList.remove('has-spotlight');
            this.spotlight.classList.remove('is-visible');
            this.spotlight.style.left = '';
            this.spotlight.style.top = '';
            this.spotlight.style.width = '';
            this.spotlight.style.height = '';
            this.spotlight.style.borderRadius = '';
        }

        clearContextLabel() {
            if (!this.contextLabelEl) return;
            this.contextLabelEl.hidden = true;
            this.contextLabelEl.textContent = '';
        }

        clearHighlight() {
            this.hideSpotlight();
            this.clearContextLabel();
            this.clearMobilePeekHighlight();
            this.currentTarget = null;
            this.currentState = null;
        }

        // ── Geometry helpers ─────────────────────────────────────────────────────

        expandRect(rect, padding, viewport) {
            const left = this.clamp(rect.left - padding, viewport.left + 6, viewport.right - 6);
            const top = this.clamp(rect.top - padding, viewport.top + 6, viewport.bottom - 6);
            const right = this.clamp(rect.right + padding, viewport.left + 6, viewport.right - 6);
            const bottom = this.clamp(rect.bottom + padding, viewport.top + 6, viewport.bottom - 6);

            return {
                left,
                top,
                right,
                bottom,
                width: Math.max(0, right - left),
                height: Math.max(0, bottom - top)
            };
        }

        frameToRect(frame) {
            return {
                left: frame.left,
                top: frame.top,
                right: frame.right,
                bottom: frame.bottom,
                width: frame.width,
                height: frame.height
            };
        }

        rectsOverlap(a, b, padding = 8) {
            if (!a || !b) return false;
            return !(
                a.right < b.left - padding ||
                a.left > b.right + padding ||
                a.bottom < b.top - padding ||
                a.top > b.bottom + padding
            );
        }

        prefersReducedMotion() {
            return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
        }

        isCompactSidebar() {
            return this.getViewportRect().width <= COMPACT_SIDEBAR_BREAKPOINT;
        }

        wait(duration, token) {
            return new Promise((resolve) => {
                global.setTimeout(() => {
                    if (!this.isOpen || token !== this.renderToken) {
                        resolve();
                        return;
                    }
                    resolve();
                }, duration);
            });
        }

        resetCardPosition() {
            if (!this.card) return;
            this.card.dataset.layout = '';
            this.card.classList.remove('tour-card--centered');
            this.card.style.left = '';
            this.card.style.top = '';
            this.card.style.right = '';
            this.card.style.bottom = '';
            this.card.style.width = '';
            this.card.style.maxWidth = '';
            this.card.style.maxHeight = '';
        }

        clamp(value, min, max) {
            return Math.min(Math.max(value, min), Math.max(min, max));
        }
    }

    global.GuidedTour = GuidedTour;
})(window);
