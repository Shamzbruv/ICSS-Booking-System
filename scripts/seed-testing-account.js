const { query, transaction } = require('../server/db/connection');

const TENANT_ID = 'd45e3755-6675-44b9-9ac9-6eb073d115a3'; // iCreate - Testing Account

const SERVICES = [
    { name: 'Classic Haircut', duration: 45, price: 2500 },
    { name: 'Haircut & Beard Trim', duration: 60, price: 3500 },
    { name: 'Shape Up / Edge Up', duration: 30, price: 2000 },
    { name: 'Hot Towel Shave', duration: 45, price: 3000 },
    { name: 'Kids Haircut', duration: 40, price: 2000 },
    { name: 'Premium Full Grooming', duration: 90, price: 5000 },
    { name: 'Hair Dye / Color', duration: 60, price: 4000 },
    { name: 'Scalp Treatment', duration: 30, price: 2500 }
];

const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Lisa', 'Daniel', 'Nancy', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateUsers(count) {
    const users = [];
    for (let i = 0; i < count; i++) {
        const first = getRandomItem(FIRST_NAMES);
        const last = getRandomItem(LAST_NAMES);
        users.push({
            name: `${first} ${last}`,
            email: `${first.toLowerCase()}.${last.toLowerCase()}${getRandomInt(1, 9999)}@example.com`
        });
    }
    return users;
}

function generateRandomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function run() {
    console.log(`Starting fake data seeding for tenant: ${TENANT_ID}`);

    try {
        await query('UPDATE tenants SET is_test_account = true WHERE id = $1', [TENANT_ID]);
        console.log('Clearing old testing data...');
        await query('DELETE FROM booking_payments WHERE tenant_id = $1', [TENANT_ID]);
        await query('DELETE FROM bookings WHERE tenant_id = $1', [TENANT_ID]);
        await query('DELETE FROM services WHERE tenant_id = $1', [TENANT_ID]);
        await query('DELETE FROM users WHERE tenant_id = $1', [TENANT_ID]);
        // 1. Insert Services
            console.log('Inserting services...');
            const serviceIds = [];
            for (const s of SERVICES) {
                const res = await query(
                    `INSERT INTO services (tenant_id, name, duration_minutes, price, currency, active)
                     VALUES ($1, $2, $3, $4, 'JMD', true)
                     RETURNING id`,
                    [TENANT_ID, s.name, s.duration, s.price]
                );
                serviceIds.push(res.rows[0].id);
            }

            // 2. Insert Users
            console.log('Inserting 50 users...');
            const users = generateUsers(50);
            const userIds = [];
            for (const u of users) {
                const res = await query(
                    `INSERT INTO users (tenant_id, name, email, role, active)
                     VALUES ($1, $2, $3, 'customer', true)
                     ON CONFLICT (tenant_id, email) DO UPDATE SET name = EXCLUDED.name
                     RETURNING id, name, email`,
                    [TENANT_ID, u.name, u.email]
                );
                userIds.push(res.rows[0]);
            }

            // 3. Insert Bookings
            console.log('Inserting 150 bookings...');
            const now = new Date();
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 30);
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);

            const statuses = ['confirmed', 'completed', 'pending_payment', 'cancelled'];
            let insertedBookings = 0;

            for (let i = 0; i < 150; i++) {
                const user = getRandomItem(userIds);
                const serviceId = getRandomItem(serviceIds);
                const service = SERVICES[serviceIds.indexOf(serviceId)];
                
                // Random date between 30 days ago and 30 days in future
                const bookingDateObj = generateRandomDate(pastDate, futureDate);
                const dateStr = bookingDateObj.toISOString().split('T')[0];
                
                // Random time between 9:00 and 17:00
                const hour = getRandomInt(9, 16);
                const minute = getRandomItem([0, 15, 30, 45]);
                const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
                
                bookingDateObj.setHours(hour, minute, 0, 0);
                const startTime = bookingDateObj;
                const endTime = new Date(startTime.getTime() + service.duration * 60000);
                
                // Determine status. Past bookings should mostly be completed, future ones confirmed/pending
                let status;
                if (startTime < now) {
                    status = Math.random() > 0.1 ? 'completed' : 'cancelled';
                } else {
                    status = getRandomItem(['confirmed', 'confirmed', 'pending_payment']);
                }

                try {
                    const res = await query(
                        `INSERT INTO bookings (
                            tenant_id, user_id, service_id, name, email, phone,
                            booking_date, booking_time, start_time, end_time,
                            status, payment_mode, service_price, service_currency
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6,
                            $7, $8, $9, $10,
                            $11, 'wipay', $12, 'JMD'
                        ) RETURNING id`,
                        [
                            TENANT_ID, user.id, serviceId, user.name, user.email, '876-555-' + getRandomInt(1000, 9999),
                            dateStr, timeStr, startTime.toISOString(), endTime.toISOString(),
                            status, service.price
                        ]
                    );
                    
                    const bookingId = res.rows[0].id;
                    insertedBookings++;

                    // 4. Insert Booking Payments
                    if (status === 'completed' || status === 'confirmed') {
                        await query(
                            `INSERT INTO booking_payments (
                                booking_id, tenant_id, provider, payment_type,
                                amount_due, amount_paid, status, currency
                            ) VALUES ($1, $2, 'wipay', 'full', $3, $4, 'completed', 'JMD')`,
                            [bookingId, TENANT_ID, service.price, service.price]
                        );
                    } else if (status === 'pending_payment') {
                        await query(
                            `INSERT INTO booking_payments (
                                booking_id, tenant_id, provider, payment_type,
                                amount_due, amount_paid, status, currency
                            ) VALUES ($1, $2, 'wipay', 'full', $3, 0, 'pending', 'JMD')`,
                            [bookingId, TENANT_ID, service.price]
                        );
                    }
                } catch (err) {
                    // Ignore overlaps (UNIQUE constraint on tenant_id, start_time, end_time)
                    if (!err.message.includes('unique constraint')) {
                        throw err;
                    }
                }
            }

            console.log(`Successfully inserted ${insertedBookings} bookings.`);

        console.log('✅ Fake data seeding complete!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Error seeding data:', err);
        process.exit(1);
    }
}

run();
