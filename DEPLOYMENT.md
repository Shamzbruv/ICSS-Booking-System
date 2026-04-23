# ICSS Booking System — Deployment Guide

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js     | >= 18.0.0 (use `.nvmrc`) |
| PostgreSQL   | >= 14 (Supabase/Railway) |

## Required environment variables

Set these in your hosting provider's dashboard. Never commit them.

```
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Auth
JWT_SECRET=<min 64 chars random string>

# Email
RESEND_API_KEY=re_xxxxxxxx

# App URL (used for WiPay return URLs — must be HTTPS in production)
PUBLIC_APP_URL=https://icssbookings.com

# PayPal (SaaS provisioning)
PAYPAL_CLIENT_ID=AZM7kD2EdxPGkSVk3I64iMNN_...
PAYPAL_SECRET=<your PayPal secret>
PAYPAL_WEBHOOK_ID=<from PayPal developer dashboard>

# WiPay (tenant payment gateway)
WIPAY_ACCOUNT_NUMBER=<encrypted via admin settings>

# Encryption
ENCRYPTION_KEY=<64-char hex string>

# Environment
NODE_ENV=production
```

## Fresh deploy steps

```bash
# 1. Clone
git clone https://github.com/Shamzbruv/ICSS-Booking-System.git
cd ICSS-Booking-System

# 2. Backend dependencies
npm ci

# 3. Frontend — clean install + build
cd frontend
npm ci
npm run build
cd ..

# 4. Start server
npm start
```

The Express server serves the built `frontend/dist` statically.

## Railway / Render

The `npm start` script runs the Express server, which:
- Auto-initialises all DB tables on first boot (idempotent)
- Serves `frontend/dist` as static files
- Starts all `pg-boss` workers

No separate frontend server is needed.

## Smoke test checklist (run after every deploy)

### Public booking

- [ ] Visit `https://icssbookings.com/book/<slug>`
- [ ] Service cards render with name, price, duration
- [ ] Select a service → calendar loads
- [ ] Select today + 2 days → time slots appear (some may be grey if booked)
- [ ] Select an available slot → customer form appears
- [ ] Submit form → success screen / payment redirect appears

### No-payment booking

- [ ] Configure a service with `payment_mode = none`
- [ ] Complete the booking flow
- [ ] Booking goes directly to `confirmed` status
- [ ] Check admin panel → booking visible and confirmed

### WiPay booking

- [ ] Configure a service with `payment_mode = wipay`
- [ ] Complete booking → redirected to WiPay checkout
- [ ] After payment → return URL (`PUBLIC_APP_URL/book/<slug>?booking=<id>&transaction_id=<txn>`) shows verification
- [ ] Admin panel → booking moves to `confirmed`

### Manual bank transfer

- [ ] Configure a service with `payment_mode = manual`
- [ ] Complete booking → bank instructions shown to customer
- [ ] Admin panel → booking appears as `pending_manual_confirmation`
- [ ] Admin clicks Approve → booking moves to `confirmed`
- [ ] Admin clicks Reject → booking moves to `rejected`

### PayPal provisioning

- [ ] Visit `/platform-setup.html`
- [ ] Fill in all fields → select theme → click Subscribe
- [ ] PayPal button loads and accepts payment
- [ ] PayPal webhook fires → provisioning worker runs
- [ ] Poll `/api/v1/public/provisioning-status/<token>` → eventually returns `provisioned`
- [ ] Login with the provisioned credentials → editor loads with correct tenant

## Known limitations at this release

| Area | Status |
|------|--------|
| Invoice delivery | Link-based (intentional — no cloud storage provisioned yet) |
| PDF generation | Not yet (requires S3/R2 bucket setup) |
| CalDAV/Google Calendar sync | Requires tenant OAuth setup |
