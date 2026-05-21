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
                    <div class="tour-copy">
                        <h2 class="tour-title" id="guidedTourTitle"></h2>
                        <p class="tour-message" id="guidedTourMessage"></p>
                    </div>
                    <div class="tour-actions">
                        <button type="button" class="btn btn-secondary tour-back-btn">Back</button>
                        <button type="button" class="btn btn-secondary tour-skip-btn">Skip Tutorial</button>
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
            this.titleEl = this.root.querySelector('.tour-title');
            this.messageEl = this.root.querySelector('.tour-message');
            this.backButton = this.root.querySelector('.tour-back-btn');
            this.skipButton = this.root.querySelector('.tour-skip-btn');
            this.nextButton = this.root.querySelector('.tour-next-btn');

            this.backButton.addEventListener('click', () => this.previous());
            this.skipButton.addEventListener('click', () => this.skip());
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
            this.root.classList.remove('is-open', 'is-preparing', 'has-spotlight');
            this.root.hidden = true;
            document.body.classList.remove('tour-open', 'tour-lock-scroll');
            this.releaseSidebarLayer();
            this.resetCardPosition();

            if (typeof global.closeSidebar === 'function' && this.isCompactSidebar()) {
                global.closeSidebar();
            }

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

            this.stepCount.textContent = `Step ${stepNumber} of ${totalSteps}`;
            this.titleEl.textContent = step.title || 'Guided Tour';
            this.messageEl.textContent = step.message || '';
            this.progressFill.style.width = `${(stepNumber / totalSteps) * 100}%`;
            this.backButton.disabled = isFirstStep;
            this.backButton.classList.toggle('is-disabled', isFirstStep);
            this.skipButton.hidden = isLastStep;
            this.nextButton.textContent = isLastStep ? 'I understand' : 'Okay, Next';
        }

        async prepareStep(step, token) {
            const state = await this.buildStepState(step, token);
            if (!this.isOpen || token !== this.renderToken) return state;

            if (state.mode === 'center') {
                state.target = null;
                state.spotlightEnabled = false;
                return state;
            }

            if (state.isMobile) {
                return this.prepareMobileStep(state, token);
            }

            return this.prepareDesktopStep(state, token);
        }

        async buildStepState(step, token) {
            const initialViewport = this.getViewportRect();
            const isMobile = initialViewport.width <= MOBILE_BREAKPOINT;
            const compactSidebar = initialViewport.width <= COMPACT_SIDEBAR_BREAKPOINT;
            const reduceMotion = this.prefersReducedMotion();

            if (isMobile) {
                this.releaseSidebarLayer();

                if (typeof global.closeSidebar === 'function') {
                    global.closeSidebar();
                }

                await this.wait(120, token);

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
                    placement: 'center',
                    mode: 'center',
                    reduceMotion,
                    spotlightEnabled: false
                };
            }

            let target = this.resolveTarget(step, isMobile);
            let sidebarTarget = this.isSidebarTarget(target);

            await this.syncSidebarState(sidebarTarget && compactSidebar, token);
            if (!this.isOpen || token !== this.renderToken) {
                return this.createFallbackState(step, isMobile);
            }

            const viewport = this.getViewportRect();
            const safe = this.getSafeArea(viewport);
            target = this.resolveTarget(step, isMobile);
            sidebarTarget = this.isSidebarTarget(target);

            const placement = this.getPlacement(step, isMobile);
            const mode = this.getLayoutMode({
                isMobile,
                sidebarTarget,
                placement,
                target
            });

            return {
                step,
                isMobile,
                compactSidebar,
                sidebarTarget,
                viewport,
                safe,
                target,
                placement,
                mode,
                reduceMotion,
                spotlightEnabled: this.shouldUseSpotlight(step, isMobile, target, mode)
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

        async prepareMobileStep(state, token) {
            let nextState = { ...state };
            const expectedSpotlight = nextState.step.mobileSpotlight !== false;
            const canScrollTarget = nextState.target && !nextState.sidebarTarget;

            if (nextState.mode === 'mobile-no-spotlight' || !nextState.target) {
                return {
                    ...nextState,
                    spotlightEnabled: false,
                    target: nextState.target || null
                };
            }

            let viewport = this.getViewportRect();
            let safe = this.getSafeArea(viewport);
            let cardFrame = this.measureCardFrame('mobile-sheet', viewport, safe);
            let target = nextState.target;
            let targetZone = this.getMobileTargetZone(viewport, safe, cardFrame);

            if (canScrollTarget) {
                await this.scrollTargetIntoZone(target, targetZone, nextState.reduceMotion, token);
                if (!this.isOpen || token !== this.renderToken) return nextState;
            }

            viewport = this.getViewportRect();
            safe = this.getSafeArea(viewport);
            cardFrame = this.measureCardFrame('mobile-sheet', viewport, safe);
            targetZone = this.getMobileTargetZone(viewport, safe, cardFrame);
            target = this.resolveTarget(nextState.step, true);

            const targetRect = target?.getBoundingClientRect() || null;
            let spotlightEnabled = nextState.spotlightEnabled;

            if (!targetRect || !this.canSpotlightInZone(targetRect, targetZone)) {
                spotlightEnabled = false;
            }

            if (spotlightEnabled && this.rectsOverlap(this.frameToRect(cardFrame), targetRect, SPOTLIGHT_COLLISION_PADDING)) {
                spotlightEnabled = false;
            }

            const fallbackToCenter = expectedSpotlight && !spotlightEnabled &&
                targetRect &&
                this.rectsOverlap(this.frameToRect(cardFrame), targetRect, SPOTLIGHT_COLLISION_PADDING);

            if (fallbackToCenter) {
                return {
                    ...nextState,
                    viewport,
                    safe,
                    target,
                    spotlightEnabled: false,
                    mode: 'center'
                };
            }

            return {
                ...nextState,
                viewport,
                safe,
                target,
                cardFrame,
                targetZone,
                spotlightEnabled
            };
        }

        applyLayout(state) {
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
                if (state.isMobile) {
                    const centerFrame = this.measureCardFrame('center', state.viewport, state.safe);
                    this.applyCardFrame('center', centerFrame);
                    state.mode = 'center';
                    state.spotlightEnabled = false;
                } else {
                    state.spotlightEnabled = false;
                }
            }

            this.syncSpotlight(state);
        }

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

            if (placement === 'mobile-no-spotlight') {
                return 'mobile-no-spotlight';
            }

            if (sidebarTarget) {
                return 'mobile-sidebar';
            }

            return 'mobile-bottom-sheet';
        }

        shouldUseSpotlight(step, isMobile, target, mode) {
            if (!target || mode === 'center' || mode === 'mobile-no-spotlight') return false;
            if (isMobile) return step.mobileSpotlight !== false;
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
                mode: 'center',
                reduceMotion: this.prefersReducedMotion(),
                spotlightEnabled: false
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

        async scrollTargetIntoZone(target, zone, reduceMotion, token) {
            if (!target || !zone) return;

            const rect = target.getBoundingClientRect();
            if (rect.height >= zone.height - 12) return;

            const desiredTop = this.clamp(
                zone.top + 16,
                zone.top,
                Math.max(zone.top, zone.bottom - rect.height - 8)
            );
            const desiredBottom = desiredTop + rect.height;
            let delta = 0;

            if (rect.top < desiredTop || rect.bottom > zone.bottom) {
                if (rect.bottom > zone.bottom && desiredBottom <= zone.bottom) {
                    delta = rect.top - desiredTop;
                } else if (rect.top < desiredTop) {
                    delta = rect.top - desiredTop;
                } else {
                    delta = rect.bottom - zone.bottom;
                }
            }

            if (Math.abs(delta) < 2) return;

            global.scrollBy({
                top: delta,
                behavior: reduceMotion ? 'auto' : 'smooth'
            });

            await this.wait(reduceMotion ? 80 : 240, token);
        }

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
                ? Math.min(520, viewport.height * 0.52, availableHeight)
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

        getMobileTargetZone(viewport, safe, cardFrame) {
            return {
                top: safe.top,
                left: safe.left,
                right: safe.right,
                bottom: Math.max(safe.top + 48, cardFrame.top - 18),
                width: Math.max(0, safe.right - safe.left),
                height: Math.max(0, cardFrame.top - 18 - safe.top)
            };
        }

        canSpotlightInZone(targetRect, zone) {
            if (!targetRect || !zone) return false;
            if (zone.height < 88) return false;
            if (targetRect.height > zone.height * 0.78) return false;
            if (targetRect.width > zone.width + 4) return false;
            if (targetRect.top < zone.top + 4) return false;
            if (targetRect.bottom > zone.bottom - 4) return false;
            return true;
        }

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

            let spotlightRect = this.expandRect(targetRect, state.isMobile ? 6 : 10, viewport);
            if (this.rectsOverlap(spotlightRect, cardRect, 8)) {
                spotlightRect = this.expandRect(targetRect, 2, viewport);
            }

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

        clearHighlight() {
            this.hideSpotlight();
            this.currentTarget = null;
            this.currentState = null;
        }

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
