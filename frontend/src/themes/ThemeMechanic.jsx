import React, { useState, useEffect } from 'react';
import styles from './ThemeMechanic.module.css';
import { api } from '../api';

export default function ThemeMechanic({ tenant, services, onBook }) {
    const [selectedService, setSelectedService] = useState(services[0] || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState('First Available');
    const [availability, setAvailability] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [receiptImage, setReceiptImage] = useState(null);

    const staffMembers = [
      { id: 'any', name: 'First Available', icon: 'fa-users' },
      { id: 'staff1', name: 'Mike (Master Tech)', icon: 'fa-user-cog' },
      { id: 'staff2', name: 'Dave (Brakes/Suspension)', icon: 'fa-user-cog' },
      { id: 'staff3', name: 'Sarah (Diagnostics)', icon: 'fa-user-cog' }
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
        if (!selectedTime) return alert('Please select a drop-off time.');
        
        let receiptBase64 = null;
        if (receiptImage) {
            const reader = new FileReader();
            reader.readAsDataURL(receiptImage);
            receiptBase64 = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result);
            });
        }

        const combinedNotes = `Technician: ${selectedStaff}\nVehicle Info/Symptoms: ${notes}`;

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
                alert('Appointment requested. Our team will reach out shortly to confirm.');
                window.location.reload();
            }
        } catch (err) {
            alert(err.message || 'Failed to book appointment.');
        }
    };

    return (
        <div className={styles.ThemeMechanicWrapper}>
            <div className={styles.ThemeMechanicBody}>
                <div className={styles['booking-system']}>
                    <div className={styles.header}>
                        <div className={styles.brand}>
                            <div className={styles['brand-icon']}>
                                <i className="fas fa-wrench"></i>
                            </div>
                            <div className={styles['brand-text']}>
                                <h1>{tenant.name}</h1>
                                <p><i className="fas fa-map-marker-alt"></i> {tenant.branding?.location || 'Service Center'}</p>
                            </div>
                        </div>
                        <div className={styles['header-actions']}>
                            <div className={styles.badge}><i className="fas fa-clock"></i> Mon–Fri 8am–6pm</div>
                            <div className={styles.badge}><i className="fas fa-check-circle"></i> ASE Certified</div>
                        </div>
                    </div>

                    <div className={styles['booking-grid']}>
                        <div className={styles['selection-panel']}>
                            <div className={styles['section-title']}>
                                <i className="fas fa-clipboard-list"></i>
                                <h2>Select Service</h2>
                            </div>

                            <div className={styles['service-list']}>
                                {services.map(svc => (
                                    <div 
                                        key={svc.id} 
                                        className={`${styles['service-card']} ${selectedService?.id === svc.id ? styles.selected : ''}`}
                                        onClick={() => setSelectedService(svc)}
                                    >
                                        <div className={styles['service-info']}>
                                            <div className={styles['service-icon']}><i className={`fas fa-car`}></i></div>
                                            <div className={styles['service-details']}>
                                                <h3>{svc.name}</h3>
                                                <span><i className="far fa-clock"></i> {svc.duration_minutes} min</span>
                                            </div>
                                        </div>
                                        <div className={styles['service-price']}>${svc.price}</div>
                                    </div>
                                ))}
                            </div>

                            <div className={styles['staff-section']}>
                                <div className={styles['label-icon']}>
                                    <i className="fas fa-user-cog"></i>
                                    <span>Preferred Technician</span>
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
                                    <i className="fas fa-calendar-day"></i>
                                    <span>Choose Date</span>
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
                                    <span>Select Drop-off Time</span>
                                </div>
                                {loadingSlots ? <p style={{color: '#475569'}}>Loading slots...</p> : (
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
                                        {availability.length === 0 && <p style={{color: '#475569'}}>No slots available.</p>}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles['booking-form-panel']}>
                            <div className={styles['section-title']} style={{marginBottom: '1.2rem'}}>
                                <i className="fas fa-id-card"></i>
                                <h2>Customer Details</h2>
                            </div>

                            <form onSubmit={handleBooking}>
                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-user"></i> Full Name</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-user"></i>
                                        <input type="text" required placeholder="John Smith" value={name} onChange={e => setName(e.target.value)} />
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-envelope"></i> Email Address</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-envelope"></i>
                                        <input type="email" required placeholder="john@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-phone"></i> Phone Number</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-phone"></i>
                                        <input type="tel" required placeholder="(555) 123-4567" value={phone} onChange={e => setPhone(e.target.value)} />
                                    </div>
                                </div>

                                <div className={styles['form-group']}>
                                    <label><i className="fas fa-car"></i> Vehicle Info & Symptoms</label>
                                    <div className={styles['input-wrapper']}>
                                        <i className="fas fa-info-circle"></i>
                                        <textarea required placeholder="Make, model, year, and description of the issue..." value={notes} onChange={e => setNotes(e.target.value)}></textarea>
                                    </div>
                                </div>

                                {tenant.manual_payment_enabled && tenant.default_payment_mode === 'manual' && (
                                    <div className={styles['form-group']}>
                                        <label><i className="fas fa-file-invoice-dollar"></i> Deposit Receipt</label>
                                        <div style={{color: '#64748b', fontSize: '0.85rem', marginBottom: '8px'}}>
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
                                        <span><i className="fas fa-tools"></i> Service</span>
                                        <span>{selectedService ? selectedService.name : '—'}</span>
                                    </div>
                                    <div className={styles['summary-line']}>
                                        <span><i className="fas fa-user-cog"></i> Technician</span>
                                        <span>{selectedStaff}</span>
                                    </div>
                                    <div className={styles['summary-line']}>
                                        <span><i className="fas fa-calendar-alt"></i> Drop-off</span>
                                        <span>{selectedDate} at {selectedTime || '—'}</span>
                                    </div>
                                    <div className={`${styles['summary-line']} ${styles.total}`}>
                                        <span>Est. Total</span>
                                        <span>${selectedService ? selectedService.price : '0'}</span>
                                    </div>
                                </div>

                                <button type="submit" className={styles['book-btn']}>
                                    <i className="fas fa-calendar-check"></i> Request Appointment
                                </button>
                                <div className={styles['footer-note']}>
                                    <span><i className="fas fa-shield-alt"></i> 12-Month Guarantee</span>
                                    <span><i className="fas fa-times-circle"></i> Free cancellation</span>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
