/**
 * fix-theme-paths-force.js
 *
 * Force-updates the template_path for Gather & Grace and Lumina Lens which
 * still point to old deepseek_html_* filenames from a previous build.
 * The actual files are Events.html and photography.html.
 *
 * Run: node server/scripts/fix-theme-paths-force.js
 */
require('dotenv').config();
const { getPool } = require('../db/connection');

const FIXES = [
  { name: 'Gather & Grace', template_path: '/Template/Events.html'       },
  { name: 'Lumina Lens',    template_path: '/Template/photography.html'   },
];

async function run() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    for (const { name, template_path } of FIXES) {
      const res = await client.query(
        `UPDATE themes SET template_path = $1 WHERE name = $2 RETURNING id, name, template_path`,
        [template_path, name]
      );
      if (res.rows.length > 0) {
        console.log(`✅ Updated "${name}" → ${template_path}`);
      } else {
        console.log(`⚠️  Theme not found: "${name}"`);
      }
    }
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
