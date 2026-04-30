import React, { useState, useEffect } from 'react';
import styles from './ThemeSpa.module.css';
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


export default function ThemeSpa({ tenant, services, onBook }) {
    const [selectedService, setSelectedService] = useState(services[0] || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedTherapist, setSelectedTherapist] = useState('Any available');
    const [availability, setAvailability] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [allergies, setAllergies] = useState('');
    const [requests, setRequests] = useState('');
    const [receiptImage, setReceiptImage] = useState(null);

    const therapists = [
      { id: 'any', name: 'Any available', icon: 'fa-leaf' },
      { id: 'jade', name: 'Jade (holistic facialist)', icon: 'fa-hand-holding-heart' },
      { id: 'maya', name: 'Maya (massage & bodywork)', icon: 'fa-hands-praying' },
      { id: 'elena', name: 'Elena (clinical esthetician)', icon: 'fa-microscope' }
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

        const combinedNotes = `Therapist: ${selectedTherapist}
DOB: ${birthDate}
Allergies: ${allergies}
Requests: ${requests}`;

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
            alert(err.message || 'Failed to book appointment.');
        }
    };

    return (
        <>
            <div className={styles.ThemeSpaWrapper}>
            <div className={styles.ThemeSpaBody}>
                <div className={styles['spa-system']}>
                    <div className={styles.header}>
                        <div className={styles.brand}>
                            <div className={styles['brand-icon']}>
                                <i className="fas fa-leaf"></i>
                            </div>
                            <div className={styles['brand-text']}>
                                <h1>{tenant.name}</h1>
                                <p><i className="fas fa-droplet"></i> {tenant.branding?.bookingTagline || 'organic · holistic · results-driven'} <i className="fas fa-circle" style={{fontSize: '5px', margin: '0 8px'}}></i> {tenant.branding?.location || 'Premium Spa'}</p>
                            </div>
                        </div>
                        <div className={styles['header-actions']}>
                            <div className={styles['spa-tag']}><i className="fas fa-seedling"></i> vegan + cruelty-free</div>
                            <div className={styles['spa-tag']}><i className="fas fa-spa"></i> aromatherapy included</div>
                        </div>
                    </div>

                    <div className={styles['booking-grid']}>
                        <div className={styles['selection-panel']}>
                            <div className={styles['section-title']}>
                                <i className="fas fa-hands-bubbles"></i>
                                <h2>select treatment</h2>
                            </div>
                            <div className={styles['treatment-list']}>
                                {services.map(svc => (
                                    <div 
                                        key={svc.id} 
                                        className={`${styles['treatment-card']} ${selectedService?.id === svc.id ? styles.selected : ''}`}
                                        onClick={() => setSelectedService(svc)}
                                    >
                                        <div className={styles['treatment-info']}>
                                            <div className={styles['treatment-icon']}><i className={`fas fa-face-smile`}></i></div>
                                            <div className={styles['treatment-details']}>
                                                <h3>{svc.name}</h3>
                                                <span><i className="far fa-clock"></i> {svc.duration_minutes} min</span>
                                            </div>
                                        </div>
                                        <div className={styles['treatment-price']}>${svc.price}</div>
                                    </div>
                                ))}
                            </div>

                            <div className={styles['therapist-section']}>
                                <div className={styles['label-icon']}>
                                    <i className="fas fa-user-tie"></i>
                                    <span>preferred esthetician (optional)</span>
                                </div>
                                <div className={styles['therapist-options']}>
                                    {therapists.map(th => (
                                        <div 
                                            key={th.id}
                                            className={`${styles['therapist-chip']} ${selectedTherapist === th.name ? styles.selected : ''}`}
                                            onClick={() => setSelectedTherapist(th.name)}
                                        >
                                            <i className={`fas ${th.icon}`}></i>
                                            <span>{th.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles['date-section']}>
                                <div className={styles['label-icon']}>
                                    <i className="fas fa-calendar-spa"></i>
                                    <span>appointment date</span>
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
                                    <span>available times</span>
                                </div>
                                {loadingSlots ? <p style={{color: '#426042'}}>Loading slots...</p> : (
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
                                        {availability.length === 0 && <p style={{color: '#426042'}}>No slots available.</p>}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles['booking-form-panel']}>
                            <div className={styles['section-title']} style={{marginBottom: '1.2rem'}}>
                                <i className="fas fa-user-astronaut"></i>
                                <h2>guest details</h2>
                            </div>

                            <form onSubmit={handleBooking}>
                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-user"></i> full name</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-pen"></i>
                                        <input type="text" required placeholder="e.g., Sophia Reed" value={name} onChange={e => setName(e.target.value)} />
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-envelope"></i> email</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-paper-plane"></i>
                                        <input type="email" required placeholder="sophia@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-phone"></i> phone</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-mobile"></i>
                                        <input type="tel" required placeholder="(503) 555-0123" value={phone} onChange={e => setPhone(e.target.value)} />
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-cake-candles"></i> birth date (for skincare)</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-calendar"></i>
                                        <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-allergies"></i> allergies / sensitivities</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-leaf"></i>
                                        <input type="text" placeholder="e.g., nuts, lavender, none" value={allergies} onChange={e => setAllergies(e.target.value)} />
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-message"></i> special requests</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-feather"></i>
                                        <textarea placeholder="Focus areas, pressure preference..." value={requests} onChange={e => setRequests(e.target.value)}></textarea>
                                    </div>
                                </div>

                                {needsReceipt && (
                                    <div className={styles['form-group']}>
                                        <label><i className="fas fa-file-invoice-dollar"></i> payment receipt</label>
                                        <div style={{color: '#5f7e5f', fontSize: '0.8rem', marginBottom: '8px'}}>
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
                                        <span><i className="fas fa-spa"></i> Treatment</span>
                                        <span>{selectedService ? selectedService.name : '—'}</span>
                                    </div>
                                    <div className={styles['summary-line']}>
                                        <span><i className="fas fa-user-check"></i> Esthetician</span>
                                        <span>{selectedTherapist}</span>
                                    </div>
                                    <div className={styles['summary-line']}>
                                        <span><i className="fas fa-calendar"></i> Date & time</span>
                                        <span>{selectedDate} at {selectedTime || '—'}</span>
                                    </div>
                                    <div className={`${styles['summary-line']} ${styles.total}`}>
                                        <span>total</span>
                                        <span>${selectedService ? selectedService.price : '0'}</span>
                                    </div>
                                </div>

                                <button type="submit" className={styles['book-btn']}>
                                    <i className="fas fa-calendar-check"></i> reserve your ritual
                                </button>
                                <div className={styles['footer-note']}>
                                    <span><i className="fas fa-clock"></i> arrive 10min early</span>
                                    <span><i className="fas fa-ban"></i> 24h cancellation</span>
                                </div>
                            </form>
                        </div>
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
