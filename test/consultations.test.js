const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { PGlite } = require('@electric-sql/pglite');
const { migrateConsultations } = require('../server/db/consultations');

test('consultation booking, shared host management, and private client changes', async () => {
    const db = new PGlite();
    let server;
    try {
        await db.exec(`
            CREATE TABLE users (id uuid PRIMARY KEY, tenant_id uuid, active boolean, role text, email text);
            CREATE TABLE email_outbox (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_type text NOT NULL, dedupe_key text UNIQUE NOT NULL,
                recipient text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending',
                provider_message_id text, attempts int DEFAULT 0, next_attempt_at timestamptz DEFAULT now(),
                last_error text, sent_at timestamptz, updated_at timestamptz DEFAULT now()
            );
        `);
        await migrateConsultations(db);
        await migrateConsultations(db);
        const connection = require('../server/db/connection');
        connection.query = db.query.bind(db);
        connection.transaction = db.transaction.bind(db);
        const jobs = [];
        require('../server/services/queue').enqueue = async (name, payload) => {
            jobs.push(payload);
            return 'test-job';
        };
        const sent = [];
        const resend = require.resolve('resend');
        require.cache[resend] = { id: resend, filename: resend, loaded: true, exports: { Resend: class {
            constructor() {
                this.emails = { send: async (message) => {
                    sent.push(message);
                    return { data: { id: 'test-message' } };
                }};
            }
        } } };
        process.env.RESEND_API_KEY = 'local-test-only';
        const app = express();
        const { publicRouter, staffRouter } = require('../server/routes/v1/consultations');
        app.use(express.json());
        app.use('/public', publicRouter);
        app.use('/staff', staffRouter);
        server = await new Promise(resolve => {
            const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
        });
        const origin = `http://127.0.0.1:${server.address().port}`;
        const { signToken } = require('../server/middleware/auth');

        async function createUser(role, email) {
            const { rows: [user] } = await db.query(`INSERT INTO users (id, active, role, email)
                VALUES (gen_random_uuid(),true,$1,$2) RETURNING *`, [role, email]);
            return signToken({ id: user.id, role, email });
        }
        async function call(path, { method = 'GET', body, token } = {}) {
            const response = await fetch(origin + path, {
                method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                ...(body ? { body: JSON.stringify(body) } : {})
            });
            return { status: response.status, body: await response.json() };
        }

        const owner = await createUser('platform_owner', 'owner@example.test');
        const jemelia = await createUser('developer_admin', 'jemelia.peart@gmail.com');
        const unrelated = await createUser('developer_admin', 'other@example.test');
        assert.equal((await call('/staff')).status, 401);
        assert.equal((await call('/staff', { token: unrelated })).status, 403);
        const initial = (await call('/public')).body;
        assert.deepEqual(initial.hosts, []);
        assert.equal(initial.nextDate, null);

        const date = new Date(Date.parse(initial.from + 'T12:00:00Z') + 2 * 86400000).toISOString().slice(0, 10);
        const day = new Date(date + 'T00:00:00Z').getUTCDay();
        const hours = { [day]: { start: '09:00', end: '11:00' } };
        const enable = (host, token, changes = {}) => call('/staff/hosts/' + host, {
            token, method: 'PUT', body: { enabled: true, hours, meetingUrl: 'https://example.test/meeting', ...changes }
        });
        assert.equal((await enable('shamar', jemelia)).status, 200);
        assert.equal((await enable('jemelia', owner, { blockedDates: [date] })).status, 200);
        assert.deepEqual((await call(`/public/slots?host=jemelia&date=${date}`)).body.slots, []);
        assert.deepEqual((await call(`/public/slots?host=both&date=${date}`)).body.slots, []);
        assert.equal((await enable('jemelia', owner, { hours: { [day]: { start: '09:30', end: '11:00' } } })).status, 200);
        assert.equal((await enable('jemelia', owner, { meetingUrl: 'javascript:alert(1)' })).status, 400);
        const config = (await call('/public')).body;
        assert.equal(config.hosts.length, 2);
        assert.equal(config.nextDate, date);
        assert.ok(config.hosts.every(host => !('meeting_url' in host)));

        const { slots } = (await call(`/public/slots?host=shamar&date=${date}`)).body;
        assert.equal(slots.length, 4);
        assert.equal(slots[0], date + 'T14:00:00.000Z');
        const intake = { host: 'shamar', startsAt: slots[0], name: 'Sample client', email: 'client@example.test',
            topic: config.topics[0], details: 'Private project details' };
        const book = body => call('/public', { method: 'POST', body });
        const results = await Promise.all([book(intake), book({ ...intake, email: 'other-client@example.test' })]);
        assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
        const first = results.find(result => result.status === 201).body;
        assert.equal(first.booking.host, 'Shamar Baker');
        assert.equal('email' in first.booking, false);
        assert.equal('details' in first.booking, false);
        const list = (await call('/staff', { token: jemelia })).body;
        assert.equal(list.bookings.length, 1);
        assert.equal(list.bookings[0].details, 'Private project details');

        const { processEmailOutbox } = require('../server/services/emailOutbox');
        const id = list.bookings[0].id;
        const approve = (token, meetingUrl, version = 1, bookingId = id) => call('/staff/' + bookingId, {
            token, method: 'PATCH', body: { action: 'confirm', meetingUrl, version }
        });
        const meet = 'https://meet.google.com/abc-defg-hij';
        assert.equal(first.booking.status, 'pending');
        assert.equal(first.booking.meetingUrl, '');
        assert.equal((await call('/staff/' + id)).status, 401);
        assert.equal((await call('/staff/' + id, { token: unrelated })).status, 403);
        assert.equal((await call('/staff/' + id, { token: jemelia })).body.booking.id, id);
        assert.equal(jobs.length, 2);
        await Promise.all(jobs.slice().map(data => processEmailOutbox({ data })));
        assert.deepEqual(sent.flatMap(message => message.to).sort(), ['jemelia.peart@gmail.com', 'owner@example.test']);
        assert.ok(sent.every(message => message.text.includes('/platform?consultation=' + id)));
        assert.ok(sent.every(message => !message.text.includes(first.token)));

        const jointSlots = (await call(`/public/slots?host=both&date=${date}`)).body.slots;
        assert.deepEqual(jointSlots, slots.slice(1));
        const manage = body => call('/public/manage', { method: 'POST', body });
        assert.equal((await manage({ token: first.token + 'x' })).status, 404);
        assert.equal((await manage({ token: first.token, action: 'confirm', meetingUrl: meet })).status, 400);
        assert.equal((await approve(unrelated, meet)).status, 403);
        assert.equal((await approve(jemelia, 'https://example.test/meeting')).status, 400);
        assert.equal(jobs.length, 2);
        const approvals = await Promise.all([approve(jemelia, meet + '?authuser=1'), approve(owner, meet)]);
        assert.ok(approvals.every(result => result.status === 200 && result.body.booking.status === 'confirmed'));
        assert.equal(jobs.length, 3, 'confirmation queues exactly one email even if both hosts submit');
        await processEmailOutbox({ data: jobs[2] });
        const confirmation = sent.at(-1);
        assert.equal(sent.length, 3);
        assert.equal(confirmation.to[0], list.bookings[0].email);
        assert.match(confirmation.subject, /consultation is confirmed/);
        assert.match(confirmation.text, /Jamaica time/);
        assert.ok(confirmation.text.includes(meet));
        assert.ok(confirmation.text.includes(first.token));
        assert.equal((await call('/staff/' + id, { token: owner })).body.booking.email_status, 'sent');

        const move = await call('/staff/' + id, { token: jemelia, method: 'PATCH',
            body: { action: 'reschedule', host: 'jemelia', startsAt: slots[1] } });
        assert.equal(move.status, 200);
        assert.equal(move.body.booking.host_id, 'jemelia');
        assert.equal((await manage({ token: first.token })).body.booking.meetingUrl, meet);
        assert.equal((await manage({ token: first.token, action: 'cancel' })).body.booking.status, 'cancelled');
        await processEmailOutbox({ data: jobs[3] });
        assert.equal(sent.length, 3, 'obsolete reschedule email is suppressed');
        await processEmailOutbox({ data: jobs[4] });
        assert.match(sent.at(-1).subject, /cancelled/);
        assert.ok((await call(`/public/slots?host=jemelia&date=${date}`)).body.slots.includes(slots[1]));

        const race = await Promise.all([
            book({ ...intake, host: 'both', startsAt: slots[1] }),
            book({ ...intake, host: 'jemelia', startsAt: slots[1], email: 'other-client@example.test' })
        ]);
        assert.deepEqual(race.map(result => result.status).sort(), [201, 409]);
        let joint = race[0];
        if (joint.status === 409) {
            const existing = race[1].body.token;
            assert.equal((await manage({ token: existing, action: 'cancel' })).status, 200);
            joint = await book({ ...intake, host: 'both', startsAt: slots[1] });
        }
        assert.equal(joint.status, 201);
        assert.equal(joint.body.booking.hostId, 'both');
        assert.equal(joint.body.booking.host, 'Shamar Baker and Jemelia Peart');
        assert.equal(joint.body.booking.status, 'pending');
        assert.equal(joint.body.booking.meetingUrl, '');
        for (const host of ['shamar', 'jemelia', 'any', 'both']) {
            const available = await call(`/public/slots?host=${host}&date=${date}`);
            assert.equal(available.body.slots.includes(slots[1]), false);
        }
        for (const host of ['shamar', 'jemelia', 'both']) {
            const filtered = await call(`/staff?host=${host}`, { token: owner });
            assert.equal(filtered.body.bookings.length, 1);
            assert.equal(filtered.body.bookings[0].joint, true);
        }

        const jointRecord = (await call('/staff?host=both', { token: owner })).body.bookings[0];
        await assert.rejects(() => db.query(`INSERT INTO consultations (host_id,starts_at,client_name,email,topic)
            VALUES ('jemelia',$1,'Test','test@example.test','Test')`, [slots[1]]), { code: '23505' });
        const ownSlot = await call(`/staff/slots?host=both&date=${date}&exclude=${jointRecord.id}`, { token: owner });
        assert.ok(ownSlot.body.slots.includes(slots[1]));
        const movedJoint = await manage({ token: joint.body.token, action: 'reschedule', host: 'both', startsAt: slots[2] });
        assert.equal(movedJoint.body.booking.hostId, 'both');
        assert.equal(movedJoint.body.booking.status, 'pending');
        assert.equal((await approve(owner, meet, jointRecord.version, jointRecord.id)).status, 409);
        const moved = (await call('/staff/' + jointRecord.id, { token: owner })).body.booking;
        assert.equal((await approve(owner, meet, moved.version, jointRecord.id)).status, 200);
        await processEmailOutbox({ data: jobs.at(-1) });
        assert.match(sent.at(-1).text, /Shamar Baker and Jemelia Peart/);
        assert.ok((await call(`/public/slots?host=both&date=${date}`)).body.slots.includes(slots[1]));
        assert.equal((await manage({ token: joint.body.token, action: 'cancel' })).status, 200);
        assert.ok((await call(`/public/slots?host=both&date=${date}`)).body.slots.includes(slots[2]));

        async function pastConsultation(status, email) {
            const { rows: [row] } = await db.query(`INSERT INTO consultations
                (host_id, starts_at, client_name, email, topic, status, staff_notes)
                VALUES ('shamar', NOW() - INTERVAL '1 day', 'Sam Client', $1, 'ICSS Bookings demo', $2, 'Internal qualification details')
                RETURNING *`, [email, status]);
            return row;
        }
        const lead = await pastConsultation('confirmed', 'lead@example.test');
        const lost = await pastConsultation('completed', 'lost@example.test');
        const noShow = await pastConsultation('no_show', 'no-show@example.test');
        const complete = (booking, token, outcome, message = '') => call('/staff/' + booking.id, {
            token, method: 'PATCH', body: { action: 'complete', outcome, message, version: booking.version }
        });
        const followUpPreview = (booking, token, outcome, message) => call('/staff/' + booking.id + '/follow-up-preview', {
            token, method: 'POST', body: { outcome, message }
        });
        const ready = await call('/staff?status=closeout', { token: owner });
        assert.deepEqual(new Set(ready.body.bookings.map(item => item.id)), new Set([lead.id, lost.id]));
        assert.equal((await followUpPreview(lead, unrelated, 'lead')).status, 403);
        assert.equal((await complete(lead, jemelia, ['lead'])).status, 400);
        assert.equal((await complete(lead, jemelia, 'lead', 'x'.repeat(1501))).status, 400);
        assert.equal((await complete(noShow, jemelia, 'lost')).status, 409);
        assert.equal((await manage({
            token: require('../server/services/consultations').manageToken(lead.id), action: 'complete', outcome: 'lead'
        })).status, 400);

        const followUp = 'As discussed, we can start with your booking page. <Next step>';
        const leadDraft = (await followUpPreview(lead, owner, 'lead', followUp)).body;
        const lostDraft = (await followUpPreview(lost, jemelia, 'lost')).body;
        assert.notEqual(leadDraft.subject, lostDraft.subject);
        assert.equal(leadDraft.to, lead.email);
        const beforeCloseout = jobs.length;
        const closeResults = await Promise.all([complete(lead, jemelia, 'lead', followUp), complete(lead, owner, 'lead', followUp)]);
        assert.ok(closeResults.every(result => result.status === 200 && result.body.booking.outcome === 'lead'));
        assert.equal(jobs.length, beforeCloseout + 1);
        assert.equal((await complete(lead, owner, 'lost')).status, 409);
        const result = await complete(lost, owner, 'lost');
        assert.equal(result.body.booking.status, 'completed');
        assert.equal(result.body.booking.outcome, 'lost');
        assert.ok(result.body.booking.outcome_by);
        assert.ok(result.body.booking.outcome_at);
        await Promise.all(jobs.slice(beforeCloseout).map(data => processEmailOutbox({ data })));
        for (const [booking, draft] of [[lead, leadDraft], [lost, lostDraft]]) {
            const email = sent.find(message => message.to[0] === booking.email);
            assert.equal(email.subject, draft.subject);
            assert.equal(email.text, draft.paragraphs.join('\n\n'));
            assert.doesNotMatch(email.text, /Internal qualification details|Outcome:|marked as lost/i);
        }
        assert.match(sent.find(message => message.to[0] === lead.email).html, /&lt;Next step&gt;/);
        const publicCompleted = await manage({ token: require('../server/services/consultations').manageToken(lead.id) });
        assert.equal(publicCompleted.body.booking.status, 'completed');
        assert.equal('outcome' in publicCompleted.body.booking, false);
        const leads = await call('/staff?status=completed&outcome=lead', { token: owner });
        assert.deepEqual(leads.body.bookings.map(item => item.id), [lead.id]);
        assert.equal(leads.body.bookings[0].email_status, 'sent');
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        await db.close();
    }
});
