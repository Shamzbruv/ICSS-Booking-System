import React, { useState, useEffect } from 'react';
import styles from './ThemeHealth.module.css';
import { api } from '../api';

export default function ThemeHealth({ tenant, services, onBook }) {
    const [selectedService, setSelectedService] = useState(services[0] || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedPractitioner, setSelectedPractitioner] = useState('NP Rivera');
    const [availability, setAvailability] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [visitNotes, setVisitNotes] = useState('');
    const [receiptImage, setReceiptImage] = useState(null);

    const practitioners = [
      { id: 'Dr. Patel', name: '👩‍⚕️ Dr. Anika Patel (internal medicine)' },
      { id: 'Dr. Chen', name: '👨‍⚕️ Dr. David Chen (wellness & longevity)' },
      { id: 'NP Rivera', name: '💚 NP Elena Rivera (family health)' },
      { id: 'first', name: '⭐ First available' }
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

        const combinedNotes = `Practitioner: ${selectedPractitioner}\nNotes: ${visitNotes}`;

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
                alert('🩺 APPOINTMENT CONFIRMED 🩺\nYou\'ll receive a confirmation email with intake forms. Thank you for choosing Serenity Health.');
                window.location.reload();
            }
        } catch (err) {
            alert(err.message || 'Failed to book appointment.');
        }
    };

    return (
        <div className={styles.ThemeHealthWrapper}>
            <div className={`${styles['wellness-system']} ${styles['calm-pattern']}`}>
                <div className={styles.header}>
                    <div className={styles.brand}>
                        <div className={styles['brand-icon']}>
                            <i className="fas fa-heart-pulse"></i>
                        </div>
                        <div className={styles['brand-text']}>
                            <h1>{tenant.name}</h1>
                            <p><i className="fas fa-location-dot"></i> {tenant.branding?.location || 'Wellness Clinic'}  ·  <i className="fas fa-star" style={{margin: '0 6px'}}></i> 4.9 (380+ reviews)</p>
                        </div>
                    </div>
                    <div className={styles['header-actions']}>
                        <div className={styles['badge-med']}><i className="fas fa-user-doctor"></i> Dr. Patel · Dr. Chen · NP Rivera</div>
                        <div className={styles['badge-med']}><i className="fas fa-shield-heart"></i> HIPAA secure</div>
                    </div>
                </div>

                <div className={styles['booking-grid']}>
                    <div className={styles['selection-panel']}>
                        <div className={styles['section-title']}>
                            <i className="fas fa-notes-medical"></i>
                            <h2>visit reason</h2>
                        </div>

                        <div className={styles['visit-list']}>
                            {services.map(svc => (
                                <div 
                                    key={svc.id} 
                                    className={`${styles['visit-card']} ${selectedService?.id === svc.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedService(svc)}
                                >
                                    <div className={styles['visit-info']}>
                                        <div className={styles['visit-icon']}><i className={`fas fa-stethoscope`}></i></div>
                                        <div className={styles['visit-details']}>
                                            <h3>{svc.name}</h3>
                                            <span><i className="far fa-clock"></i> {svc.duration_minutes} min duration</span>
                                        </div>
                                    </div>
                                    <div className={styles['visit-duration']}>
                                        {svc.price === 0 ? 'Cost varies' : `$${svc.price}`}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles['date-section']}>
                            <div className={styles['label-icon']}>
                                <i className="fas fa-calendar-check"></i>
                                <span>preferred date</span>
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
                            {loadingSlots ? <p style={{color: '#3d7787'}}>Loading slots...</p> : (
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
                                    {availability.length === 0 && <p style={{color: '#3d7787'}}>No slots available.</p>}
                                </div>
                            )}
                        </div>
                        <div style={{marginTop: '16px', fontSize: '0.85rem', color: '#2f6f7e'}}>
                            <i className="fas fa-circle-check" style={{marginRight: '8px'}}></i> most insurance accepted · self-pay options
                        </div>
                    </div>

                    <div className={styles['booking-form-panel']}>
                        <div className={styles['section-title']} style={{marginBottom: '1.2rem'}}>
                            <i className="fas fa-id-card"></i>
                            <h2>patient details</h2>
                        </div>

                        <form onSubmit={handleBooking}>
                            <div className={styles['form-group']}>
                                <label><i className="fas fa-user"></i> full name</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-user-pen"></i>
                                    <input type="text" required placeholder="e.g., James Wilson" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-envelope"></i> email</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-at"></i>
                                    <input type="email" required placeholder="sarah.chen@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-phone"></i> mobile</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-mobile-screen"></i>
                                    <input type="tel" required placeholder="(555) 123-4567" value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-user-md"></i> preferred practitioner</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-stethoscope"></i>
                                    <select value={selectedPractitioner} onChange={e => setSelectedPractitioner(e.target.value)}>
                                        {practitioners.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label><i className="fas fa-pencil"></i> notes / concerns (optional)</label>
                                <div className={styles['input-wrapper']}>
                                    <i className="fas fa-message"></i>
                                    <textarea placeholder="e.g., annual physical, fatigue, follow-up..." value={visitNotes} onChange={e => setVisitNotes(e.target.value)}></textarea>
                                </div>
                            </div>

                            {tenant.manual_payment_enabled && tenant.default_payment_mode === 'manual' && (
                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-file-invoice-dollar"></i> copy of ID / insurance</label>
                                    <div style={{color: '#3d7787', fontSize: '0.85rem', marginBottom: '8px'}}>
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
                                    <span><i className="fas fa-file-medical"></i> Visit type</span>
                                    <span>{selectedService ? selectedService.name : '—'}</span>
                                </div>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-calendar"></i> Date & time</span>
                                    <span>{selectedDate} at {selectedTime || '—'}</span>
                                </div>
                                <div className={styles['summary-line']}>
                                    <span><i className="fas fa-user-doctor"></i> Practitioner</span>
                                    <span>{selectedPractitioner}</span>
                                </div>
                                <div className={`${styles['summary-line']} ${styles.total}`}>
                                    <span>estimated cost</span>
                                    <span>{selectedService ? (selectedService.price === 0 ? 'varies by insurance' : `$${selectedService.price}`) : 'varies'}</span>
                                </div>
                            </div>

                            <button type="submit" className={styles['book-btn']}>
                                <i className="fas fa-calendar-plus"></i> confirm appointment
                            </button>
                            <div className={styles['footer-note']}>
                                <span><i className="fas fa-shield"></i> encrypted · no walk-ins</span>
                                <span><i className="fas fa-clock-rotate-left"></i> 24h cancellation</span>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
