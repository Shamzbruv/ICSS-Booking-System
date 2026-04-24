require('dotenv').config();
const { getPool } = require('../db/connection');

async function updateThemes() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    console.log('Starting theme registry update...');
    await client.query('BEGIN');

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
      ('Lumina Lens', 'Photography', '/Template/deepseek_html_20260421_3e8960.html', '{"services": [{"name": "1-Hour Portrait Session", "duration_minutes": 60, "price": 15000}]}'::jsonb),
      ('Elegant Nails', 'Nail Tech', '/Template/deepseek_html_20260421_6c135e.html', '{"services": [{"name": "Acrylic Full Set", "duration_minutes": 90, "price": 8000}]}'::jsonb),
      ('Iron & Blade', 'Barber', '/Template/barber.html', '{"services": [{"name": "Signature Haircut", "duration_minutes": 45, "price": 4000}, {"name": "Fade & Blend", "duration_minutes": 50, "price": 4500}, {"name": "Beard Trim & Shape", "duration_minutes": 30, "price": 2500}, {"name": "The Full Treatment", "duration_minutes": 75, "price": 6000}, {"name": "Hot Towel Shave", "duration_minutes": 40, "price": 3500}]}'::jsonb),
      ('Pro Auto Care', 'Mechanic', '/Template/mechanic.html', '{"services": [{"name": "Oil Change & Inspection", "duration_minutes": 45, "price": 12000}, {"name": "Brake Pad Replacement", "duration_minutes": 120, "price": 25000}, {"name": "Full Diagnostics", "duration_minutes": 90, "price": 15000}]}'::jsonb),
      ('Gather & Grace', 'Events', '/Template/deepseek_html_20260421_e879f5.html', '{"services": [{"name": "Event Venue Tour", "duration_minutes": 30, "price": 0}]}'::jsonb),
      ('Zen Spa', 'Spa/Wellness', '/Template/deepseek_html_20260421_6775b1.html', '{"services": [{"name": "Swedish Massage (60 Min)", "duration_minutes": 60, "price": 10000}]}'::jsonb),
      ('Legal Access', 'Legal', '/Template/deepseek_html_20260421_7b8f29.html', '{"services": [{"name": "Initial Consultation", "duration_minutes": 30, "price": 5000}]}'::jsonb),
      ('Iron Fitness', 'Fitness', '/Template/deepseek_html_20260421_77f091.html', '{"services": [{"name": "Personal Training Session", "duration_minutes": 60, "price": 6000}]}'::jsonb),
      ('Wellness Clinic', 'Medical', '/Template/deepseek_html_20260421_e9afd1.html', '{"services": [{"name": "General Checkup", "duration_minutes": 30, "price": 7500}]}'::jsonb),
      ('Universal Standard', 'General / Universal', '/Template/universal_booking.html', '{"services": [{"name": "Standard Service", "duration_minutes": 60, "price": 5000}]}'::jsonb)
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
