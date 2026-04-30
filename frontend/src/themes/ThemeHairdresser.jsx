import React, { useState, useEffect } from 'react';
import styles from './ThemeHairdresser.module.css';
import { api } from '../api';

export default function ThemeHairdresser({ tenant, services, onBook }) {
    const [selectedService, setSelectedService] = useState(services[0] || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedStylist, setSelectedStylist] = useState('Any available (recommended)');
    const [availability, setAvailability] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [receiptImage, setReceiptImage] = useState(null);

    const stylists = [
      { id: 'any', name: '🌸 Any available (recommended)' },
      { id: 'chloe', name: '💇‍♀️ Chloe (balayage queen)' },
      { id: 'maya', name: '✨ Maya (curls & bridal)' },
      { id: 'sasha', name: '🎀 Sasha (precision cuts)' }
    ];

    useEffect(() => {
        if (!selectedDate || !selectedService) return;
        setLoadingSlots(true);
        api.publicAvailability(tenant.slug, selectedDate, selectedService.id)
            .then(data => setAvailability(((data.slots || []).filter(s => s.available))))
            .catch(err => { console.error("[Availability]", err.message); setAvailability([]); })
            .finally(() => setLoadingSlots(false));
    }, [tenant.slug, selectedDate, selectedService]);

    const handleBooking = async (e) => {
        e.preventDefault();
        if (!selectedTime) return alert('Please select a time.');
        
        let receiptBase64 = null;
        if (receiptImage) {
            const reader = new FileReader();
            reader.readAsDataURL(receiptImage);
            receiptBase64 = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result);
            });
        }

        const combinedNotes = `Stylist: ${selectedStylist}`;

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
                alert('✨ BOOKING CONFIRMED ✨\nA confirmation has been sent. See you soon, beauty! 💖');
                window.location.reload();
            }
        } catch (err) {
            alert(err.message || 'Failed to book appointment.');
        }
    };

    return (
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
                        <div style={{marginTop: '14px', fontSize: '0.85rem', color: '#a04d6b'}}>
                            <i className="fas fa-sparkles" style={{marginRight: '6px'}}></i> all appointments include a complimentary drink
                        </div>
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

                            {tenant.manual_payment_enabled && tenant.default_payment_mode === 'manual' && (
                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-file-invoice-dollar"></i> deposit receipt</label>
                                    <div style={{color: '#a04d6b', fontSize: '0.85rem', marginBottom: '8px'}}>
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
    );
}
