/**
 * ICSS Booking System — Public Booking Widget JS
 *
 * Multi-step flow:
 *  Step 1 → Calendar (pick a date)
 *  Step 2 → Time slot selection
 *  Step 3 → Customer details form
 *  Step 4 → Confirmation
 *
 * Tenant context resolved server-side via subdomain / X-Tenant-ID header.
 * Branding fetched from /api/v1/public/tenant to apply CSS variables.
 */

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
    currentStep:   1,
    currentYear:   new Date().getFullYear(),
    currentMonth:  new Date().getMonth(),
    selectedDate:  null,
    selectedTime:  null,
    selectedLabel: null,
    branding:      null
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    checkGreetingModal();
    await loadTenantBranding();
    renderCalendar();
});

// ── Greeting Modal ────────────────────────────────────────────────────────────
function checkGreetingModal() {
    const hasSeenModal = localStorage.getItem('icss_greeting_seen');
    if (!hasSeenModal) {
        const modal = document.getElementById('greetingModal');
        if (modal) modal.classList.remove('hidden');
    }
}

function closeGreetingModal() {
    localStorage.setItem('icss_greeting_seen', 'true');
    const modal = document.getElementById('greetingModal');
    if (modal) modal.classList.add('hidden');
}

function handleModalSelection(type) {
    localStorage.setItem('icss_greeting_seen', 'true');
    if (type === 'booking') {
        const modal = document.getElementById('greetingModal');
        if (modal) modal.classList.add('hidden');
    } else if (type === 'business') {
        window.location.href = '/platform-setup.html';
    }
}

// ── Tenant Branding ───────────────────────────────────────────────────────────
async function loadTenantBranding() {
    try {
        const res = await fetch('/api/v1/public/tenant');
        if (!res.ok) return;
        const data = await res.json();
        const b    = data.branding || {};

        state.branding = b;

        // Apply CSS variable
        if (b.primaryColor) {
            document.documentElement.style.setProperty('--brand-primary', b.primaryColor);
        }

        // Update header content
        if (b.businessName) {
            document.getElementById('brandName').textContent = b.businessName;
            document.getElementById('brandMark').textContent = b.businessName.slice(0, 4).toUpperCase();
            document.title = `Book — ${b.businessName}`;
        }
        if (b.bookingTagline) {
            document.getElementById('brandSub').textContent = b.bookingTagline;
        }
        if (b.logoUrl) {
            const mark = document.getElementById('brandMark');
            mark.innerHTML = `<img src="${b.logoUrl}" alt="${b.businessName}" style="height:36px;width:auto;">`;
            mark.style.background = 'transparent';
        }
    } catch (e) {
        // Non-fatal — fallback to defaults
    }
}

// ── Step Navigation ───────────────────────────────────────────────────────────
function goToStep(step) {
    document.getElementById(`step${state.currentStep}`).classList.add('hidden');
    state.currentStep = step;
    const panel = document.getElementById(`step${step}`);
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateProgress();
}

function updateProgress() {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`step-indicator-${i}`);
        if (!el) continue;
        el.classList.remove('active', 'done');
        if (i < state.currentStep)  el.classList.add('done');
        if (i === state.currentStep) el.classList.add('active');
    }
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function changeMonth(dir) {
    state.currentMonth += dir;
    if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
    if (state.currentMonth < 0)  { state.currentMonth = 11; state.currentYear--; }
    renderCalendar();
}

function renderCalendar() {
    document.getElementById('calMonthTitle').textContent =
        `${MONTHS[state.currentMonth]} ${state.currentYear}`;

    const today       = new Date().toISOString().slice(0, 10);
    const maxDate     = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    const maxDateStr  = maxDate.toISOString().slice(0, 10);

    const firstDay    = new Date(state.currentYear, state.currentMonth, 1).getDay();
    const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();

    const grid = document.getElementById('calGrid');

    // Remove old day cells (keep headers)
    const dayHeaders = grid.querySelectorAll('.cal-day-header');
    grid.innerHTML = '';
    dayHeaders.forEach(h => grid.appendChild(h.cloneNode(true)));

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        const blank = document.createElement('div');
        blank.className = 'cal-day cal-day-empty';
        grid.appendChild(blank);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const mm      = String(state.currentMonth + 1).padStart(2, '0');
        const dd      = String(d).padStart(2, '0');
        const dateStr = `${state.currentYear}-${mm}-${dd}`;

        const el = document.createElement('div');
        el.className = 'cal-day';
        el.textContent = d;

        const isPast    = dateStr < today;
        const isTooFar  = dateStr > maxDateStr;
        const isToday   = dateStr === today;
        const isSelected = dateStr === state.selectedDate;

        if (isPast || isTooFar) {
            el.classList.add('cal-day-disabled');
        } else {
            el.setAttribute('data-date', dateStr);
            el.onclick = () => selectDate(dateStr);
        }

        if (isToday)    el.classList.add('cal-day-today');
        if (isSelected) el.classList.add('cal-day-selected');

        grid.appendChild(el);
    }
}

async function selectDate(dateStr) {
    state.selectedDate = dateStr;

    // Highlight in calendar
    document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('cal-day-selected'));
    const target = document.querySelector(`[data-date="${dateStr}"]`);
    if (target) target.classList.add('cal-day-selected');

    // Transition to step 2 and load slots
    const d    = new Date(dateStr + 'T00:00:00');
    const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    document.getElementById('selectedDateLabel').textContent = label;

    goToStep(2);
    await loadSlots(dateStr);
}

// ── Time Slots ────────────────────────────────────────────────────────────────
async function loadSlots(dateStr) {
    const grid = document.getElementById('slotGrid');
    grid.innerHTML = '<div class="slot-loading">Loading available times…</div>';

    try {
        const res  = await fetch(`/api/v1/availability?date=${dateStr}`);
        const data = await res.json();
        renderSlots(data.slots || []);
    } catch (e) {
        grid.innerHTML = '<div class="slot-loading" style="color:#ef4444;">Failed to load times. Please try again.</div>';
    }
}

function renderSlots(slots) {
    const grid = document.getElementById('slotGrid');

    const available = slots.filter(s => s.available);
    if (available.length === 0) {
        grid.innerHTML = '<div class="slot-loading">No available times on this date. Please choose another day.</div>';
        return;
    }

    grid.innerHTML = '';
    slots.forEach(slot => {
        const pill = document.createElement('div');
        pill.className = `slot-pill${slot.available ? '' : ' slot-unavailable'}`;
        pill.textContent = slot.label;

        if (slot.available) {
            pill.dataset.time  = slot.time;
            pill.dataset.label = slot.label;
            pill.onclick = () => selectSlot(slot.time, slot.label, pill);
        }

        grid.appendChild(pill);
    });
}

function selectSlot(time, label, el) {
    state.selectedTime  = time;
    state.selectedLabel = label;

    document.querySelectorAll('.slot-pill').forEach(p => p.classList.remove('slot-selected'));
    el.classList.add('slot-selected');

    // Small delay so user sees the selection, then move to step 3
    setTimeout(() => {
        const d = new Date(state.selectedDate + 'T00:00:00');
        const dateLong = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        document.getElementById('selectedSummaryLabel').textContent = `${dateLong} at ${label}`;
        goToStep(3);
    }, 200);
}

// ── Form Submission ───────────────────────────────────────────────────────────
async function submitBooking(e) {
    e.preventDefault();
    const errEl = document.getElementById('formError');
    const btn   = document.getElementById('submitBtn');
    const label = document.getElementById('submitLabel');

    errEl.textContent = '';

    const name  = document.getElementById('fieldName').value.trim();
    const email = document.getElementById('fieldEmail').value.trim();
    const phone = document.getElementById('fieldPhone').value.trim();
    const notes = document.getElementById('fieldNotes').value.trim();

    if (!name || !email || !phone) {
        errEl.textContent = 'Name, email, and phone are required.';
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = 'Please enter a valid email address.';
        return;
    }

    btn.disabled = true;
    label.textContent = 'Booking…';

    try {
        const res = await fetch('/api/v1/bookings', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                name, email, phone, notes,
                date: state.selectedDate,
                time: state.selectedTime
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Booking failed.');

        // Show confirmation
        const d = new Date(state.selectedDate + 'T00:00:00');
        document.getElementById('confirmDate').textContent  = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        document.getElementById('confirmTime').textContent  = state.selectedLabel;
        document.getElementById('confirmName').textContent  = name;
        document.getElementById('confirmEmail').textContent = email;

        goToStep(4);
    } catch (err) {
        errEl.textContent = err.message;
        btn.disabled  = false;
        label.textContent = 'Confirm Appointment';
    }
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function resetBooking() {
    state.selectedDate  = null;
    state.selectedTime  = null;
    state.selectedLabel = null;
    document.getElementById('bookingForm').reset();
    goToStep(1);
    renderCalendar();
}
