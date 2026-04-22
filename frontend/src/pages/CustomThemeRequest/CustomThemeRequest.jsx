import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './CustomThemeRequest.module.css';

export default function CustomThemeRequest() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    businessName: '',
    email: '',
    details: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // In production, post to /api/v1/design-inquiries
    setTimeout(() => setSubmitted(true), 1000);
  };

  return (
    <div className={s.page}>
      <div className={s.card}>
        <button className={s.backBtn} onClick={() => navigate(-1)}>← Back</button>
        
        {submitted ? (
          <div className={s.success}>
            <div className={s.successIcon}>✨</div>
            <h2>Request Received!</h2>
            <p>Our design team will review your requirements and send a custom quote to {formData.email} within 24 hours.</p>
            <button className={s.btnPrimary} onClick={() => navigate('/themes')}>Return to Themes</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 className={s.title}>Request a Custom Theme</h1>
            <p className={s.subtitle}>Need something totally unique? Our expert designers can build a bespoke booking page tailored exactly to your brand.</p>
            
            <div className={s.field}>
              <label>Business Name</label>
              <input required value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} />
            </div>
            
            <div className={s.field}>
              <label>Contact Email</label>
              <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>

            <div className={s.field}>
              <label>Project Details & Requirements</label>
              <textarea required rows={5} placeholder="Tell us about your brand vibe, reference sites, or specific layout needs..." 
                        value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
            </div>

            <button type="submit" className={s.btnPrimary}>Submit Request</button>
          </form>
        )}
      </div>
    </div>
  );
}
