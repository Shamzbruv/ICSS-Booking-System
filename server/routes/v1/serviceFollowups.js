const express = require('express');
const { query } = require('../../db/connection');
const { subscriptionPage } = require('../../services/newsletter');

const router = express.Router();
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

router.use((_req,res,next) => {
    res.set({ 'Cache-Control':'private, no-store', 'X-Robots-Tag':'noindex, nofollow', 'Referrer-Policy':'no-referrer' });
    next();
});

router.get('/unsubscribe/:token', (req,res) => {
    const { token } = req.params;
    if (!UUID.test(token)) return res.sendStatus(404);
    return res.type('html').send(subscriptionPage({
        title:'Stop service reminders',
        message:'Stop getting return-visit recommendations for this service. You’ll still get confirmations for appointments you book.',
        action:`/api/v1/service-followups/unsubscribe/${token}`, label:'Stop reminders'
    }));
});

router.post('/unsubscribe/:token', async (req,res) => {
    if (!UUID.test(req.params.token)) return res.sendStatus(404);
    await query(`UPDATE service_followups SET status='unsubscribed',message=NULL WHERE token=$1`, [req.params.token]);
    if (req.body?.['List-Unsubscribe'] === 'One-Click') return res.sendStatus(200);
    return res.type('html').send(subscriptionPage({ title:'Reminders stopped', message:'You’ve opted out of reminders for this service.' }));
});

module.exports = router;
