/* Shared touch navigation for the tenant admin and developer console. */
(function (global) {
  global.ICSSMobileNavigation = function ({ trigger, drawer, scroller = global, onOpen, onClose, breakpoint = 900 }) {
    if (!trigger || !drawer) return () => {};
    const media = global.matchMedia(`(max-width: ${breakpoint}px)`);
    const listeners = [];
    const listen = (target, name, fn, options) => { target.addEventListener(name, fn, options); listeners.push(() => target.removeEventListener(name, fn, options)); };
    const isOpen = () => drawer.classList.contains('open') || drawer.className.split(/\s+/).some(name => /sidebarOpen/.test(name));
    const y = () => scroller === global ? global.scrollY : scroller.scrollTop;
    let previousY = y(), start = null;
    const grip = document.createElement('button');
    grip.type = 'button'; grip.className = 'nav-menu-grip'; grip.dataset.navGrip = 'true';
    grip.setAttribute('aria-label', 'Open menu. You can also swipe up on this handle.');
    grip.classList.toggle('nav-menu-grip--builder', !!document.querySelector('.sb-mobile-switch'));
    grip.innerHTML = '<span aria-hidden="true"></span><span>Menu</span>';
    document.body.appendChild(grip);
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'nav-drawer-close'; close.setAttribute('aria-label', 'Close menu');
    close.innerHTML = '<span>Menu</span><svg aria-hidden="true" width="20" height="20"><use href="/icons/ui.svg#close"></use></svg>';
    drawer.prepend(close);
    const reveal = () => trigger.classList.remove('nav-trigger-hidden');
    const open = () => { reveal(); drawer.inert = false; onOpen(); };
    const dismiss = (restoreFocus = false) => { onClose(); reveal(); if (restoreFocus) trigger.focus({ preventScroll: true }); };
    const sync = () => {
      const opened = isOpen();
      drawer.inert = media.matches && !opened;
      grip.hidden = !media.matches || opened;
      close.hidden = !media.matches;
      trigger.setAttribute('aria-expanded', String(opened));
      if (opened) reveal();
    };
    const onScroll = () => {
      const current = y(), delta = current - previousY;
      if (Math.abs(delta) < 8) return;
      if (media.matches && !isOpen() && !document.querySelector('dialog[open], .tour-root.is-open') && !(document.activeElement === trigger && trigger.matches(':focus-visible'))) {
        trigger.classList.toggle('nav-trigger-hidden', delta > 0 && current > 90);
      }
      previousY = current;
    };
    const interactive = target => target.closest('input,textarea,select,iframe,canvas,[contenteditable=true],[role=slider],[data-nav-no-swipe]');
    const horizontalScroller = target => {
      for (let el = target; el && el !== document.body; el = el.parentElement) {
        if (el.scrollWidth > el.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
      }
      return false;
    };
    listen(grip, 'click', open);
    listen(close, 'click', () => dismiss(true));
    listen(trigger, 'focus', reveal);
    listen(scroller, 'scroll', onScroll, { passive: true });
    listen(document, 'touchstart', event => {
      start = null;
      if (!media.matches || event.touches.length !== 1 || document.querySelector('dialog[open], .modal-overlay.open, .tour-root.is-open')) return;
      const target = event.target;
      if (!(target instanceof Element) || interactive(target) || horizontalScroller(target)) return;
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, at: Date.now(), grip: !!target.closest('[data-nav-grip]'), inside: drawer.contains(target), opened: isOpen() };
    }, { passive: true });
    listen(document, 'touchend', event => {
      if (!start || !event.changedTouches.length) return;
      const touch = event.changedTouches[0], dx = touch.clientX - start.x, dy = touch.clientY - start.y;
      if (Date.now() - start.at < 850) {
        // Preserve native back gestures at the extreme edge and ordinary vertical scrolling.
        if (!start.opened && ((start.grip && dy < -45 && Math.abs(dy) > Math.abs(dx) * 1.4) || (start.x >= 16 && start.x <= 44 && dx > 65 && Math.abs(dx) > Math.abs(dy) * 1.8))) open();
        if (start.opened && start.inside && dx < -65 && Math.abs(dx) > Math.abs(dy) * 1.8) dismiss();
      }
      start = null;
    }, { passive: true });
    listen(document, 'touchcancel', () => { start = null; }, { passive: true });
    listen(document, 'keydown', event => {
      if (!media.matches || !isOpen()) return;
      if (event.key === 'Escape') { event.preventDefault(); dismiss(true); }
      if (event.key === 'Tab') {
        const buttons = Array.from(drawer.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')).filter(el => !el.disabled && el.getClientRects().length);
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (!drawer.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    const onMediaChange = () => { reveal(); sync(); };
    if (media.addEventListener) listen(media, 'change', onMediaChange);
    else { media.addListener(onMediaChange); listeners.push(() => media.removeListener(onMediaChange)); }
    const observer = new MutationObserver(sync); observer.observe(drawer, { attributes: true, attributeFilter: ['class'] });
    sync();
    return () => { listeners.forEach(remove => remove()); observer.disconnect(); grip.remove(); close.remove(); drawer.inert = false; reveal(); };
  };
})(window);
