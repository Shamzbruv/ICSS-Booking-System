const PAGE_SIZE = 25;
const DEFAULT_TIMEZONE = 'America/Jamaica';

// Match normalized emails first. A phone-only booking can join an email profile
// only when that number points to one email in this business's booking history.
const CLIENT_BOOKINGS = `
    WITH contact_data AS (
        SELECT id, service_id, name, phone, booking_date, booking_time, status, created_at, booking_source,
               LOWER(NULLIF(BTRIM(email), '')) AS email_key,
               REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') AS phone_digits
        FROM bookings WHERE tenant_id = $1
    ), contacts AS (
        SELECT *, CASE
            WHEN phone_digits ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' AND LTRIM(phone) NOT LIKE '+%' THEN '1' || phone_digits
            WHEN LENGTH(phone_digits) >= 7 THEN phone_digits
        END AS phone_key
        FROM contact_data
    ), phone_emails AS (
        SELECT phone_key, MIN(email_key) AS email_key
        FROM contacts
        WHERE phone_key IS NOT NULL AND email_key IS NOT NULL
        GROUP BY phone_key HAVING COUNT(DISTINCT email_key) = 1
    ), client_bookings AS MATERIALIZED (
        SELECT c.*, COALESCE('email:' || COALESCE(c.email_key, p.email_key),
            'phone:' || c.phone_key, 'booking:' || c.id::text) AS client_key
        FROM contacts c LEFT JOIN phone_emails p ON p.phone_key = c.phone_key
    )
`;

const PROFILE_FIELDS = `
    (ARRAY_AGG(id ORDER BY created_at DESC NULLS LAST, id DESC))[1] AS id,
    (ARRAY_AGG(NULLIF(BTRIM(name), '') ORDER BY created_at DESC NULLS LAST, id DESC)
      FILTER (WHERE NULLIF(BTRIM(name), '') IS NOT NULL))[1] AS name,
    MIN(email_key) AS email,
    (ARRAY_AGG(NULLIF(BTRIM(phone), '') ORDER BY created_at DESC NULLS LAST, id DESC)
      FILTER (WHERE NULLIF(BTRIM(phone), '') IS NOT NULL))[1] AS phone,
    COUNT(*)::int AS bookings,
    COUNT(*) FILTER (WHERE status = 'completed')::int AS visits,
    MAX(booking_date) FILTER (WHERE status = 'completed')::text AS last_visit,
    MAX(created_at) AS latest_booking
`;

const SERVICE_LABEL = "COALESCE(s.name, NULLIF(NULLIF(i.snapshot->>'service', ''), 'Booked service'))";
const SERVICE_JOINS = `
    LEFT JOIN services s ON s.id = b.service_id AND s.tenant_id = $1
    LEFT JOIN booking_invoices i ON i.booking_id = b.id AND i.tenant_id = $1 AND s.id IS NULL
`;
const USAGE_FIELDS = `COALESCE(b.service_id::text, ${SERVICE_LABEL}) AS service_key,
    MIN(${SERVICE_LABEL}) AS name, COUNT(*)::int AS visits, MAX(b.booking_date) AS most_recent`;
const USAGE_ORDER = 'visits DESC, most_recent DESC, name ASC, service_key ASC';

const SORTS = new Map([
    ['recent', 'latest_booking DESC NULLS LAST, id DESC'],
    ['visits', 'visits DESC, latest_booking DESC NULLS LAST, id DESC'],
    ['name', "LOWER(COALESCE(name, '')) ASC, id ASC"]
]);
const FILTERS = new Map([
    ['all', 'TRUE'],
    ['returning', 'visits > 1'],
    ['first', 'visits = 1'],
    ['no_visits', 'visits = 0']
]);

function pageOffset(page) {
    return (page - 1) * PAGE_SIZE;
}

async function listClients(query, tenantId, { search = '', filter = 'all', sort = 'recent', page = 1 } = {}) {
    const term = search.trim().toLowerCase().slice(0, 160);
    const phone = /^[+\d().\s-]+$/.test(term) ? term.replace(/\D/g, '') : '';
    const sortSql = SORTS.get(sort) || SORTS.get('recent');
    const filterSql = FILTERS.get(filter) || FILTERS.get('all');
    const { rows: [data] } = await query(`
        ${CLIENT_BOOKINGS}, profiles AS MATERIALIZED (
            SELECT client_key, ${PROFILE_FIELDS},
                   BOOL_OR($2 = '' OR STRPOS(LOWER(name), $2) > 0 OR STRPOS(email_key, $2) > 0
                       OR ($3 <> '' AND STRPOS(phone_digits, $3) > 0)) AS matches
            FROM client_bookings GROUP BY client_key
        ), filtered AS (
            SELECT * FROM profiles WHERE matches AND (${filterSql})
        ), page_profiles AS MATERIALIZED (
            SELECT *, ROW_NUMBER() OVER (ORDER BY ${sortSql}) AS position
            FROM filtered ORDER BY ${sortSql} LIMIT $4 OFFSET $5
        ), usage AS (
            SELECT b.client_key, ${USAGE_FIELDS}
            FROM client_bookings b JOIN page_profiles p ON p.client_key = b.client_key
            ${SERVICE_JOINS}
            WHERE b.status = 'completed' AND ${SERVICE_LABEL} IS NOT NULL
            GROUP BY b.client_key, service_key
        ), popular AS (
            SELECT DISTINCT ON (client_key) client_key, name, visits
            FROM usage ORDER BY client_key, ${USAGE_ORDER}
        )
        SELECT
            (SELECT COUNT(*)::int FROM filtered) AS total,
            (SELECT JSON_BUILD_OBJECT(
                'clients', COUNT(*)::int,
                'returning', COUNT(*) FILTER (WHERE visits > 1)::int,
                'visits', COALESCE(SUM(visits), 0)
            ) FROM profiles) AS overview,
            COALESCE((SELECT JSON_AGG(JSON_BUILD_OBJECT(
                'id', p.id, 'name', p.name, 'email', p.email, 'phone', p.phone,
                'bookings', p.bookings, 'visits', p.visits, 'last_visit', p.last_visit,
                'top_service', popular.name, 'top_service_visits', popular.visits
            ) ORDER BY p.position) FROM page_profiles p LEFT JOIN popular USING (client_key)), '[]'::json) AS clients
    `, [tenantId, term, phone, PAGE_SIZE, pageOffset(page)]);
    return { ...data, page, limit: PAGE_SIZE };
}

async function clientProfile(query, tenantId, bookingId, timezone, page = 1) {
    let timeZone = timezone || DEFAULT_TIMEZONE;
    try { new Intl.DateTimeFormat('en', { timeZone }); }
    catch { timeZone = DEFAULT_TIMEZONE; }
    const { rows: [data] } = await query(`
        ${CLIENT_BOOKINGS}, history AS MATERIALIZED (
            SELECT b.*, ${SERVICE_LABEL} AS service_name
            FROM client_bookings b
            JOIN client_bookings anchor ON anchor.id = $2 AND anchor.client_key = b.client_key
            ${SERVICE_JOINS}
        ), profile AS (
            SELECT ${PROFILE_FIELDS},
                   COUNT(*) FILTER (WHERE status = 'no_show')::int AS no_shows,
                   COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancellations
            FROM history HAVING COUNT(*) > 0
        ), usage AS (
            SELECT COALESCE(service_id::text, service_name) AS service_key, MIN(service_name) AS name,
                   COUNT(*)::int AS visits, MAX(booking_date) AS most_recent
            FROM history WHERE status = 'completed' AND service_name IS NOT NULL GROUP BY service_key
        ), appointments AS (
            SELECT id, service_name, status, booking_source, booking_date::text, booking_time::text
            FROM history ORDER BY booking_date DESC, booking_time DESC, id DESC LIMIT $3 OFFSET $4
        ), next_appointment AS (
            SELECT id, service_name, booking_date::text, booking_time::text FROM history
            WHERE status = 'confirmed' AND booking_date + booking_time >= CURRENT_TIMESTAMP AT TIME ZONE $5
            ORDER BY booking_date, booking_time, id LIMIT 1
        )
        SELECT (SELECT ROW_TO_JSON(profile) FROM profile) AS client,
               COALESCE((SELECT JSON_AGG(appointments ORDER BY booking_date DESC, booking_time DESC, id DESC) FROM appointments), '[]'::json) AS appointments,
               COALESCE((SELECT JSON_AGG(JSON_BUILD_OBJECT('name', name, 'visits', visits) ORDER BY ${USAGE_ORDER})
                   FROM (SELECT * FROM usage ORDER BY ${USAGE_ORDER} LIMIT 10) popular), '[]'::json) AS services,
               (SELECT ROW_TO_JSON(next_appointment) FROM next_appointment) AS next_appointment
    `, [tenantId, bookingId, PAGE_SIZE, pageOffset(page), timeZone]);
    return data.client ? { ...data, page, limit: PAGE_SIZE } : null;
}

module.exports = { listClients, clientProfile };
