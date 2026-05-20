(function initializeGuidedTour(global) {
    class GuidedTour {
        constructor(options = {}) {
            this.steps = Array.isArray(options.steps) ? options.steps : [];
            this.storageKey = options.storageKey || 'guidedTourCompleted';
            this.currentStep = 0;
            this.currentTarget = null;
            this.currentContext = null;
            this.isOpen = false;
            this.renderToken = 0;
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
            this.renderToken += 1;
            this.detachEvents();
            this.clearHighlight();
            this.root.classList.remove('is-open');
            this.root.hidden = true;
            document.body.classList.remove('tour-open');
            this.resetCardPosition();
            if (typeof global.closeSidebar === 'function' && global.innerWidth <= 900) {
                global.closeSidebar();
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
            global.addEventListener('scroll', this.boundHandleViewportChange, { passive: true });
        }

        detachEvents() {
            global.removeEventListener('keydown', this.boundHandleKeydown);
            global.removeEventListener('resize', this.boundHandleViewportChange);
            global.removeEventListener('scroll', this.boundHandleViewportChange);
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
            global.requestAnimationFrame(() => {
                if (!this.isOpen) return;
                this.positionCard(this.steps[this.currentStep], this.currentTarget);
            });
        }

        async renderCurrentStep() {
            if (!this.isOpen) return;
            const token = ++this.renderToken;
            const step = this.steps[this.currentStep];
            if (!step) {
                this.finish();
                return;
            }

            this.updateCard(step);
            this.clearHighlight();

            const target = this.resolveTarget(step);
            await this.prepareStep(step, target, token);
            if (!this.isOpen || token !== this.renderToken) return;

            this.applyHighlight(target);
            this.currentTarget = target;
            this.positionCard(step, target);
            this.card.focus({ preventScroll: true });
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

        resolveTarget(step) {
            if (!step || !step.target) return null;
            if (step.target instanceof Element) {
                return this.isRenderableTarget(step.target) ? step.target : null;
            }
            if (typeof step.target !== 'string') return null;
            try {
                const target = document.querySelector(step.target);
                return this.isRenderableTarget(target) ? target : null;
            } catch {
                return null;
            }
        }

        isRenderableTarget(target) {
            return target instanceof Element && target.getClientRects().length > 0;
        }

        async prepareStep(step, target, token) {
            const isSidebarTarget = target ? !!target.closest('.sidebar') : false;
            if (isSidebarTarget && global.innerWidth <= 900 && typeof global.openSidebar === 'function') {
                global.openSidebar();
                await this.wait(220, token);
            } else if (!isSidebarTarget && global.innerWidth <= 900 && typeof global.closeSidebar === 'function') {
                global.closeSidebar();
                await this.wait(160, token);
            }

            if (!target || step.placement === 'center' || isSidebarTarget) return;

            const prefersReducedMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
            try {
                target.scrollIntoView({
                    behavior: prefersReducedMotion ? 'auto' : 'smooth',
                    block: global.innerWidth <= 720 ? 'start' : 'center',
                    inline: 'nearest'
                });
            } catch {
                target.scrollIntoView();
            }

            await this.wait(prefersReducedMotion ? 80 : 360, token);

            if (global.innerWidth <= 720) {
                await this.ensureMobileTargetVisibility(target, token, prefersReducedMotion);
            }
        }

        wait(duration, token) {
            return new Promise(resolve => {
                global.setTimeout(() => {
                    if (!this.isOpen || token !== this.renderToken) {
                        resolve();
                        return;
                    }
                    resolve();
                }, duration);
            });
        }

        applyHighlight(target) {
            if (!target) return;
            const radius = global.getComputedStyle(target).borderRadius;
            const elevatedContext = target.closest('.sidebar');
            target.classList.add('tour-highlight');
            if (radius && radius !== '0px') {
                target.style.setProperty('--tour-highlight-radius', radius);
            }
            if (elevatedContext) {
                elevatedContext.classList.add('tour-elevated-context');
                this.currentContext = elevatedContext;
            }
        }

        clearHighlight() {
            if (this.currentTarget) {
                this.currentTarget.classList.remove('tour-highlight');
                this.currentTarget.style.removeProperty('--tour-highlight-radius');
                this.currentTarget = null;
            }
            if (this.currentContext) {
                this.currentContext.classList.remove('tour-elevated-context');
                this.currentContext = null;
            }
        }

        getSafeTopOffset(margin = 16) {
            const hamburger = document.getElementById('hamburgerBtn');
            if (!hamburger) return margin;

            const hamburgerRect = hamburger.getBoundingClientRect();
            const isHamburgerVisible = hamburgerRect.width > 0 && hamburgerRect.height > 0 &&
                global.getComputedStyle(hamburger).display !== 'none';

            if (!isHamburgerVisible) return margin;
            return Math.max(margin, hamburgerRect.bottom + 12);
        }

        async ensureMobileTargetVisibility(target, token, prefersReducedMotion) {
            if (!target || global.innerWidth > 720) return;

            const margin = 16;
            const safeTop = this.getSafeTopOffset(margin);
            const cardRect = this.card.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const reservedBottom = cardRect.height + margin + 12;
            const maxTargetBottom = Math.max(safeTop + 56, global.innerHeight - reservedBottom);
            const desiredTop = safeTop + 12;
            let scrollDelta = 0;

            if (targetRect.top < desiredTop) {
                scrollDelta = targetRect.top - desiredTop;
            } else if (targetRect.bottom > maxTargetBottom) {
                scrollDelta = targetRect.bottom - maxTargetBottom;
            }

            if (Math.abs(scrollDelta) < 4) return;

            global.scrollBy({
                top: scrollDelta,
                behavior: prefersReducedMotion ? 'auto' : 'smooth'
            });

            await this.wait(prefersReducedMotion ? 80 : 220, token);
        }

        positionMobileSidebarCard(target, margin, safeTop) {
            const sidebar = target?.closest('.sidebar');
            if (!sidebar) return false;

            const sidebarRect = sidebar.getBoundingClientRect();
            const sidebarPadding = 12;
            const maxWidth = Math.max(220, sidebarRect.width - (sidebarPadding * 2));
            const width = Math.min(maxWidth, global.innerWidth - (margin * 2));

            this.card.style.width = `${width}px`;

            const cardRect = this.card.getBoundingClientRect();
            const left = this.clamp(sidebarRect.left + sidebarPadding, margin, global.innerWidth - cardRect.width - margin);
            const top = this.clamp(global.innerHeight - cardRect.height - margin, safeTop, global.innerHeight - cardRect.height - margin);

            this.card.style.left = `${left}px`;
            this.card.style.top = `${top}px`;
            this.card.style.right = 'auto';
            this.card.style.bottom = 'auto';
            return true;
        }

        positionMobileTargetCard(target, margin, safeTop) {
            if (!target) return false;

            this.card.style.width = '';

            const cardRect = this.card.getBoundingClientRect();
            const rect = target.getBoundingClientRect();
            const gap = 14;
            const centeredLeft = this.clamp(
                rect.left + (rect.width / 2) - (cardRect.width / 2),
                margin,
                global.innerWidth - cardRect.width - margin
            );

            const availableBelow = global.innerHeight - rect.bottom - margin;
            const availableAbove = rect.top - safeTop - margin;

            let top;
            if (availableBelow >= cardRect.height + gap) {
                top = rect.bottom + gap;
            } else if (availableAbove >= cardRect.height + gap) {
                top = rect.top - cardRect.height - gap;
            } else {
                top = this.clamp(global.innerHeight - cardRect.height - margin, safeTop, global.innerHeight - cardRect.height - margin);
            }

            this.card.style.left = `${centeredLeft}px`;
            this.card.style.top = `${this.clamp(top, safeTop, global.innerHeight - cardRect.height - margin)}px`;
            this.card.style.right = 'auto';
            this.card.style.bottom = 'auto';
            return true;
        }

        positionCard(step, target) {
            if (!this.card) return;

            const margin = global.innerWidth <= 720 ? 16 : 20;
            const viewportWidth = global.innerWidth;
            const viewportHeight = global.innerHeight;
            const safeTop = this.getSafeTopOffset(margin);
            this.card.style.width = '';
            const cardRect = this.card.getBoundingClientRect();

            if (step?.placement === 'center' || !target) {
                const centeredLeft = Math.max(margin, (viewportWidth - cardRect.width) / 2);
                const centeredTop = Math.max(safeTop, (viewportHeight - cardRect.height) / 2);
                this.card.style.left = `${Math.min(centeredLeft, viewportWidth - cardRect.width - margin)}px`;
                this.card.style.top = `${Math.min(centeredTop, viewportHeight - cardRect.height - margin)}px`;
                this.card.style.right = 'auto';
                this.card.style.bottom = 'auto';
                return;
            }

            if (viewportWidth <= 720) {
                if (target.closest('.sidebar')) {
                    this.positionMobileSidebarCard(target, margin, safeTop);
                    return;
                }

                this.positionMobileTargetCard(target, margin, safeTop);
                return;
            }

            const rect = target.getBoundingClientRect();
            const gap = 18;
            const positions = [];
            const centeredTop = this.clamp(rect.top + (rect.height / 2) - (cardRect.height / 2), margin, viewportHeight - cardRect.height - margin);
            const centeredLeft = this.clamp(rect.left + (rect.width / 2) - (cardRect.width / 2), margin, viewportWidth - cardRect.width - margin);

            positions.push({
                left: rect.right + gap,
                top: centeredTop,
                fits: rect.right + gap + cardRect.width <= viewportWidth - margin
            });
            positions.push({
                left: rect.left - cardRect.width - gap,
                top: centeredTop,
                fits: rect.left - gap - cardRect.width >= margin
            });
            positions.push({
                left: centeredLeft,
                top: rect.bottom + gap,
                fits: rect.bottom + gap + cardRect.height <= viewportHeight - margin
            });
            positions.push({
                left: centeredLeft,
                top: rect.top - cardRect.height - gap,
                fits: rect.top - gap - cardRect.height >= margin
            });

            const bestFit = positions.find(position => position.fits) || {
                left: centeredLeft,
                top: this.clamp(rect.bottom + gap, margin, viewportHeight - cardRect.height - margin)
            };

            this.card.style.left = `${this.clamp(bestFit.left, margin, viewportWidth - cardRect.width - margin)}px`;
            this.card.style.top = `${this.clamp(bestFit.top, margin, viewportHeight - cardRect.height - margin)}px`;
            this.card.style.right = 'auto';
            this.card.style.bottom = 'auto';
        }

        resetCardPosition() {
            if (!this.card) return;
            this.card.style.left = '';
            this.card.style.top = '';
            this.card.style.right = '';
            this.card.style.bottom = '';
            this.card.style.width = '';
        }

        clamp(value, min, max) {
            return Math.min(Math.max(value, min), Math.max(min, max));
        }
    }

    global.GuidedTour = GuidedTour;
})(window);
