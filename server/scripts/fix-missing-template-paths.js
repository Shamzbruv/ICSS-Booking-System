/**
 * fix-missing-template-paths.js
 *
 * One-shot script: corrects theme rows whose template_path is NULL or empty.
 * The ON CONFLICT (name) DO NOTHING in update-themes.js means rows that were
 * inserted early (with no path) never got updated. This script patches them.
 *
 * Run once: node server/scripts/fix-missing-template-paths.js
 */
require('dotenv').config();
const { getPool } = require('../db/connection');

const THEME_PATHS = [
  { name: 'Gather & Grace',     template_path: '/Template/Events.html'             },
  { name: 'Lumina Lens',        template_path: '/Template/photography.html'         },
  { name: 'Blush & Braids',     template_path: '/Template/Hairdresser.html'         },
  { name: 'Serenity Health',    template_path: '/Template/Health.html'              },
  { name: 'Botanica Spa',       template_path: '/Template/Spa.html'                 },
  { name: 'Pulse Studio',       template_path: '/Template/Fitness.html'             },
  { name: 'Meridian Law',       template_path: '/Template/Law.html'                 },
  { name: 'Iron & Blade',       template_path: '/Template/barber.html'              },
  { name: 'Elegant Nails',      template_path: '/Template/nail_tech.html'           },
  { name: 'Pro Auto Care',      template_path: '/Template/mechanic.html'            },
  { name: 'Universal Services', template_path: '/Template/universal_booking.html'   },
];

async function fixPaths() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    console.log('Fixing theme template_path values...\n');

    for (const { name, template_path } of THEME_PATHS) {
      const res = await client.query(
        `UPDATE themes
            SET template_path = $1
          WHERE name = $2
            AND (template_path IS NULL OR template_path = '')
          RETURNING id, name, template_path`,
        [template_path, name]
      );

      if (res.rows.length > 0) {
        console.log(`  ✅ Fixed: "${name}"  →  ${template_path}`);
      } else {
        // Check if the row exists at all
        const check = await client.query(`SELECT template_path FROM themes WHERE name = $1`, [name]);
        if (check.rows.length === 0) {
          console.log(`  ⚠️  Not found in DB: "${name}" — run update-themes.js first`);
        } else {
          console.log(`  ✓  Already set: "${name}"  →  ${check.rows[0].template_path}`);
        }
      }
    }

    console.log('\nDone.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixPaths();
