const { query } = require('./server/db/connection');

async function check() {
  try {
    const signup = await query("SELECT * FROM pending_signups ORDER BY created_at DESC LIMIT 1");
    console.log("Latest signup:", signup.rows[0]);
    if(signup.rows.length === 0) return;

    const signup_token = signup.rows[0].signup_token;
    console.log("Token:", signup_token);

    await query(
      `UPDATE pending_signups SET status = 'pending'
       WHERE signup_token = $1`,
      [signup_token]
    );
    console.log("Update succeeded");

    const { enqueueProvisioningJob } = require('./server/services/provisioning');
    await enqueueProvisioningJob(signup.rows[0].tenant_slug, signup_token, 'TRIAL_BYPASS', {});
    console.log("Enqueue succeeded");

  } catch (e) {
    console.error("ERROR CAUGHT:", e);
  } finally {
    process.exit(0);
  }
}
check();
