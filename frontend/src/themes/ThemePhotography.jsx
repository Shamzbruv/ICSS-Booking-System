import React, { useState, useEffect } from 'react';
import styles from './ThemePhotography.module.css';
import { api } from '../api';

export default function ThemePhotography({ tenant, services, onBook }) {
    const [selectedService, setSelectedService] = useState(services[0] || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [availability, setAvailability] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [vibe, setVibe] = useState('Editorial / fashion');
    const [specialRequests, setSpecialRequests] = useState('');
    const [receiptImage, setReceiptImage] = useState(null);

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
        if (!selectedTime) return alert('Please select a time slot.');
        
        let receiptBase64 = null;
        if (receiptImage) {
            const reader = new FileReader();
            reader.readAsDataURL(receiptImage);
            receiptBase64 = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result);
            });
        }

        const combinedNotes = `Vibe: ${vibe}\nRequests: ${specialRequests || 'None'}`;

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
                alert('📷 SESSION RESERVED 📷\nA contract & invoice will follow within 24h. Thank you — let\'s create magic! ✨');
                window.location.reload();
            }
        } catch (err) {
            alert(err.message || 'Failed to reserve session.');
        }
    };

    return (
        <div className={styles.ThemePhotographyWrapper}>
            <div className={`${styles['photo-system']} ${styles.grain}`}>
                <div className={styles.header}>
                    <div className={styles.brand}>
                        <div className={styles['brand-icon']}>
                            <i className="fas fa-camera-retro"></i>
                        </div>
                        <div className={styles['brand-text']}>
                            <h1>{tenant.name}</h1>
                            <p><i className="fas fa-aperture"></i> {tenant.branding?.bookingTagline || 'fine art photography'}  <i className="fas fa-circle" style={{fontSize: '6px', margin: '0 8px'}}></i> {tenant.branding?.location || 'PORTLAND · SEATTLE'}</p>
                        </div>
                    </div>
                    <div className={styles['header-actions']}>
                        <div className={styles.tag}><i className="fas fa-star"></i> 200+ weddings</div>
                        <div className={styles.tag}><i className="fas fa-camera"></i> editorial & lifestyle</div>
                    </div>
                </div>

                <div className={styles['booking-grid']}>
                    <div className={styles['selection-panel']}>
                        <div className={styles['section-title']}>
                            <i className="fas fa-images"></i>
                            <h2>select your session</h2>
                        </div>

                        <div className={styles['session-list']}>
                            {services.map(svc => (
                                <div 
                                    key={svc.id} 
                                    className={`${styles['session-card']} ${selectedService?.id === svc.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedService(svc)}
                                >
                                    <div className={styles['session-info']}>
                                        <div className={styles['session-icon']}><i className={`fas fa-camera`}></i></div>
                                        <div className={styles['session-details']}>
                                            <h3>{svc.name}</h3>
                                            <span><i className="far fa-clock"></i> {svc.duration_minutes} min duration</span>
                                        </div>
                                    </div>
                                    <div className={styles['session-price']}>
                                        {svc.price === 0 ? 'Custom' : `$${svc.price}`}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles['date-section']}>
                            <div className={styles['label-icon']}>
                                <i className="fas fa-calendar-image"></i>
                                <span>session date</span>
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
                                <i className="fas fa-sun"></i>
                                <span>available times</span>
                            </div>
                            {loadingSlots ? <p style={{color: '#7f6e5d'}}>Loading slots...</p> : (
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
                                    {availability.length === 0 && <p style={{color: '#7f6e5d'}}>No slots available.</p>}
                                </div>
                            )}
                        </div>
                        <div style={{marginTop: '18px', fontSize: '0.85rem', color: '#6f5f50'}}>
                            <i className="fas fa-location-dot" style={{marginRight: '8px'}}></i> location details after booking · travel included up to 30mi
                        </div>
                    </div>

                    <div className={styles['booking-form-panel']}>
                        <div className={styles['section-title']} style={{marginBottom: '1.2rem'}}>
                            <i className="fas fa-user-pen"></i>
                            <h2>client details</h2>
                        </div>

                        <form onSubmit={handleBooking}>
                            <div className={styles['form-group']}>
                                <label><i className="fas fa-user"></i> full name</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-signature"></i>
                                    <input type="text" required placeholder="e.g., Emma & James" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-envelope"></i> email</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-paper-plane"></i>
                                    <input type="email" required placeholder="hello@client.com" value={email} onChange={e => setEmail(e.target.value)} />
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
                                <label><i className="fas fa-palette"></i> session vibe</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-leaf"></i>
                                    <select value={vibe} onChange={e => setVibe(e.target.value)}>
                                        <option value="Natural light / candid">🌿 Natural light / candid</option>
                                        <option value="Editorial / fashion">📸 Editorial / fashion</option>
                                        <option value="Lifestyle / cozy">☕ Lifestyle / cozy</option>
                                        <option value="Fine art / film">🎞️ Fine art / film</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-message"></i> special requests</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-feather"></i>
                                    <textarea placeholder="Pinterest board link, must-have shots..." value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}></textarea>
                                </div>
                            </div>

                            {tenant.manual_payment_enabled && tenant.default_payment_mode === 'manual' && (
                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-file-invoice-dollar"></i> retainer receipt</label>
                                    <div style={{color: '#75675a', fontSize: '0.85rem', marginBottom: '8px'}}>
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
                                    <span><i className="fas fa-camera"></i> Session</span>
                                    <span>{selectedService ? selectedService.name : '—'}</span>
                                </div>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-clock"></i> Date & time</span>
                                    <span>{selectedDate} at {selectedTime || '—'}</span>
                                </div>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-paintbrush"></i> Vibe</span>
                                    <span>{vibe}</span>
                                </div>
                                <div className={`${styles['summary-line']} ${styles.total}`}>
                                    <span>session investment</span>
                                    <span>${selectedService ? selectedService.price : '0'}</span>
                                </div>
                            </div>

                            <button type="submit" className={styles['book-btn']}>
                                <i className="fas fa-camera"></i> reserve your date
                            </button>
                            <div className={styles['footer-note']}>
                                <span><i className="fas fa-lock"></i> 30% retainer</span>
                                <span><i className="fas fa-cloud-sun"></i> reschedule weather</span>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
