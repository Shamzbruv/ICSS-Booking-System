import React, { useState, useEffect } from 'react';
import styles from './ThemeHairdresser.module.css';
import { api } from '../api';

// ── Calendar helper ────────────────────────────────────────────
function generateICS(serviceName, date, time, tenantName, location) {
    const [h, m] = time.split(':').map(Number);
    const [yr, mo, da] = date.split('-').map(Number);
    const pad = n => String(n).padStart(2, '0');
    const dtStart = `${yr}${pad(mo)}${pad(da)}T${pad(h)}${pad(m)}00`;
    const endH = h + 1; // assume 1hr default end
    const dtEnd   = `${yr}${pad(mo)}${pad(da)}T${pad(endH)}${pad(m)}00`;
    const uid = `${Date.now()}@icssbookings.com`;
    const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ICSS Bookings//EN',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${serviceName} @ ${tenantName}`,
        `LOCATION:${location || tenantName}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'appointment.ics'; a.click();
    URL.revokeObjectURL(url);
}

function googleCalUrl(serviceName, date, time, tenantName, location) {
    const [h, m] = time.split(':').map(Number);
    const [yr, mo, da] = date.split('-').map(Number);
    const pad = n => String(n).padStart(2, '0');
    const dtStart = `${yr}${pad(mo)}${pad(da)}T${pad(h)}${pad(m)}00`;
    const endH = h + 1;
    const dtEnd   = `${yr}${pad(mo)}${pad(da)}T${pad(endH)}${pad(m)}00`;
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: `${serviceName} @ ${tenantName}`,
        dates: `${dtStart}/${dtEnd}`,
        location: location || tenantName,
    });
    return `https://calendar.google.com/calendar/render?${params}`;
}

function formatDisplayDate(dateString) {
    if (!dateString) return 'Choose a date';
    return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatDisplayTime(timeString) {
    if (!timeString) return 'Choose a time';
    const [hour, minute] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Number(amount || 0));
}

export default function ThemeHairdresser({ tenant, services, onBook }) {
    const [selectedService, setSelectedService] = useState(services[0] || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedStylist, setSelectedStylist] = useState('Any available (recommended)');
    const [availability, setAvailability] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Booking confirmation modal state
    const [confirmModal, setConfirmModal] = useState(null); // { service, date, time }
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [receiptImage, setReceiptImage] = useState(null);

    // Stylists come from tenant branding settings.
    // If tenant has no stylists configured (solo operator), hide the field.
    const rawStylists = tenant.branding?.stylists || [];
    const stylists = rawStylists.length > 0
      ? [{ id: 'any', name: 'Any available (recommended)' }, ...rawStylists.map((s, i) => ({ id: `s${i}`, name: s }))]
      : [];

    useEffect(() => {
        if (!selectedDate || !selectedService) return;
        setLoadingSlots(true);
        api.publicAvailability(tenant.slug, selectedDate, selectedService.id)
            .then(data => setAvailability(((data.slots || []).filter(s => s.available))))
            .catch(err => { console.error("[Availability]", err.message); setAvailability([]); })
            .finally(() => setLoadingSlots(false));
    }, [tenant.slug, selectedDate, selectedService]);

    // Determine if manual payment is required (service-level override beats tenant default)
    const resolvedPaymentMode = (() => {
        const svcMode = selectedService?.payment_mode;
        if (svcMode && svcMode !== 'tenant_default') return svcMode;
        return tenant.default_payment_mode || 'none';
    })();
    const needsReceipt = resolvedPaymentMode === 'manual' && tenant.manual_payment_enabled;

    const handleBooking = async (e) => {
        e.preventDefault();
        if (!selectedTime) return alert('Please select a time.');
        if (needsReceipt && !receiptImage) return alert('Please attach your bank transfer receipt.');
        
        let receiptBase64 = null;
        if (receiptImage) {
            const reader = new FileReader();
            reader.readAsDataURL(receiptImage);
            receiptBase64 = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result);
            });
        }

        const combinedNotes = stylists.length > 0 ? `Stylist: ${selectedStylist}` : null;

        try {
            const res = await api.publicCreateBooking(tenant.slug, {
                service_id: selectedService.id,
                date: selectedDate,
                time: selectedTime,
                name, email, phone, notes: combinedNotes,
                receipt_image: receiptBase64
            });

            if (res.checkoutUrl) {
                window.location.href = res.checkoutUrl;
            } else {
                // Show themed confirmation modal instead of browser alert
                setConfirmModal({ service: selectedService.name, date: selectedDate, time: selectedTime });
            }
        } catch (err) {
            alert(err.message || 'Failed to book appointment.');
        }
    };

    return (
        <>
            <div className={styles.ThemeHairdresserWrapper}>
                <div className={styles['booking-system']}>
                <div className={styles.header}>
                    <div className={styles.brand}>
                        <div className={styles['brand-icon']}>
                            {tenant.branding?.logoUrl
                                ? <img src={tenant.branding.logoUrl} alt={tenant.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}} />
                                : <i className="fas fa-spa"></i>
                            }
                        </div>
                        <div className={styles['brand-text']}>
                            <h1>{tenant.name}</h1>
                            {(tenant.branding?.bookingTagline || tenant.branding?.location) && (
                                <div className={styles['brand-meta']}>
                                    {tenant.branding?.location && <span>{tenant.branding.location}</span>}
                                    {tenant.branding?.bookingTagline && <span>{tenant.branding.bookingTagline}</span>}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={styles['header-actions']}>
                        {tenant.branding?.badge1 && <div className={styles['pill-badge']}>{tenant.branding.badge1}</div>}
                        {tenant.branding?.badge2 && <div className={styles['pill-badge']}>{tenant.branding.badge2}</div>}
                    </div>
                </div>

                <div className={styles['booking-grid']}>
                    <div className={styles['selection-panel']}>
                        <div className={styles['section-title']}>
                            <i className="fas fa-scissors"></i>
                            <h2>Choose a Service</h2>
                        </div>

                        <div className={styles['service-list']}>
                            {services.map(svc => (
                                <div 
                                    key={svc.id} 
                                    className={`${styles['service-card']} ${selectedService?.id === svc.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedService(svc)}
                                >
                                    <div className={styles['service-info']}>
                                        <div className={styles['service-icon']}><i className={`fas fa-cut`}></i></div>
                                        <div className={styles['service-details']}>
                                            <h3>{svc.name}</h3>
                                            <span>{svc.duration_minutes} min</span>
                                        </div>
                                    </div>
                                    <div className={styles['service-price']}>{formatCurrency(svc.price)}</div>
                                </div>
                            ))}
                        </div>

                        <div className={styles['date-section']}>
                            <div className={styles['label-icon']}>
                                <span>Choose your date</span>
                            </div>
                            <div className={styles['date-selector']}>
                                <input 
                                    type="date" 
                                    min={new Date().toISOString().split('T')[0]}
                                    value={selectedDate}
                                    onChange={e => setSelectedDate(e.target.value)}
                                />
                                <i className="fas fa-calendar-alt"></i>
                            </div>
                        </div>

                        <div>
                            <div className={styles['label-icon']}>
                                <span>Select a time</span>
                            </div>
                            {loadingSlots ? <p className={styles['helper-copy']}>Loading available times...</p> : (
                                <div className={styles['time-slots']}>
                                    {availability.map(slot => (
                                        <div 
                                            key={slot.time}
                                            className={`${styles['time-slot']} ${selectedTime === slot.time ? styles.selected : ''}`}
                                            onClick={() => setSelectedTime(slot.time)}
                                        >
{slot.label || slot.time}
                                        </div>
                                    ))}
                                    {availability.length === 0 && <p className={styles['helper-copy']}>No slots available for this date.</p>}
                                </div>
                            )}
                        </div>
                        {tenant.branding?.bookingFooterNote && (
                            <div className={styles['booking-note']}>
                                {tenant.branding.bookingFooterNote}
                            </div>
                        )}
                    </div>

                    <div className={styles['booking-form-panel']}>
                        <div className={styles['section-title']} style={{marginBottom: '1.2rem'}}>
                            <i className="fas fa-calendar-check"></i>
                            <h2>Your Details</h2>
                        </div>

                        <form onSubmit={handleBooking}>
                            <div className={styles['form-group']}>
                                <label>Full name</label>
                                <div className={styles['input-wrapper']}>
                                    <input type="text" required placeholder="e.g., Olivia Rose" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label>Email address</label>
                                <div className={styles['input-wrapper']}>
                                    <input type="email" required placeholder="bella@blush.com" value={email} onChange={e => setEmail(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label>Phone number</label>
                                <div className={styles['input-wrapper']}>
                                    <input type="tel" required placeholder="+1 (555) 000-9999" value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                            </div>

                            {stylists.length > 0 && (
                                <div className={styles['form-group']}>
                                    <label>Stylist preference</label>
                                    <div className={styles['input-wrapper']}>
                                        <select value={selectedStylist} onChange={e => setSelectedStylist(e.target.value)}>
                                            {stylists.map(s => (
                                                <option key={s.id} value={s.name}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {needsReceipt && (
                                <div className={styles['form-group']}>
                                    <label>Bank transfer receipt</label>
                                    <div className={styles['helper-copy']} style={{marginBottom: '8px'}}>
                                        {tenant.bank_transfer_instructions || 'Please attach a screenshot of your bank transfer before booking.'}
                                    </div>
                                    <div className={styles['input-wrapper']}>
                                        <input type="file" accept="image/*" required onChange={e => setReceiptImage(e.target.files[0])} />
                                    </div>
                                </div>
                            )}

                            <div className={styles['booking-summary']}>
                                <div className={styles['summary-line']}>
                                    <span>Service</span>
                                    <span>{selectedService ? selectedService.name : '—'}</span>
                                </div>
                                <div className={styles['summary-line']}>
                                    <span>Date & time</span>
                                    <span>{formatDisplayDate(selectedDate)} at {formatDisplayTime(selectedTime)}</span>
                                </div>
                                <div className={`${styles['summary-line']} ${styles.total}`}>
                                    <span>Total</span>
                                    <span>{formatCurrency(selectedService ? selectedService.price : 0)}</span>
                                </div>
                            </div>

                            <button type="submit" className={styles['book-btn']}>
                                Complete Booking
                            </button>
                            <div className={styles['footer-note']}>
                                Secure booking. Cancel free up to 6 hours before.
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
        {/* ✨ Themed Confirmation Modal */}
        {confirmModal && (
            <div className={styles.modalOverlay}>
                <div className={styles.modalCard}>
                    <div className={styles.modalIcon}><i className="fas fa-check"></i></div>
                    <h2>Booking Confirmed</h2>
                    <p className={styles.modalLead}>
                        A confirmation email is on its way with all of your appointment details.
                    </p>
                    <div className={styles.modalSummary}>
                        <p className={styles.modalSummaryLabel}>Your appointment</p>
                        <p className={styles.modalSummaryService}>{confirmModal.service}</p>
                        <p className={styles.modalSummaryTime}>
                            {new Date(confirmModal.date + 'T00:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
                            {' at '}
                            {(() => { const [h,m]=confirmModal.time.split(':'); const hr=parseInt(h); return `${hr>12?hr-12:hr}:${m} ${hr>=12?'PM':'AM'}`; })()}
                        </p>
                    </div>
                    <p className={styles.modalToolsLabel}>Add to your calendar</p>
                    <div className={styles.modalActions}>
                        <button
                            onClick={() => generateICS(confirmModal.service, confirmModal.date, confirmModal.time, tenant.name, tenant.branding?.location)}
                            className={styles.modalSecondaryButton}
                        >
                            Apple / Outlook
                        </button>
                        <a
                            href={googleCalUrl(confirmModal.service, confirmModal.date, confirmModal.time, tenant.name, tenant.branding?.location)}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.modalSecondaryButton}
                        >
                            Google Calendar
                        </a>
                    </div>
                    <button onClick={() => { setConfirmModal(null); window.location.reload(); }} className={styles.modalPrimaryButton}>Done</button>
                </div>
            </div>
        )}
        </>
    );
}
