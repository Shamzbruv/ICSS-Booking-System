# ICSS Booking System

**Multi-tenant commercial booking SaaS** — a white-label platform that powers booking engines, order management, and client portals for multiple business clients on a single codebase.

Generalized from the [Windross Tailoring & Designs](https://windrosstailoringanddesign.com) booking engine and extended into a full SaaS platform by [iCreate Solutions & Services](https://icreatesolutionsandservices.com).

---

## Features

- **Multi-tenant architecture** — shared PostgreSQL DB with `tenant_id` isolation on every table
- **JWT authentication + RBAC** — 4 roles: `customer`, `staff`, `tenant_admin`, `super_admin`
- **Subscription plans** — Starter / Pro / Enterprise with booking limits and feature flags
- **WiPay payment integration** — with HMAC hash verification and multi-tenant credentials
- **Per-tenant branded emails** — confirmation, cancellation, order, and design inquiry emails via Resend
- **PDF invoices** — PDFKit-based booking confirmations and order invoices with tenant branding
- **Per-tenant pricing engine** — configurable styles, fabric grades, construction types, and size surcharges
- **Admin dashboard** — dark-mode portal with bookings, availability calendar, design inquiries, and tenant management
- **Public booking widget** — embeddable 4-step booking flow (calendar → slots → form → confirmation)
- **Docker + CI/CD** — production-ready Dockerfile, docker-compose, and GitHub Actions pipeline

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           ICSS Booking System (SaaS)                 │
│                                                     │
│  windross.icss.app   salon-x.icss.app   ...         │
│         │                 │                         │
│    ┌────▼─────────────────▼────────────────────┐    │
│    │  tenantResolver middleware                 │    │
│    │  Subdomain → slug → DB lookup → req.tenant│    │
│    └────────────────────────────────────────────┘    │
│                         │                           │
│    ┌────────────────────▼────────────────────────┐  │
│    │  JWT Auth + RBAC middleware                  │  │
│    └────────────────────────────────────────────-┘  │
│                         │                           │
│    ┌────────────────────▼────────────────────────┐  │
│    │  REST API  /api/v1/                          │  │
│    │  auth · availability · bookings · orders     │  │
│    │  payments · admin · tenants · pricing        │  │
│    │  public (no-auth widget endpoints)           │  │
│    └──────────────────────────────────────────────┘  │
│                         │                           │
│    ┌────────────────────▼────────────────────────┐  │
│    │  PostgreSQL (11 tables, all with tenant_id) │  │
│    └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Quick Start (Local with Docker)

```bash
# 1. Clone and copy environment file
git clone https://github.com/Shamzbruv/ICSS-Booking-System.git
cd ICSS-Booking-System
cp .env.example .env

# 2. Fill in your values (see .env.example for all variables)
nano .env

# 3. Start the stack
docker compose up

# 4. Access
#   Health check:  http://localhost:3000/health
#   Admin panel:   http://localhost:3000/admin/login.html
#   Booking page:  http://localhost:3000/book.html
#   API:           http://localhost:3000/api/v1/
```

---

## Local Development (without Docker)

```bash
npm install
# Requires a running PostgreSQL instance
# Set DATABASE_URL in your .env
node server/app.js
```

> The server auto-runs all database migrations on boot — no separate migration step needed.

---

## First Tenant Setup

After the server is running, provision your first tenant:

```bash
curl -X POST http://localhost:3000/api/v1/tenants \
  -H "Content-Type: application/json" \
  -H "X-Platform-Admin-Key: YOUR_PLATFORM_KEY" \
  -d '{
    "slug": "windross",
    "name": "Windross Tailoring & Design",
    "plan": "pro",
    "adminEmail": "admin@windross.com",
    "adminPassword": "securepassword",
    "branding": {
      "businessName": "Windross Tailoring",
      "primaryColor": "#D4AF37",
      "timezone": "America/Jamaica"
    }
  }'
```

Then log in to the admin panel at `http://localhost:3000/admin/login.html` using the slug `windross` and the admin credentials.

---

## API Reference

All endpoints are versioned under `/api/v1/`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register a user |
| POST | `/auth/login` | Public | Login, returns JWT |
| GET | `/auth/me` | JWT | Get current user profile |
| GET | `/availability` | Public | Fetch available booking slots |
| POST | `/bookings` | Public | Create a booking |
| GET | `/bookings` | JWT | List tenant's bookings |
| PATCH | `/bookings/:id/cancel` | JWT | Cancel a booking |
| POST | `/orders` | JWT | Create a custom order |
| POST | `/payments/wipay/order` | JWT | Initiate WiPay order payment |
| POST | `/payments/wipay/verify` | Public | WiPay payment callback |
| GET | `/admin/summary` | tenant_admin | Dashboard stats |
| GET | `/admin/designs` | tenant_admin | List design inquiries |
| POST | `/tenants` | Platform key | Provision new tenant |
| PATCH | `/tenants/:slug/plan` | Platform key | Change tenant plan |
| GET | `/pricing/config` | Public | Tenant pricing catalog |
| POST | `/pricing/calculate` | Public | Authoritative price calculation |
| GET | `/public/tenant` | Public | Tenant branding for widget |
| POST | `/public/designs` | Public | Submit design inquiry |

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `WIPAY_ACCOUNT_NUMBER` | WiPay merchant account number |
| `WIPAY_API_KEY` | WiPay API key |
| `PLATFORM_ADMIN_KEY` | Key to protect tenant provisioning routes |
| `NODE_ENV` | `development` or `production` |

---

## Deployment (Railway)

1. Create a new project on [Railway](https://railway.app)
2. Connect this GitHub repo
3. Add a PostgreSQL plugin
4. Set all environment variables from `.env.example`
5. Deploy — the server auto-migrates the database on first boot

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 (LTS) |
| Framework | Express.js |
| Database | PostgreSQL 16 |
| Auth | JWT + bcryptjs |
| Email | Resend |
| PDF | PDFKit |
| Payments | WiPay |
| Containerization | Docker + docker-compose |
| CI/CD | GitHub Actions + GHCR |

---

## License

Private — © iCreate Solutions & Services. All rights reserved.
