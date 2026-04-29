import React from 'react';
import styles from './ThemeUniversalBooking.module.css';

export default function ThemeUniversalBooking({ tenant, services, onBook }) {
    return (
        <div className={styles.ThemeUniversalBookingWrapper}>
            <div className={styles.ThemeUniversalBookingBody} dangerouslySetInnerHTML={{ __html: `

<div class="booking-system">
  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-icon">
        <i class="fas fa-calendar-check"></i>
      </div>
      <div class="brand-text">
        <h1>BookFlow</h1>
        <p><i class="fas fa-map-pin"></i> Your Business Name · Online Booking</p>
      </div>
    </div>
    <div class="header-actions">
      <div class="badge"><i class="fas fa-clock"></i> Mon–Sat 9am–7pm</div>
      <div class="badge"><i class="fas fa-credit-card"></i> Pay online or in-person</div>
    </div>
  </div>

  <!-- Booking Grid -->
  <div class="booking-grid">
    <!-- Left Panel -->
    <div class="selection-panel">
      <div class="section-title">
        <i class="fas fa-list-ul"></i>
        <h2>Select service</h2>
      </div>

      <div class="service-list" id="serviceList"></div>

      <!-- Staff preference -->
      <div class="staff-section">
        <div class="label-icon">
          <i class="fas fa-user-circle"></i>
          <span>Preferred staff (optional)</span>
        </div>
        <div class="staff-options" id="staffOptions"></div>
      </div>

      <div class="date-section">
        <div class="label-icon">
          <i class="fas fa-calendar-alt"></i>
          <span>Choose date</span>
        </div>
        <div class="date-selector">
          <input type="date" id="datePicker" value="2026-04-28" min="2026-04-20">
          <i class="fas fa-chevron-down"></i>
        </div>
      </div>

      <div>
        <div class="label-icon">
          <i class="fas fa-clock"></i>
          <span>Select time</span>
        </div>
        <div class="time-slots" id="timeSlotsContainer"></div>
      </div>
    </div>

    <!-- Right Panel - Form -->
    <div class="booking-form-panel">
      <div class="section-title" style="margin-bottom: 1.2rem;">
        <i class="fas fa-user-pen"></i>
        <h2>Your details</h2>
      </div>

      <div class="form-group">
        <label><i class="fas fa-user"></i> Full name</label>
        <div class="input-wrapper">
          <i class="fas fa-user"></i>
          <input type="text" id="fullName" placeholder="John Smith" value="John Smith">
        </div>
      </div>

      <div class="form-group">
        <label><i class="fas fa-envelope"></i> Email address</label>
        <div class="input-wrapper">
          <i class="fas fa-envelope"></i>
          <input type="email" id="email" placeholder="john@email.com" value="john.smith@email.com">
        </div>
      </div>

      <div class="form-group">
        <label><i class="fas fa-phone"></i> Phone number</label>
        <div class="input-wrapper">
          <i class="fas fa-phone"></i>
          <input type="tel" id="phone" placeholder="(555) 123-4567" value="(555) 123-4567">
        </div>
      </div>

      <div class="form-group">
        <label><i class="fas fa-pencil"></i> Notes (optional)</label>
        <div class="input-wrapper">
          <i class="fas fa-pen"></i>
          <textarea id="notes" placeholder="Any special requests or information..."></textarea>
        </div>
      </div>

      <!-- Summary -->
      <div class="booking-summary" id="summaryBox">
        <div class="summary-line">
          <span><i class="fas fa-tag"></i> Service</span>
          <span id="summaryService">—</span>
        </div>
        <div class="summary-line">
          <span><i class="fas fa-user-check"></i> Staff</span>
          <span id="summaryStaff">Anyone available</span>
        </div>
        <div class="summary-line">
          <span><i class="fas fa-calendar"></i> Date & time</span>
          <span id="summaryDateTime">—</span>
        </div>
        <div class="summary-line total">
          <span>Total</span>
          <span id="summaryTotal">\$0</span>
        </div>
      </div>

      <button class="book-btn" id="bookButton">
        <i class="fas fa-calendar-plus"></i> Confirm booking
      </button>
      <div class="footer-note">
        <span><i class="fas fa-shield"></i> Secure booking</span>
        <span><i class="fas fa-undo-alt"></i> Free cancellation up to 24h before</span>
      </div>
    </div>
  </div>
</div>


            `}} />
        </div>
    );
}
