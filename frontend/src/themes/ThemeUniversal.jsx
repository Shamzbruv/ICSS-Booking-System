import React, { useState, useEffect } from 'react';
import styles from './ThemeUniversal.module.css';
import { api } from '../api';

// ── Calendar helper ────────────────────────────────────────────
function generateICS(serviceName, date, time, tenantName, location) {
    const [h, m] = time.split(':').map(Number);
    const [yr, mo, da] = date.split('-').map(Number);
    const pad = n => String(n).padStart(2, '0');
    const dtStart = yr + "" + pad(mo) + pad(da) + "T" + pad(h) + pad(m) + "00";
    const endH = h + 1; // assume 1hr default end
    const dtEnd   = yr + "" + pad(mo) + pad(da) + "T" + pad(endH) + pad(m) + "00";
    const uid = Date.now() + "@icssbookings.com";
    const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ICSS Bookings//EN',
        'BEGIN:VEVENT',
        'UID:' + uid,
        'DTSTART:' + dtStart,
        'DTEND:' + dtEnd,
        'SUMMARY:' + serviceName + ' @ ' + tenantName,
        'LOCATION:' + (location || tenantName),
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
    const dtStart = yr + "" + pad(mo) + pad(da) + "T" + pad(h) + pad(m) + "00";
    const endH = h + 1;
    const dtEnd   = yr + "" + pad(mo) + pad(da) + "T" + pad(endH) + pad(m) + "00";
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: serviceName + ' @ ' + tenantName,
        dates: dtStart + '/' + dtEnd,
        location: location || tenantName,
    });
    return "https://calendar.google.com/calendar/render?" + params;
}


export default function ThemeUniversal({ tenant, services, onBook }) {
    const [selectedService, setSelectedService] = useState(services[0] || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState('Anyone available');
    const [availability, setAvailability] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [receiptImage, setReceiptImage] = useState(null);

    const staffMembers = [
      { id: 'any', name: 'Anyone available', icon: 'fa-user-group' },
      { id: 'staff1', name: 'Staff Member 1', icon: 'fa-user' },
      { id: 'staff2', name: 'Staff Member 2', icon: 'fa-user' },
      { id: 'staff3', name: 'Staff Member 3', icon: 'fa-user-tie' }
    ];

    useEffect(() => {
        if (!selectedDate || !selectedService) return;
        setLoadingSlots(true);
        api.publicAvailability(tenant.slug, selectedDate, selectedService.id)
            .then(data => setAvailability(((data.slots || []).filter(s => s.available))))
            .catch(err => { console.error("[Availability]", err.message); setAvailability([]); })
            .finally(() => setLoadingSlots(false));
    }, [tenant.slug, selectedDate, selectedService]);

        const resolvedPaymentMode = (() => {
        const svcMode = selectedService?.payment_mode;
        if (svcMode && svcMode !== 'tenant_default') return svcMode;
        return tenant.default_payment_mode || 'none';
    })();
    const needsReceipt = resolvedPaymentMode === 'manual' && tenant.manual_payment_enabled;

    const handleBooking = async (e) => {
        e.preventDefault();
        if (!selectedTime) return alert('Please select a time slot.');
        if (needsReceipt && !receiptImage) return alert('Please attach your bank transfer receipt.');
        
        let receiptBase64 = null;
        if (receiptImage) {
            const reader = new FileReader();
            reader.readAsDataURL(receiptImage);
            receiptBase64 = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result);
            });
        }

        const combinedNotes = `Staff: ${selectedStaff}
Notes: ${notes || 'None'}`;

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
                setConfirmModal({ service: selectedService.name, date: selectedDate, time: selectedTime });
            }
        } catch (err) {
            alert(err.message || 'Failed to complete booking.');
        }
    };

    return (
        <>
            <div className={styles.ThemeUniversalWrapper}>
            <div className={styles['booking-system']}>
                <div className={styles.header}>
                    <div className={styles.brand}>
                        <div className={styles['brand-icon']}>
                            <i className="fas fa-calendar-check"></i>
                        </div>
                        <div className={styles['brand-text']}>
                            <h1>{tenant.name}</h1>
                            <p><i className="fas fa-map-pin"></i> {tenant.branding?.location || 'Your Business Name'} · Online Booking</p>
                        </div>
                    </div>
                    <div className={styles['header-actions']}>
                        <div className={styles.badge}><i className="fas fa-clock"></i> Mon–Sat 9am–7pm</div>
                        <div className={styles.badge}><i className="fas fa-credit-card"></i> Pay online or in-person</div>
                    </div>
                </div>

                <div className={styles['booking-grid']}>
                    <div className={styles['selection-panel']}>
                        <div className={styles['section-title']}>
                            <i className="fas fa-list-ul"></i>
                            <h2>Select service</h2>
                        </div>

                        <div className={styles['service-list']}>
                            {services.map(svc => (
                                <div 
                                    key={svc.id} 
                                    className={`${styles['service-card']} ${selectedService?.id === svc.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedService(svc)}
                                >
                                    <div className={styles['service-info']}>
                                        <div className={styles['service-icon']}><i className={`fas fa-star`}></i></div>
                                        <div className={styles['service-details']}>
                                            <h3>{svc.name}</h3>
                                            <span><i className="far fa-clock"></i> {svc.duration_minutes} min duration</span>
                                        </div>
                                    </div>
                                    <div className={styles['service-price']}>
                                        {svc.price === 0 ? 'Free' : `$${svc.price}`}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles['staff-section']}>
                            <div className={styles['label-icon']}>
                                <i className="fas fa-user-circle"></i>
                                <span>Preferred staff (optional)</span>
                            </div>
                            <div className={styles['staff-options']}>
                                {staffMembers.map(staff => (
                                    <div 
                                        key={staff.id}
                                        className={`${styles['staff-chip']} ${selectedStaff === staff.name ? styles.selected : ''}`}
                                        onClick={() => setSelectedStaff(staff.name)}
                                    >
                                        <i className={`fas ${staff.icon}`}></i>
                                        <span>{staff.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles['date-section']}>
                            <div className={styles['label-icon']}>
                                <i className="fas fa-calendar-alt"></i>
                                <span>Choose date</span>
                            </div>
                            <div className={styles['date-selector']}>
                                <input 
                                    type="date" 
                                    min={new Date().toISOString().split('T')[0]}
                                    value={selectedDate}
                                    onChange={e => setSelectedDate(e.target.value)}
                                />
                                <i className="fas fa-chevron-down"></i>
                            </div>
                        </div>

                        <div>
                            <div className={styles['label-icon']}>
                                <i className="fas fa-clock"></i>
                                <span>Select time</span>
                            </div>
                            {loadingSlots ? <p style={{color: '#64748b'}}>Loading slots...</p> : (
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
                                    {availability.length === 0 && <p style={{color: '#64748b'}}>No slots available.</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles['booking-form-panel']}>
                        <div className={styles['section-title']} style={{marginBottom: '1.2rem'}}>
                            <i className="fas fa-user-pen"></i>
                            <h2>Your details</h2>
                        </div>

                        <form onSubmit={handleBooking}>
                            <div className={styles['form-group']}>
                                <label><i className="fas fa-user"></i> Full name</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-user"></i>
                                    <input type="text" required placeholder="John Smith" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-envelope"></i> Email address</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-envelope"></i>
                                    <input type="email" required placeholder="john@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-phone"></i> Phone number</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-phone"></i>
                                    <input type="tel" required placeholder="(555) 123-4567" value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-pencil"></i> Notes (optional)</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-pen"></i>
                                    <textarea placeholder="Any special requests or information..." value={notes} onChange={e => setNotes(e.target.value)}></textarea>
                                </div>
                            </div>

                            {needsReceipt && (
                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-file-invoice-dollar"></i> Deposit receipt</label>
                                    <div style={{color: '#64748b', fontSize: '0.8rem', marginBottom: '8px'}}>
                                        {tenant.bank_transfer_instructions || 'Please attach your transfer screenshot.'}
                                    </div>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-upload"></i>
                                        <input type="file" accept="image/*" required onChange={e => setReceiptImage(e.target.files[0])} />
                                    </div>
                                </div>
                            )}

                            <div className={styles['booking-summary']}>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-tag"></i> Service</span>
                                    <span>{selectedService ? selectedService.name : '—'}</span>
                                </div>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-user-check"></i> Staff</span>
                                    <span>{selectedStaff}</span>
                                </div>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-calendar"></i> Date & time</span>
                                    <span>{selectedDate} at {selectedTime || '—'}</span>
                                </div>
                                <div className={`${styles['summary-line']} ${styles.total}`}>
                                    <span>Total</span>
                                    <span>${selectedService ? selectedService.price : '0'}</span>
                                </div>
                            </div>

                            <button type="submit" className={styles['book-btn']}>
                                <i className="fas fa-calendar-plus"></i> Confirm booking
                            </button>
                            <div className={styles['footer-note']}>
                                <span><i className="fas fa-shield"></i> Secure booking</span>
                                <span><i className="fas fa-undo-alt"></i> Free cancellation up to 24h before</span>
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
                background:'rgba(10, 10, 15, 0.75)', backdropFilter:'blur(8px)',
                display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                <div style={{
                    background:'#ffffff',
                    borderRadius:'24px', padding:'2.5rem 2rem', maxWidth:'400px', width:'100%',
                    boxShadow:'0 25px 50px -12px rgba(0,0,0,0.4)',
                    textAlign:'center', position:'relative', color: '#1a1a24'
                }}>
                    <div style={{
                        width: '64px', height: '64px', background: '#ecfdf5', color: '#10b981',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '2rem', margin: '0 auto 1.5rem'
                    }}>
                        <i className="fas fa-check"></i>
                    </div>
                    <h2 style={{fontSize:'1.5rem', fontWeight: 800, marginBottom:'0.5rem', letterSpacing: '-0.02em'}}>Booking Confirmed!</h2>
                    <p style={{color:'#64748b', fontSize:'0.95rem', marginBottom:'1.5rem', lineHeight:1.5}}>
                        Your appointment has been secured. A confirmation email is on its way.
                    </p>
                    <div style={{background:'#f8fafc', borderRadius:'16px', padding:'1.2rem', marginBottom:'1.5rem', textAlign:'left', border:'1px solid #e2e8f0'}}>
                        <p style={{margin:'0 0 4px', fontSize:'0.8rem', color:'#64748b', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em'}}>Appointment Summary</p>
                        <p style={{margin:'4px 0', color:'#0f172a', fontWeight:700, fontSize:'1.05rem'}}>{confirmModal.service}</p>
                        <p style={{margin:'4px 0', color:'#475569', fontSize:'0.95rem'}}>
                            {new Date(confirmModal.date + 'T00:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
                            {' • '}
                            {(() => { const [h,m]=confirmModal.time.split(':'); const hr=parseInt(h); return (hr>12?hr-12:hr)+":"+m+" "+(hr>=12?'PM':'AM'); })()}
                        </p>
                    </div>
                    <p style={{color:'#64748b', fontSize:'0.85rem', marginBottom:'0.8rem', fontWeight:600}}>Add to your calendar</p>
                    <div style={{display:'flex', gap:'10px', justifyContent:'center', marginBottom:'1.8rem', flexWrap:'wrap'}}>
                        <button onClick={() => generateICS(confirmModal.service, confirmModal.date, confirmModal.time, tenant.name, tenant.branding?.location)} style={{
                            background:'#fff', border:'1px solid #cbd5e1', borderRadius:'12px', padding:'10px 16px',
                            color:'#334155', fontWeight:600, fontSize:'0.85rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px',
                            transition: 'all 0.2s'
                        }}><i className="fab fa-apple"></i> Apple / Outlook</button>
                        <a href={googleCalUrl(confirmModal.service, confirmModal.date, confirmModal.time, tenant.name, tenant.branding?.location)} target="_blank" rel="noreferrer" style={{
                            background:'#fff', border:'1px solid #cbd5e1', borderRadius:'12px', padding:'10px 16px',
                            color:'#334155', fontWeight:600, fontSize:'0.85rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', textDecoration:'none',
                            transition: 'all 0.2s'
                        }}><i className="fab fa-google"></i> Google</a>
                    </div>
                    <button onClick={() => { setConfirmModal(null); window.location.reload(); }} style={{
                        background:'#0f172a', border:'none', borderRadius:'12px', padding:'14px 24px',
                        color:'#fff', fontWeight:700, fontSize:'1rem', cursor:'pointer', width:'100%',
                        transition: 'all 0.2s'
                    }}>Done</button>
                </div>
            </div>
        )}

        </>
    );
}
