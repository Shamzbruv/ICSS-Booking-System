import React, { useState, useEffect } from 'react';
import styles from './ThemeEvents.module.css';
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


export default function ThemeEvents({ tenant, services, onBook }) {
    const [selectedService, setSelectedService] = useState(services[0] || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [availability, setAvailability] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);
    
    // Rentals specific to this template
    const rentalsOptions = [
      { id: 'tables', name: 'Farm Tables (8)', price: 240, icon: 'fa-table' },
      { id: 'chairs', name: 'Crossback Chairs (40)', price: 320, icon: 'fa-chair' },
      { id: 'linens', name: 'Premium Linens', price: 180, icon: 'fa-rug' },
      { id: 'lighting', name: 'String Lighting', price: 290, icon: 'fa-lightbulb' },
      { id: 'bar', name: 'Mobile Bar Setup', price: 400, icon: 'fa-martini-glass' },
      { id: 'lounge', name: 'Lounge Furniture Set', price: 550, icon: 'fa-couch' }
    ];
    const [selectedRentals, setSelectedRentals] = useState(new Set());

    const toggleRental = (id) => {
        const next = new Set(selectedRentals);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedRentals(next);
    };

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [guestCount, setGuestCount] = useState('40-75 guests');
    const [venue, setVenue] = useState('');
    const [notes, setNotes] = useState('');
    const [receiptImage, setReceiptImage] = useState(null);

    useEffect(() => {
        if (!selectedDate || !selectedService) return;
        setLoadingSlots(true);
        api.publicAvailability(tenant.slug, selectedDate, selectedService.id)
            .then(data => setAvailability(((data.slots || []).filter(s => s.available))))
            .catch(err => { console.error("[Availability]", err.message); setAvailability([]); })
            .finally(() => setLoadingSlots(false));
    }, [tenant.slug, selectedDate, selectedService]);

    const calculateTotal = () => {
        let base = selectedService ? Number(selectedService.price) : 0;
        let rentalTotal = 0;
        selectedRentals.forEach(id => {
            const r = rentalsOptions.find(opt => opt.id === id);
            if (r) rentalTotal += r.price;
        });
        return base + rentalTotal;
    };

        const resolvedPaymentMode = (() => {
        const svcMode = selectedService?.payment_mode;
        if (svcMode && svcMode !== 'tenant_default') return svcMode;
        return tenant.default_payment_mode || 'none';
    })();
    const needsReceipt = resolvedPaymentMode === 'manual' && tenant.manual_payment_enabled;

    const handleBooking = async (e) => {
        e.preventDefault();
        if (!selectedTime) return alert('Please select a start time.');
        if (needsReceipt && !receiptImage) return alert('Please attach your bank transfer receipt.');
        
        let receiptBase64 = null;
        if (receiptImage) {
            const reader = new FileReader();
            reader.readAsDataURL(receiptImage);
            receiptBase64 = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result);
            });
        }

        const rentalList = [];
        selectedRentals.forEach(id => {
            const r = rentalsOptions.find(opt => opt.id === id);
            if (r) rentalList.push(`${r.name} (+$${r.price})`);
        });

        const combinedNotes = `Venue: ${venue}
Guests: ${guestCount}
Rentals: ${rentalList.length ? rentalList.join(', ') : 'None'}
Notes: ${notes}`;

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
            alert(err.message || 'Failed to request booking.');
        }
    };

    return (
        <>
            <div className={styles.ThemeEventsWrapper}>
            <div className={styles.ThemeEventsBody}>
                <div className={styles['events-system']}>
                    <div className={styles.header}>
                        <div className={styles.brand}>
                            <div className={styles['brand-icon']}>
                                <i className="fas fa-champagne-glasses"></i>
                            </div>
                            <div className={styles['brand-text']}>
                                <h1>{tenant.name}</h1>
                                <p><i className="fas fa-map-pin"></i> {tenant.branding?.location || 'Premium Event Planning'} <i className="fas fa-star" style={{margin: '0 8px'}}></i> 5.0 (340+ events)</p>
                            </div>
                        </div>
                        <div className={styles['header-actions']}>
                            <div className={styles.chip}><i className="fas fa-truck"></i> delivery & setup</div>
                            <div className={styles.chip}><i className="fas fa-calendar-check"></i> 2026 dates open</div>
                        </div>
                    </div>

                    <div className={styles['booking-grid']}>
                        <div className={styles['selection-panel']}>
                            <div className={styles['section-title']}>
                                <i className="fas fa-calendar-star"></i>
                                <h2>event type</h2>
                            </div>

                            <div className={styles['event-list']}>
                                {services.map(svc => (
                                    <div 
                                        key={svc.id} 
                                        className={`${styles['event-card']} ${selectedService?.id === svc.id ? styles.selected : ''}`}
                                        onClick={() => setSelectedService(svc)}
                                    >
                                        <div className={styles['event-info']}>
                                            <div className={styles['event-icon']}><i className={`fas fa-ring`}></i></div>
                                            <div className={styles['event-details']}>
                                                <h3>{svc.name}</h3>
                                                <span>{svc.duration_minutes} min duration</span>
                                            </div>
                                        </div>
                                        <div className={styles['event-price']}>${svc.price}+</div>
                                    </div>
                                ))}
                            </div>

                            <div className={styles['rentals-section']}>
                                <div className={styles['label-icon']}>
                                    <i className="fas fa-chair"></i>
                                    <span>rental items (optional)</span>
                                </div>
                                <div className={styles['rentals-grid']}>
                                    {rentalsOptions.map(rental => (
                                        <div 
                                            key={rental.id}
                                            className={`${styles['rental-item']} ${selectedRentals.has(rental.id) ? styles.selected : ''}`}
                                            onClick={() => toggleRental(rental.id)}
                                        >
                                            <i className={`fas ${rental.icon}`}></i>
                                            <div className={styles['rental-info']}>
                                                <h4>{rental.name}</h4>
                                                <p>+${rental.price}</p>
                                            </div>
                                            <div className={styles['rental-price']}>
                                                {selectedRentals.has(rental.id) ? '✓' : '+'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles['date-section']}>
                                <div className={styles['label-icon']}>
                                    <i className="fas fa-calendar-range"></i>
                                    <span>event date</span>
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
                                    <span>start time</span>
                                </div>
                                {loadingSlots ? <p style={{color: '#5b4d40'}}>Loading slots...</p> : (
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
                                        {availability.length === 0 && <p style={{color: '#5b4d40'}}>No slots available.</p>}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles['booking-form-panel']}>
                            <div className={styles['section-title']} style={{marginBottom: '1.2rem'}}>
                                <i className="fas fa-user-group"></i>
                                <h2>host details</h2>
                            </div>

                            <form onSubmit={handleBooking}>
                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-user"></i> full name</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-pen"></i>
                                        <input type="text" required placeholder="e.g., Alexandra Morgan" value={name} onChange={e => setName(e.target.value)} />
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-envelope"></i> email</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-paper-plane"></i>
                                        <input type="email" required placeholder="hello@event.com" value={email} onChange={e => setEmail(e.target.value)} />
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
                                    <label><i className="fas fa-users"></i> guest count</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-people-group"></i>
                                        <select value={guestCount} onChange={e => setGuestCount(e.target.value)}>
                                            <option value="20-40">20–40 guests</option>
                                            <option value="40-75">40–75 guests</option>
                                            <option value="75-120">75–120 guests</option>
                                            <option value="120+">120+ guests</option>
                                        </select>
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-location-dot"></i> venue / address</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-building"></i>
                                        <input type="text" required placeholder="Venue name or address" value={venue} onChange={e => setVenue(e.target.value)} />
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-message"></i> special notes</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-feather"></i>
                                        <textarea placeholder="Dietary, setup preferences..." value={notes} onChange={e => setNotes(e.target.value)}></textarea>
                                    </div>
                                </div>

                                {needsReceipt && (
                                    <div className={styles['form-group']}>
                                        <label><i className="fas fa-file-invoice-dollar"></i> deposit receipt</label>
                                        <div style={{color: '#7a6959', fontSize: '0.85rem', marginBottom: '8px'}}>
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
                                        <span><i className="fas fa-glass-cheers"></i> Event</span>
                                        <span>{selectedService ? selectedService.name : '—'}</span>
                                    </div>
                                    <div className={styles['summary-line']}>
                                        <span><i className="fas fa-couch"></i> Rentals</span>
                                        <span>{selectedRentals.size} items</span>
                                    </div>
                                    <div className={styles['summary-line']}>
                                        <span><i className="fas fa-calendar"></i> Date & time</span>
                                        <span>{selectedDate} at {selectedTime || '—'}</span>
                                    </div>
                                    <div className={`${styles['summary-line']} ${styles.total}`}>
                                        <span>estimated total</span>
                                        <span>${calculateTotal()}</span>
                                    </div>
                                </div>

                                <button type="submit" className={styles['book-btn']}>
                                    <i className="fas fa-envelope-open-text"></i> request booking
                                </button>
                                <div className={styles['footer-note']}>
                                    <span><i className="fas fa-shield"></i> 25% deposit</span>
                                    <span><i className="fas fa-rotate-left"></i> free cancel 14d</span>
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
