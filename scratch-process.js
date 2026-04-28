require('dotenv').config();
const { processProvisioningJob } = require('./server/services/provisioning');

async function test() {
    try {
        // ID of the stuck job from the DB
        console.log("Processing job 80fc1d22-abb5-4649-a7b7-4b8ee14c0c4e");
        await processProvisioningJob('80fc1d22-abb5-4649-a7b7-4b8ee14c0c4e');
        console.log("Done");
    } catch (e) {
        console.error("CAUGHT EXCEPTION:", e);
    } finally {
        process.exit(0);
    }
}
test();
