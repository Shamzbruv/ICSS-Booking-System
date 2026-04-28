const { query } = require('./server/db/connection');

async function check() {
  try {
    const signup = await query("SELECT * FROM pending_signups ORDER BY created_at DESC LIMIT 1");
    console.log("Signup:", signup.rows[0]);

    if (signup.rows.length > 0) {
      const jobs = await query("SELECT * FROM provisioning_jobs WHERE signup_token = $1", [signup.rows[0].signup_token]);
      console.log("Jobs:", jobs.rows);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
check();
