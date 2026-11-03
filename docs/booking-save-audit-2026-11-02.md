# ICSS Bookings save failure investigation — 2 November 2026

## Confirmed failure chain

The website builder inherited a legacy base64-encoded PNG from Stunner Pro MUA's `branding.logoUrl`. The logo occupied 818,802 characters. Resolving the normal four-page template produced an 824,998-byte draft, exceeding the server's 262,144-byte website-settings limit before the user made any edits.

Every subsequent change sent the complete draft to `PUT /api/v1/tenants/:slug/site/draft`. The server correctly returned HTTP 400 for the oversized settings document, but the editor retried failed saves every 1.2 seconds. Those repeated requests also exhausted the former shared 200-request/15-minute allowance, causing HTTP 429 responses across the builder, theme, media, and public-preview endpoints.

The first rate-limit/retry correction addressed the secondary failures. It did not fix the embedded-image payload that caused the original save rejection.

## Corrections

- Moved three existing embedded images across the two tenant accounts into the existing durable media library. Preserved decoded image bytes and replaced references with `/media/<id>` links. Updated branding/site documents atomically, guarded against concurrent tenant edits. Preserved all customer bookings, payments, services, and website text.
- Draft and publish requests now convert legacy embedded raster images to tenant-owned media links before enforcing the settings-document limit. Existing media is reused on subsequent requests. Invalid or oversized text documents still fail validation, and a failed save preserves the existing stored draft.
- Branding updates now accept the media-library URLs used by the builder and normalize legacy embedded images as well.
- Successful saves adopt the server's canonical document only when no newer edits arrived while the request was running. Publishing also preserves edits made during the request.
- Retained the earlier separation of authenticated admin/public API budgets, stopped failed autosave retry loops, and added preview failure/retry feedback.
- Replaced 33 exception-swallowing legacy column additions with `ADD COLUMN IF NOT EXISTS`, eliminating duplicate-column errors on routine startup and allowing genuine migration failures to surface.
- Removed the older date/time uniqueness constraint that still blocked reuse of cancelled appointments. Active booking conflicts remain checked inside the transaction that locks the tenant row.
- Added 33 covering indexes for application foreign keys. Restricted public execution of Supabase's internal RLS helper and fixed the search paths of the existing queue functions. These changes are retained in the application's startup database maintenance.

## Database findings

The selected Supabase project is `iCSS Booking System` (`xqtmkovonfcemeqkdejg`). Database, pooler, REST, Storage and Auth health checks returned healthy. All 33 application tables, 402 expected columns, and pre-existing application indexes were present. No missing schema fields explained the save rejection.

The audit found no invalid indexes, unvalidated public constraints, blocked queries, transactions older than 60 seconds, invalid booking intervals, stale expiring holds, invalid site document types, or media byte-count mismatches. The checked booking/service/user/payment/invoice/review tenant relationships had no mismatches.

The audit snapshot contained 258 bookings, 55 application users, 242 booking-payment records, and two active tenants. The image conversion added three media records without deleting the originals' image bytes or changing booking/payment records.

There are no external calendar connections. `sync_status = pending` therefore does not show that an existing external calendar integration is failing. Five unprocessed provisioning records date from April–May; these were not replayed or used to create accounts during this repair.

After the database corrections, Supabase advisors returned no WARN or ERROR findings. Informational notices remain for backend-only tables with RLS and no client policies, three queue-library foreign keys, and indexes with no recorded use yet. The application authenticates its own users and queries PostgreSQL through its server; adding broad client RLS policies to remove those informational notices would change the access model.

## Verification

- Reproduced the exact save error with the real business's public tenant data and the production website resolver.
- The same complete four-page draft now occupies 6,251 bytes after converting the inherited logo to a media URL, versus 824,998 bytes before conversion.
- Rehearsed the image conversion and complete startup schema in rolled-back live-database transactions.
- Verified reuse of a cancelled timeslot and the restricted internal helper inside a rolled-back database transaction.
- Saved and reloaded the corrected real-business draft in the live database inside a rolled-back transaction. Did not publish test content to the business's website.
- 94 automated tests passed. Added HTTP round-trip tests for draft save, reload, publish, media reuse, branding updates, oversized-draft preservation, and cross-tenant/customer denial. Added editor tests for canonical saves and concurrent edits.
- Frontend production build passed. Frontend lint passed with 11 existing warnings and no errors.

A live authenticated browser session was unavailable. The automated route tests and rolled-back database checks are evidence of the save path; they are not a claim that the user's currently open editor session was directly operated or that its unsaved content was recovered from that browser.

## Source references

- PostgreSQL 17 ALTER TABLE: https://www.postgresql.org/docs/17/sql-altertable.html
- PostgreSQL 17 binary data: https://www.postgresql.org/docs/17/datatype-binary.html
- Supabase JSON data: https://supabase.com/docs/guides/database/json
- Supabase advisor remediation for foreign-key indexes: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- Supabase advisor remediation for privileged function access: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

Production code delivery follows GitHub `main` and the existing Railway automatic deployment. Credentials remain outside source control.
