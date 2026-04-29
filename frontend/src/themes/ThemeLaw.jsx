import React, { useState, useEffect } from 'react';
import styles from './ThemeLaw.module.css';
import { api } from '../api';

export default function ThemeLaw({ tenant, services, onBook }) {
    const [selectedService, setSelectedService] = useState(services[0] || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedAttorney, setSelectedAttorney] = useState('First Available');
    const [availability, setAvailability] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    
    // Form state
    const [name, setName] = useState('');
    const [company, setCompany] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [matterType, setMatterType] = useState('Family Law');
    const [description, setDescription] = useState('');
    const [receiptImage, setReceiptImage] = useState(null);

    const attorneys = [
      { id: 'any', name: 'First Available', icon: 'fa-user-group' },
      { id: 'meridian', name: 'Sarah Meridian (Managing Partner)', icon: 'fa-scale-balanced' },
      { id: 'chen', name: 'David Chen (Corporate)', icon: 'fa-building' },
      { id: 'williams', name: 'Michelle Williams (Family Law)', icon: 'fa-heart' },
      { id: 'patel', name: 'Raj Patel (Estate Planning)', icon: 'fa-tree' },
      { id: 'okonkwo', name: 'Chioma Okonkwo (Litigation)', icon: 'fa-gavel' }
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

        const combinedNotes = `Attorney: ${selectedAttorney}\nCompany: ${company || 'N/A'}\nMatter: ${matterType}\nDescription: ${description}`;

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
                alert('⚖️ CONSULTATION CONFIRMED ⚖️\nA confirmation and intake form will be emailed. All communications are confidential.');
                window.location.reload();
            }
        } catch (err) {
            alert(err.message || 'Failed to book consultation.');
        }
    };

    return (
        <div className={styles.ThemeLawWrapper}>
            <div className={styles['legal-system']}>
                <div className={styles.header}>
                    <div className={styles.brand}>
                        <div className={styles['brand-icon']}>
                            <i className="fas fa-gavel"></i>
                        </div>
                        <div className={styles['brand-text']}>
                            <h1>{tenant.name}</h1>
                            <p><i className="fas fa-scale-balanced"></i> {tenant.branding?.bookingTagline || 'BUSINESS · FAMILY · ESTATE'}  <i className="fas fa-circle" style={{fontSize: '4px', margin: '0 10px'}}></i> {tenant.branding?.location || 'PORTLAND · SEATTLE'}</p>
                        </div>
                    </div>
                    <div className={styles['header-actions']}>
                        <div className={styles['legal-badge']}><i className="fas fa-lock"></i> confidential</div>
                        <div className={styles['legal-badge']}><i className="fas fa-star"></i> AV-Preeminent®</div>
                    </div>
                </div>

                <div className={styles['booking-grid']}>
                    <div className={styles['selection-panel']}>
                        <div className={styles['section-title']}>
                            <i className="fas fa-file-signature"></i>
                            <h2>consultation type</h2>
                        </div>

                        <div className={styles['consult-list']}>
                            {services.map(svc => (
                                <div 
                                    key={svc.id} 
                                    className={`${styles['consult-card']} ${selectedService?.id === svc.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedService(svc)}
                                >
                                    <div className={styles['consult-info']}>
                                        <div className={styles['consult-icon']}><i className={`fas fa-scale-balanced`}></i></div>
                                        <div className={styles['consult-details']}>
                                            <h3>{svc.name}</h3>
                                            <span><i className="far fa-clock"></i> {svc.duration_minutes} min duration</span>
                                        </div>
                                    </div>
                                    <div className={styles['consult-fee']}>
                                        {svc.price === 0 ? 'Free' : `$${svc.price}`}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles['attorney-section']}>
                            <div className={styles['label-icon']}>
                                <i className="fas fa-user-tie"></i>
                                <span>preferred attorney</span>
                            </div>
                            <div className={styles['attorney-options']}>
                                {attorneys.map(att => (
                                    <div 
                                        key={att.id}
                                        className={`${styles['attorney-chip']} ${selectedAttorney === att.name ? styles.selected : ''}`}
                                        onClick={() => setSelectedAttorney(att.name)}
                                    >
                                        <i className={`fas ${att.icon}`}></i>
                                        <span>{att.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles['date-section']}>
                            <div className={styles['label-icon']}>
                                <i className="fas fa-calendar-week"></i>
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
                            {loadingSlots ? <p style={{color: '#c9a96e'}}>Loading slots...</p> : (
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
                                    {availability.length === 0 && <p style={{color: '#c9a96e'}}>No slots available.</p>}
                                </div>
                            )}
                        </div>
                        <div style={{marginTop: '18px', fontSize: '0.8rem', color: '#8fa3b8'}}>
                            <i className="fas fa-video" style={{marginRight: '8px', color: '#c9a96e'}}></i> in-person · video · phone consultations available
                        </div>
                    </div>

                    <div className={styles['booking-form-panel']}>
                        <div className={styles['section-title']} style={{marginBottom: '1.2rem'}}>
                            <i className="fas fa-user-profile"></i>
                            <h2>client information</h2>
                        </div>

                        <form onSubmit={handleBooking}>
                            <div className={styles['form-group']}>
                                <label><i className="fas fa-user"></i> full name</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-pen"></i>
                                    <input type="text" required placeholder="e.g., Jonathan Wright" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-building"></i> company (if applicable)</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-briefcase"></i>
                                    <input type="text" placeholder="Company name" value={company} onChange={e => setCompany(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-envelope"></i> email</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-paper-plane"></i>
                                    <input type="email" required placeholder="rebecca@email.com" value={email} onChange={e => setEmail(e.target.value)} />
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
                                <label><i className="fas fa-gavel"></i> matter type</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-folder-open"></i>
                                    <select value={matterType} onChange={e => setMatterType(e.target.value)}>
                                        <option value="Business / Corporate">🏢 Business / Corporate</option>
                                        <option value="Family Law">👨‍👩‍👧 Family Law</option>
                                        <option value="Estate Planning">📜 Estate Planning</option>
                                        <option value="Real Estate">🏠 Real Estate</option>
                                        <option value="Civil Litigation">⚖️ Civil Litigation</option>
                                        <option value="Other">📋 Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-align-left"></i> brief description</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-message"></i>
                                    <textarea placeholder="Please briefly describe your legal matter..." value={description} onChange={e => setDescription(e.target.value)}></textarea>
                                </div>
                            </div>

                            {tenant.manual_payment_enabled && tenant.default_payment_mode === 'manual' && (
                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-file-invoice-dollar"></i> retainer / deposit receipt</label>
                                    <div style={{color: '#8fa3b8', fontSize: '0.8rem', marginBottom: '8px'}}>
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
                                    <span><i className="fas fa-scale-balanced"></i> Consultation</span>
                                    <span>{selectedService ? selectedService.name : '—'}</span>
                                </div>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-user-tie"></i> Attorney</span>
                                    <span>{selectedAttorney}</span>
                                </div>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-calendar"></i> Date & time</span>
                                    <span>{selectedDate} at {selectedTime || '—'}</span>
                                </div>
                                <div className={`${styles['summary-line']} ${styles.total}`}>
                                    <span>consultation fee</span>
                                    <span>${selectedService ? selectedService.price : '0'}</span>
                                </div>
                            </div>

                            <button type="submit" className={styles['book-btn']}>
                                <i className="fas fa-handshake"></i> schedule consultation
                            </button>
                            <div className={styles['footer-note']}>
                                <span><i className="fas fa-shield"></i> attorney-client privilege</span>
                                <span><i className="fas fa-clock"></i> 48h cancellation</span>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
