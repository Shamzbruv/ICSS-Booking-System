import React, { useState, useEffect } from 'react';
import styles from './ThemeNailTech.module.css';
import api from '../api';

export default function ThemeNailTech({ tenant, services, onBook }) {
    const [selectedService, setSelectedService] = useState(services[0] || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedTech, setSelectedTech] = useState('First available');
    const [availability, setAvailability] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [colorPref, setColorPref] = useState('');
    const [nailNotes, setNailNotes] = useState('');
    const [receiptImage, setReceiptImage] = useState(null);

    const techs = [
      { id: 'any', name: 'First available', icon: 'fa-user-group' },
      { id: 'sophia', name: 'Sophia (Gel expert)', icon: 'fa-star' },
      { id: 'olivia', name: 'Olivia (Nail art queen)', icon: 'fa-paint-brush' },
      { id: 'ava', name: 'Ava (Acrylic specialist)', icon: 'fa-gem' },
      { id: 'mia', name: 'Mia (Dip & pedicure)', icon: 'fa-feather' }
    ];

    useEffect(() => {
        if (!selectedDate || !selectedService) return;
        setLoadingSlots(true);
        api.publicAvailability(tenant.slug, selectedDate, selectedService.id)
            .then(data => setAvailability(data.availability || []))
            .catch(console.error)
            .finally(() => setLoadingSlots(false));
    }, [tenant.slug, selectedDate, selectedService]);

    const handleBooking = async (e) => {
        e.preventDefault();
        if (!selectedTime) return alert('Please select a time slot.');
        
        let receiptBase64 = null;
        if (receiptImage) {
            const reader = new FileReader();
            reader.readAsDataURL(receiptImage);
            receiptBase64 = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result);
            });
        }

        const combinedNotes = `Nail Tech: ${selectedTech}\nColor: ${colorPref || 'None'}\nNotes: ${nailNotes || 'None'}`;

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
                alert('💅 BOOKING CONFIRMED 💅\nGet ready to shine! Complimentary bubbly waiting. ✨');
                window.location.reload();
            }
        } catch (err) {
            alert(err.message || 'Failed to book appointment.');
        }
    };

    return (
        <div className={styles.ThemeNailTechWrapper}>
            <div className={styles['nail-system']}>
                <div className={styles.header}>
                    <div className={styles.brand}>
                        <div className={styles['brand-icon']}>
                            <i className="fas fa-hand-sparkles"></i>
                        </div>
                        <div className={styles['brand-text']}>
                            <h1>{tenant.name}</h1>
                            <p><i className="fas fa-map-pin"></i> {tenant.branding?.location || 'Luxury Nail Studio'}  <i className="fas fa-circle" style={{fontSize: '4px', margin: '0 8px'}}></i> Luxury Nail Studio</p>
                        </div>
                    </div>
                    <div className={styles['header-actions']}>
                        <div className={styles['glam-badge']}><i className="fas fa-star"></i> 4.9 · 1.2k+ reviews</div>
                        <div className={styles['glam-badge']}><i className="fas fa-wine-glass"></i> complimentary bubbly</div>
                    </div>
                </div>

                <div className={styles['booking-grid']}>
                    <div className={styles['selection-panel']}>
                        <div className={styles['section-title']}>
                            <i className="fas fa-fill-drip"></i>
                            <h2>Choose your set</h2>
                        </div>

                        <div className={styles['service-list']}>
                            {services.map(svc => (
                                <div 
                                    key={svc.id} 
                                    className={`${styles['service-card']} ${selectedService?.id === svc.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedService(svc)}
                                >
                                    <div className={styles['service-info']}>
                                        <div className={styles['service-icon']}><i className={`fas fa-paint-brush`}></i></div>
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

                        <div className={styles['tech-section']}>
                            <div className={styles['label-icon']}>
                                <i className="fas fa-user-tag"></i>
                                <span>Choose your nail tech</span>
                            </div>
                            <div className={styles['tech-options']}>
                                {techs.map(tech => (
                                    <div 
                                        key={tech.id}
                                        className={`${styles['tech-chip']} ${selectedTech === tech.name ? styles.selected : ''}`}
                                        onClick={() => setSelectedTech(tech.name)}
                                    >
                                        <i className={`fas ${tech.icon}`}></i>
                                        <span>{tech.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles['date-section']}>
                            <div className={styles['label-icon']}>
                                <i className="fas fa-calendar-heart"></i>
                                <span>Pick your date</span>
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
                            {loadingSlots ? <p style={{color: '#b06888'}}>Loading slots...</p> : (
                                <div className={styles['time-slots']}>
                                    {availability.map(slot => (
                                        <div 
                                            key={slot.time}
                                            className={`${styles['time-slot']} ${selectedTime === slot.time ? styles.selected : ''}`}
                                            onClick={() => setSelectedTime(slot.time)}
                                        >
                                            {slot.time}
                                        </div>
                                    ))}
                                    {availability.length === 0 && <p style={{color: '#b06888'}}>No slots available.</p>}
                                </div>
                            )}
                        </div>
                        <div style={{marginTop: '16px', fontSize: '0.82rem', color: '#b06888'}}>
                            <i className="fas fa-paint-brush" style={{marginRight: '6px'}}></i> gel · acrylic · dip powder · nail art available
                        </div>
                    </div>

                    <div className={styles['booking-form-panel']}>
                        <div className={styles['section-title']} style={{marginBottom: '1.2rem'}}>
                            <i className="fas fa-user-heart"></i>
                            <h2>Your details</h2>
                        </div>

                        <form onSubmit={handleBooking}>
                            <div className={styles['form-group']}>
                                <label><i className="fas fa-user"></i> Full name</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-user-pen"></i>
                                    <input type="text" required placeholder="Jasmine Williams" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-envelope"></i> Email</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-paper-plane"></i>
                                    <input type="email" required placeholder="jasmine@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-phone"></i> Phone</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-mobile"></i>
                                    <input type="tel" required placeholder="(310) 555-0123" value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-palette"></i> Polish / color preference</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-eye-dropper"></i>
                                    <input type="text" placeholder="e.g., nude, red, French, ombre..." value={colorPref} onChange={e => setColorPref(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-pencil"></i> Nail shape / length notes</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-hand-pointer"></i>
                                    <textarea placeholder="e.g., almond, medium length, coffin..." value={nailNotes} onChange={e => setNailNotes(e.target.value)}></textarea>
                                </div>
                            </div>

                            {tenant.manual_payment_enabled && tenant.default_payment_mode === 'manual' && (
                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-file-invoice-dollar"></i> Deposit receipt</label>
                                    <div style={{color: '#b06888', fontSize: '0.8rem', marginBottom: '8px'}}>
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
                                    <span><i className="fas fa-sparkles"></i> Service</span>
                                    <span>{selectedService ? selectedService.name : '—'}</span>
                                </div>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-user-check"></i> Nail Tech</span>
                                    <span>{selectedTech}</span>
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
                                <i className="fas fa-calendar-check"></i> Book your set
                            </button>
                            <div className={styles['footer-note']}>
                                <span><i className="fas fa-shield"></i> Secure booking</span>
                                <span><i className="fas fa-undo-alt"></i> Free cancel 24h before</span>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
