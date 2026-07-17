const { initDatabase } = require('./connection');

initDatabase()
    .then(() => { console.log('Database schema and seed data are current.'); process.exit(0); })
    .catch(err => { console.error('Database migration failed:', err.message); process.exit(1); });
