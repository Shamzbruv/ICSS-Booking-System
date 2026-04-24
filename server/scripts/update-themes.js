require('dotenv').config();
const { getPool } = require('../db/connection');

async function updateThemes() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    console.log('Starting theme registry update...');
    await client.query('BEGIN');

    console.log('Cleaning up old duplicate themes...');
    await client.query(`
      DELETE FROM pending_signups WHERE theme_id IN (
        SELECT id FROM themes WHERE name IN (
          'Classic Cuts',
          'Wellness Clinic',
          'Iron Fitness',
          'Legal Access',
          'Universal Standard',
          'Zen Spa'
        )
      );

      DELETE FROM themes WHERE name IN (
        'Classic Cuts',
        'Wellness Clinic',
        'Iron Fitness',
        'Legal Access',
        'Universal Standard',
        'Zen Spa'
      );
    `);

    // Update Barber theme from 'Classic Cuts' to 'Iron & Blade' and set its template
    console.log('Updating Barber theme...');
    await client.query(`
      UPDATE themes 
      SET 
        name = 'Iron & Blade',
        template_path = '/Template/barber.html',
        business_config = '{"services": [{"name": "Signature Haircut", "duration_minutes": 45, "price": 4000}, {"name": "Fade & Blend", "duration_minutes": 50, "price": 4500}, {"name": "Beard Trim & Shape", "duration_minutes": 30, "price": 2500}, {"name": "The Full Treatment", "duration_minutes": 75, "price": 6000}, {"name": "Hot Towel Shave", "duration_minutes": 40, "price": 3500}]}'::jsonb
      WHERE name = 'Classic Cuts' OR name = 'Iron & Blade';
    `);

    // Update Mechanic theme to use the distinct mechanic.html template and update defaults
    console.log('Updating Mechanic theme...');
    await client.query(`
      UPDATE themes 
      SET 
        template_path = '/Template/mechanic.html',
        business_config = '{"services": [{"name": "Oil Change & Inspection", "duration_minutes": 45, "price": 12000}, {"name": "Brake Pad Replacement", "duration_minutes": 120, "price": 25000}, {"name": "Full Diagnostics", "duration_minutes": 90, "price": 15000}]}'::jsonb
      WHERE name = 'Pro Auto Care';
    `);

    // Re-run the main seed insert so that 'Iron & Blade' is created if it didn't exist at all
    console.log('Ensuring all themes exist...');
    await client.query(`
      INSERT INTO themes (name, category, template_path, business_config) VALUES
      ('Blush & Braids', 'Hair & Beauty', '/Template/Hairdresser.html', '{"services": [{"name": "Blowout & Style", "duration_minutes": 45, "price": 55}, {"name": "Balayage / Highlights", "duration_minutes": 150, "price": 180}]}'::jsonb),
      ('Serenity Health', 'Medical', '/Template/Health.html', '{"services": [{"name": "Annual Wellness Exam", "duration_minutes": 45, "price": 40}, {"name": "Telehealth Visit", "duration_minutes": 20, "price": 30}]}'::jsonb),
      ('Lumina Lens', 'Photography', '/Template/photography.html', '{"services": [{"name": "Portrait Session", "duration_minutes": 60, "price": 350}, {"name": "Couple / Engagement", "duration_minutes": 90, "price": 550}]}'::jsonb),
      ('Gather & Grace', 'Events', '/Template/Events.html', '{"services": [{"name": "Wedding Package", "duration_minutes": 0, "price": 3500}, {"name": "Corporate Event", "duration_minutes": 0, "price": 2200}]}'::jsonb),
      ('Botanica Spa', 'Spa/Wellness', '/Template/Spa.html', '{"services": [{"name": "Signature Botanical Facial", "duration_minutes": 75, "price": 135}, {"name": "Aromatherapy Massage", "duration_minutes": 90, "price": 165}]}'::jsonb),
      ('Pulse Studio', 'Fitness', '/Template/Fitness.html', '{"services": [{"name": "HIIT FUSION", "duration_minutes": 45, "price": 0}, {"name": "POWER VINYASA", "duration_minutes": 60, "price": 0}]}'::jsonb),
      ('Meridian Law', 'Legal', '/Template/Law.html', '{"services": [{"name": "Initial Consultation", "duration_minutes": 30, "price": 150}, {"name": "Extended Consultation", "duration_minutes": 60, "price": 275}]}'::jsonb),
      ('Iron & Blade', 'Barber', '/Template/barber.html', '{"services": [{"name": "Signature Haircut", "duration_minutes": 45, "price": 40}, {"name": "Fade & Blend", "duration_minutes": 50, "price": 45}, {"name": "Beard Trim & Shape", "duration_minutes": 30, "price": 25}, {"name": "The Full Treatment", "duration_minutes": 75, "price": 60}, {"name": "Hot Towel Shave", "duration_minutes": 40, "price": 35}]}'::jsonb),
      ('Elegant Nails', 'Nail Tech', '/Template/nail_tech.html', '{"services": [{"name": "Acrylic Full Set", "duration_minutes": 90, "price": 80}]}'::jsonb),
      ('Pro Auto Care', 'Mechanic', '/Template/mechanic.html', '{"services": [{"name": "Oil Change & Inspection", "duration_minutes": 45, "price": 120}, {"name": "Brake Pad Replacement", "duration_minutes": 120, "price": 250}, {"name": "Full Diagnostics", "duration_minutes": 90, "price": 150}]}'::jsonb),
      ('Universal Services', 'General / Universal', '/Template/universal_booking.html', '{"services": [{"name": "Consultation", "duration_minutes": 30, "price": 50}, {"name": "Professional Service", "duration_minutes": 60, "price": 120}]}'::jsonb)
      ON CONFLICT (name) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('Theme registry successfully updated.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating theme registry:', error);
  } finally {
    client.release();
    pool.end();
  }
}

updateThemes();
