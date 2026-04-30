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
                <div className={`${styles['booking-system']} ${styles.glitter}`}>
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
                                <p>
                                    {tenant.branding?.location && <><i className="fas fa-map-pin"></i> {tenant.branding.location}</>}
                                    {tenant.branding?.bookingTagline && <><i className="fas fa-circle" style={{fontSize:'5px',margin:'0 8px'}}></i>{tenant.branding.bookingTagline}</>}
                                </p>
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
                            <h2>pick your magic</h2>
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
                                            <span><i className="far fa-clock"></i> {svc.duration_minutes} min</span>
                                        </div>
                                    </div>
                                    <div className={styles['service-price']}>${svc.price}</div>
                                </div>
                            ))}
                        </div>

                        <div className={styles['date-section']}>
                            <div className={styles['label-icon']}>
                                <i className="fas fa-calendar-heart"></i>
                                <span>choose your date</span>
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
                                <i className="fas fa-clock"></i>
                                <span>select time</span>
                            </div>
                            {loadingSlots ? <p style={{color: '#6b3c51'}}>Loading slots...</p> : (
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
                                    {availability.length === 0 && <p style={{color: '#6b3c51'}}>No slots available.</p>}
                                </div>
                            )}
                        </div>
                        {tenant.branding?.bookingFooterNote && (
                            <div style={{marginTop: '14px', fontSize: '0.85rem', color: '#a04d6b'}}>
                                <i className="fas fa-sparkles" style={{marginRight: '6px'}}></i>
                                {tenant.branding.bookingFooterNote}
                            </div>
                        )}
                    </div>

                    <div className={styles['booking-form-panel']}>
                        <div className={styles['section-title']} style={{marginBottom: '1.2rem'}}>
                            <i className="fas fa-feather-alt"></i>
                            <h2>your details</h2>
                        </div>

                        <form onSubmit={handleBooking}>
                            <div className={styles['form-group']}>
                                <label><i className="fas fa-user-circle"></i> full name</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-smile"></i>
                                    <input type="text" required placeholder="e.g., Olivia Rose" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-envelope"></i> email</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-paper-plane"></i>
                                    <input type="email" required placeholder="bella@blush.com" value={email} onChange={e => setEmail(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-phone-alt"></i> phone</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-mobile-alt"></i>
                                    <input type="tel" required placeholder="+1 (555) 000-9999" value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                            </div>

                            {stylists.length > 0 && (
                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-user-tag"></i> stylist preference</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-star"></i>
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
                                    <label><i className="fas fa-file-invoice-dollar"></i> bank transfer receipt</label>
                                    <div style={{color: '#a04d6b', fontSize: '0.85rem', marginBottom: '8px'}}>
                                        {tenant.bank_transfer_instructions || 'Please attach a screenshot of your bank transfer before booking.'}
                                    </div>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-upload"></i>
                                        <input type="file" accept="image/*" required onChange={e => setReceiptImage(e.target.files[0])} />
                                    </div>
                                </div>
                            )}

                            <div className={styles['booking-summary']}>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-cut" style={{marginRight: '8px'}}></i>Service</span>
                                    <span>{selectedService ? selectedService.name : '—'}</span>
                                </div>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-calendar-day"></i> Date & time</span>
                                    <span>{selectedDate} at {selectedTime || '—'}</span>
                                </div>
                                <div className={`${styles['summary-line']} ${styles.total}`}>
                                    <span>total</span>
                                    <span>${selectedService ? selectedService.price : '0'}</span>
                                </div>
                            </div>

                            <button type="submit" className={styles['book-btn']}>
                                <i className="fas fa-magic"></i> book now · glow
                            </button>
                            <div className={styles['footer-note']}>
                                <i className="fas fa-lock" style={{marginRight: '6px'}}></i> secure booking · cancel free up to 6h before
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
        {/* ✨ Themed Confirmation Modal */}
        {confirmModal && (
            <div style={{
                position:'fixed', inset:0, zIndex:9999,
                background:'rgba(80,30,55,0.45)', backdropFilter:'blur(6px)',
                display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'
            }}>
                <div style={{
                    background:'linear-gradient(145deg,#fff9fc,#ffe6f2)',
                    borderRadius:'32px', padding:'2.2rem 2rem', maxWidth:'380px', width:'100%',
                    boxShadow:'0 30px 60px -10px rgba(210,100,150,0.35), 0 0 0 1px #fff3f9',
                    textAlign:'center', position:'relative'
                }}>
                    <div style={{fontSize:'3rem', marginBottom:'0.5rem'}}>✨</div>
                    <h2 style={{fontFamily:"'Playfair Display',serif", color:'#572c41', fontSize:'1.7rem', marginBottom:'0.5rem'}}>Booking Confirmed!</h2>
                    <p style={{color:'#a04d6b', fontSize:'0.95rem', marginBottom:'1.2rem', lineHeight:1.6}}>
                        A confirmation email is on its way. We can't wait to see you! 💖
                    </p>
                    <div style={{background:'#ffecf3', borderRadius:'18px', padding:'1rem 1.2rem', marginBottom:'1.4rem', textAlign:'left', border:'1px dashed #e387aa'}}>
                        <p style={{margin:'0 0 6px', fontSize:'0.85rem', color:'#7a4060', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em'}}>Your appointment</p>
                        <p style={{margin:'3px 0', color:'#3d1f2d', fontWeight:600}}>{confirmModal.service}</p>
                        <p style={{margin:'3px 0', color:'#7a4060', fontSize:'0.9rem'}}>
                            {new Date(confirmModal.date + 'T00:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
                            {' at '}
                            {(() => { const [h,m]=confirmModal.time.split(':'); const hr=parseInt(h); return `${hr>12?hr-12:hr}:${m} ${hr>=12?'PM':'AM'}`; })()}
                        </p>
                    </div>
                    <p style={{color:'#a04d6b', fontSize:'0.85rem', marginBottom:'0.9rem', fontWeight:500}}>Add to your calendar:</p>
                    <div style={{display:'flex', gap:'10px', justifyContent:'center', marginBottom:'1.4rem', flexWrap:'wrap'}}>
                        <button onClick={() => generateICS(confirmModal.service, confirmModal.date, confirmModal.time, tenant.name, tenant.branding?.location)} style={{
                            background:'#fff', border:'1.5px solid #dca0c0', borderRadius:'40px', padding:'9px 18px',
                            color:'#7a4060', fontWeight:600, fontSize:'0.82rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px'
                        }}>📅 Apple / Outlook</button>
                        <a href={googleCalUrl(confirmModal.service, confirmModal.date, confirmModal.time, tenant.name, tenant.branding?.location)} target="_blank" rel="noreferrer" style={{
                            background:'#fff', border:'1.5px solid #dca0c0', borderRadius:'40px', padding:'9px 18px',
                            color:'#7a4060', fontWeight:600, fontSize:'0.82rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', textDecoration:'none'
                        }}>🗓️ Google Calendar</a>
                    </div>
                    <button onClick={() => { setConfirmModal(null); window.location.reload(); }} style={{
                        background:'#d86694', border:'none', borderRadius:'60px', padding:'13px 32px',
                        color:'#fff', fontWeight:700, fontSize:'1rem', cursor:'pointer', width:'100%',
                        boxShadow:'0 8px 0 #9b4265'
                    }}>Done 💕</button>
                </div>
            </div>
        )}
        </>
    );
}
