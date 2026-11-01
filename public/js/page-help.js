/* Deliberately on demand: no timers, first-visit flags or automatic dialogs. */
(function (global) {
  const guides = {
    'index.html': ['Dashboard', 'A daily overview of your business, with shortcuts to the tools you use most.', [
      ['Dates and refreshing', 'Choose a start and end date, then Apply to update the dashboard period. Refresh reloads the latest figures. A date range here does not change your actual appointments.', '.date-filter'],
      ['Booking totals', 'Successful Bookings, This Month and Cancelled summarize booking activity. Use Bookings to see individual customers, appointment details and statuses.', '.stats-grid'],
      ['Financial overview', 'The overview shows estimated confirmed booking value for the selected period, grouped by currency. Confirmed booking value is different from verified payments received; check the booking and its invoice before settling a balance.', '#financialOverview'],
      ['Quick actions', 'Use these shortcuts to report a problem, view bookings, block availability, manage services, edit the website or change payment gateways. View My Website opens your public site.', '.quick-actions'],
      ['Menu, help and installation', 'Open the menu to move between pages. On a phone, tap or pull up the small Menu handle, or swipe right from just inside the left edge. Swipe left across the open menu to close it. Install app adds a shortcut to this admin area. These guides open only when requested.']
    ]],
    'bookings.html': ['Bookings', 'Find appointments, create bookings for callers and follow payment and appointment progress.', [
      ['Find a booking', 'Filter by date or status, or search a customer name or email. Refresh the list after receiving an update. A filtered list does not delete or alter other appointments.', '.table-toolbar'],
      ['Book for a caller', 'Open Book for a caller. Enter the name, phone, service, date and available time. Email is optional. Read or share the terms and booking policy and obtain consent before creating the booking. WhatsApp consent is a separate choice.', '#assistedBookingPanel'],
      ['Availability and payments', 'Phone bookings follow the same schedule, blocking and capacity rules as online bookings. Offline collection remains pending until staff verify payment. Choose payment handling carefully and attach a receipt when required.', '#assistedBookingPanel'],
      ['Statuses and cancellation', 'Review a booking before approving a payment or changing its status. Cancelled or rejected appointments cannot simply be revived as unpaid confirmed bookings. Cancellation may notify the customer; add a useful reason when prompted.', '#tableBody'],
      ['Invoices and customer messages', 'Booking emails can include a branded invoice when a customer email is available. For a phone customer without email, use Invoices to download a copy. Check the actual status before repeating a request after a lost connection.']
    ]],
    'availability.html': ['Availability', 'Control which dates and individual appointment slots customers may book.', [
      ['Choose a date', 'Move through the calendar and select the date you want to review. Inspect its day state and time slots before making changes.', '.calendar'],
      ['Block a whole day', 'Use a day block for holidays, closures or dates when the business cannot take bookings. An optional reason helps customers understand why the date is unavailable. Existing appointments still need separate attention.'],
      ['Block individual slots', 'For meetings, maintenance or a break, block only the relevant time slots rather than the full day. Slot availability also depends on service duration, buffers, existing appointments and capacity.'],
      ['Reopen availability', 'Remove the relevant block when you are ready to accept appointments again. Check the public booking page afterwards to confirm the intended dates and times are available.'],
      ['Regular hours and timezone', 'Use Settings → Business Schedule for normal weekly opening hours, timezone and after-hours rules. Availability is for exceptions to that schedule.']
    ]],
    'services.html': ['Services', 'Manage the service cards customers see, including duration, pricing and payment requirements.', [
      ['Add or edit a service', 'Use Add Service to create a service, or the action beside an existing row to edit it. Give it a clear name and description. A service image helps customers identify what they are booking.', '.page-header'],
      ['Duration and buffer', 'Duration is the appointment length; buffer time adds room around it. These values affect the available slots customers can choose. Check the public booking page after changing them.'],
      ['Price and payment mode', 'Set the service price and review whether it uses the business default payment option or a service-specific override. Enable and configure the matching gateway in Settings.'],
      ['Full payment or deposit', 'Choose the payment requirement and, if using a deposit, its type and amount. Verify that a percentage or fixed deposit makes sense for the service price before saving.'],
      ['Existing records', 'Changing a service affects future use. Previously issued invoices preserve their original service, price and branding snapshots. Review existing bookings separately when a business policy changes.']
    ]],
    'customize.html': ['Website Builder', 'Edit your website as a draft, check the live preview and publish when you are ready.', [
      ['Website, booking widget and templates', 'Website is the page editor. Booking widget controls the booking interface colours. Templates contains the template and custom-theme options available to your account.', '.builder-tabs'],
      ['Pages and sections', 'In Pages, choose a page, add sections and reorder or hide them. Click text or a photo in the preview to open its editing controls. Website mode selects a full site or booking-only page; page layout selects separate pages or one scrolling page.', '[data-tour="builder-tab-layers"]'],
      ['Design', 'Use Design to adjust colours, fonts, button shapes and corner styles. Check text contrast and mobile previews as you work so customers can still read and use the site.', '[data-tour="builder-tab-style"]'],
      ['Media', 'Use Media for your library of images and videos. Hero areas can use a photo, slideshow or background video where supported. Follow the size guidance beside upload fields.', '[data-tour="builder-tab-media"]'],
      ['Music and site information', 'Music controls the optional site soundtrack; visitors must interact before browsers allow playback. Site info contains logo, contact details, social links and search description.', '[data-tour="builder-tab-info"]'],
      ['Preview on a phone', 'Use the device controls for desktop, tablet and phone sizes. On mobile, switch between Edit and Preview at the bottom of the builder. The preview shows the draft; customers see the published version.', '[aria-label="Preview device"]'],
      ['Undo, draft and publishing', 'Undo and Redo let you move through editing changes. Changes autosave as a draft; Publish makes the draft live. Discard returns to the published version. Review the draft before either action.', '.sb-actions'],
      ['Optional walkthrough', 'For a guided introduction with highlighted controls, use Settings → Optional walkthroughs → Website Builder walkthrough. It never starts automatically.']
    ]],
    'settings.html': ['Settings', 'Configure business-wide payment, scheduling, calendar and workspace preferences.', [
      ['Optional walkthroughs', 'Start the dashboard or Website Builder guide only when you want one. Completion history and first visits never trigger them automatically. Close a walkthrough at any time.', '[data-start-tutorial]'],
      ['Workspace appearance', 'Eligible testing accounts can choose a dashboard theme in Appearance here. This changes the admin workspace, not the public website. Public website styling belongs in Website Builder.', '#adminAppearanceSection'],
      ['Payment gateways', 'Select the default payment method, enable the options your business supports and enter the merchant details requested by each gateway. Follow the gateway instructions and save the payment settings. Service-level overrides may use a different enabled method.', '[data-tour="payment-gateways"]'],
      ['Payment holds', 'Hold Timeout controls how long a pending payment may reserve a slot. Choose a realistic period for customers to complete payment. Verify offline transfers before confirming them.', '#hold_timeout_minutes'],
      ['Business schedule', 'Set working days, opening and closing times and the business timezone. Use 24-hour operation only for days when you actually accept bookings throughout the day. Availability handles one-off closures and blocked slots.', '#business_timezone'],
      ['After-hours requests', 'If enabled, customers can request appointments outside ordinary hours under your configured rules. Review the additional fee and confirmation process; an after-hours request still needs the appropriate approval.', '#after_hours_fee'],
      ['Calendar subscription', 'Use the calendar subscription controls to follow appointments in a calendar application. Treat the subscription link as private. Changes may take time to appear depending on the calendar app refresh cycle.'],
      ['Save and verify', 'Each settings area may have its own Save action. After saving, check the public booking flow to confirm that the schedule and payment options match your intention.']
    ]],
    'invoices.html': ['Invoices', 'Style your business invoices and download copies associated with bookings.', [
      ['Invoice appearance', 'Tenant administrators can set the business name, registration, address, contact details, colours, logo, payment instructions and footer. Other roles may have different permissions.', '#invoiceDesign'],
      ['Logo and preview', 'Upload a PNG or JPG up to 1 MB. Use Download sample PDF to inspect the appearance, then Save invoice style to use it for new invoices.', '#invPreview'],
      ['Historical invoices', 'New style settings apply to newly issued invoices. Previously issued invoices keep their original branding, service details and price snapshot.', '#invoiceDesign'],
      ['Payments and balance', 'Invoice totals count verified payments in the invoice currency. A payment that is awaiting review does not settle the balance. A booking without an advance-payment requirement is not automatically free.'],
      ['Booking invoice downloads', 'Use the booking invoice list and Previous / Next controls to find a record, then Download invoice. Copies are useful for phone customers who did not supply an email address.', '#invoiceList']
    ]],
    'tenants.html': ['Tenant Management', 'Manage business accounts using the tools permitted for your administrative role.', [
      ['Account details', 'Review the business identity, subscription plan and status before making a change. Always confirm that you have selected the correct tenant.'],
      ['Access and changes', 'Use the available account actions to manage that business. Access options depend on your role; owner and developer operations are also available in Platform Console.'],
      ['Verify the outcome', 'Check the account status and relevant business admin area after saving changes. Avoid repeating an action until you have checked whether the first request completed.']
    ]],
    'contracts.html': ['Partner Contracts', 'Invite partners, review agreements and retain signed copies.', [
      ['Send an invitation', 'Authorized owners can enter the partner details and send the one-time signing link. Confirm the email address before sending.', '#invite'],
      ['Review agreements', 'Use the agreements list to review what was signed and its current status. Only countersign an agreement after reading its actual terms.', '#agreements'],
      ['Keep a copy', 'Download the available signed agreement for your records. Partner users see the contracts permitted for their account; owner-only management options remain restricted.']
    ]],
    'platform:dashboard': ['Platform dashboard', 'Review platform-wide booking and tenant activity.', [
      ['Metrics', 'Tap a metric for its full explanation. Confirmed booking value represents service value on confirmed or completed bookings; it is not the same as verified cash collected.'],
      ['Charts', 'Swipe inside a monthly chart to see all months on a phone. Tap a bar or line point for its value. Tap a status or legend entry to inspect that part of the status mix. Details appear beside the relevant chart.'],
      ['Top tenants', 'The tenant table compares confirmed booking count and value. Scroll the table sideways where necessary; tapping a row reveals its details.']
    ]],
    'platform:tenants': ['Tenants', 'Find a business and use the management actions authorized for your platform role.', [
      ['Search and inspect', 'Search by name or handle and open a tenant for more details. Verify its owner, status, theme and payment setup before changing anything.'],
      ['View or edit admin', 'View Admin starts read-only access; Edit Admin permits changes under the selected access session. Use the least access needed and end the session when finished.'],
      ['Account actions', 'Status changes, password resets and deletion have different effects. Read each confirmation carefully. Clearing tutorial history does not cause a walkthrough to start; users still launch help manually.']
    ]],
    'platform:themes': ['Theme Library', 'Inspect the themes available across the platform.', [['Themes and tenants', 'Review a theme and its associated tenants before making a change. Website content and public styling are edited through the applicable tenant builder.']]],
    'platform:jobs': ['Jobs & Queue', 'Inspect background processing and follow up on jobs needing attention.', [['Job state', 'Review the job details and current status before updating it. A successful queue action is different from a confirmed customer payment or appointment.'], ['Troubleshooting', 'Use the available diagnostics to understand the failure before repeating an operation; a retry can have an external effect depending on the job.']]],
    'platform:payments': ['Payments', 'Review the platform payment records available to your role.', [['Payment records', 'Match the tenant, currency, reference and status before acting. A pending or unverified record should not be treated as received money.'], ['Related bookings', 'Check the related booking or tenant admin where you need appointment-level context or a customer invoice.']]],
    'platform:audit': ['Audit Log', 'Inspect recorded administrative activity.', [['Trace a change', 'Review the actor, tenant, time and action together. Use any available filters to narrow the records. The log helps explain what happened; it is not an undo control.']]],
    'platform:team': ['Developer Admins', 'Manage developer platform access with the permissions available to the owner.', [['Account permissions', 'Review the person and role before changing access. Developer accounts can see operational information and may perform administrative actions.'], ['Access hygiene', 'Remove access that is no longer needed and check the audit history when reviewing sensitive changes.']]],
    'platform:contracts': ['Contracts', 'Review partner agreements and the owner actions associated with them.', [['Agreements', 'Confirm the partner and agreement details before inviting or countersigning. Keep signed copies using the available download controls.']]],
    'platform:system': ['System', 'Inspect platform system information and available diagnostics.', [['System state', 'Use the displayed environment and diagnostic information to understand the service state. Check the time and source of a diagnostic result before relying on it.'], ['Operational actions', 'Read any confirmation before running an available system action. Verify the result before repeating a request after a connection problem.']]]
  };
  const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
  const open = (key, trigger) => {
    const guide = guides[key]; if (!guide) return;
    const old = document.getElementById('icssPageHelp'); if (old) { old.close(); old.remove(); }
    const dialog = element('dialog', 'page-help-dialog'); dialog.id = 'icssPageHelp'; dialog.setAttribute('aria-labelledby', 'icssPageHelpTitle');
    const heading = element('header', 'page-help-heading');
    const title = element('h2', '', guide[0]); title.id = 'icssPageHelpTitle';
    const close = element('button', 'page-help-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close page help'); close.addEventListener('click', () => dialog.close()); heading.append(title, close);
    dialog.append(heading, element('p', 'page-help-intro', guide[1]));
    guide[2].forEach(([label, text, selector], index) => {
      const section = element('details', 'page-help-section'); section.open = index === 0;
      section.append(element('summary', '', label), element('p', '', text));
      const target = selector && document.querySelector(selector);
      if (target && !target.hidden && target.getClientRects().length) {
        const show = element('button', 'page-help-show', 'Show this control'); show.type = 'button';
        show.addEventListener('click', () => {
          dialog.close();
          for (let parent = target.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
          target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
          target.classList.add('page-help-highlight'); setTimeout(() => target.classList.remove('page-help-highlight'), 5000);
        }); section.appendChild(show);
      }
      dialog.appendChild(section);
    });
    dialog.addEventListener('close', () => { dialog.remove(); trigger?.focus({ preventScroll: true }); }, { once: true });
    document.body.appendChild(dialog); dialog.showModal(); close.focus();
  };
  const mount = (header, key) => {
    if (!header || !guides[key]) return () => {};
    header.classList.add('has-page-help');
    const button = element('button', 'page-help-button', '?'); button.type = 'button';
    button.setAttribute('aria-label', `About this page: ${guides[key][0]}`); button.title = 'About this page';
    button.addEventListener('click', () => open(key, button)); header.appendChild(button);
    return () => { button.remove(); header.classList.remove('has-page-help'); document.getElementById('icssPageHelp')?.close(); };
  };
  global.ICSSPageHelp = { open, mount };
})(window);
