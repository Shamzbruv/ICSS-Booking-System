# ICSS Booking System

**Multi-tenant commercial booking SaaS** — a white-label platform that powers booking engines, order management, and client portals for multiple business clients on a single codebase.

Generalized from the [Windross Tailoring & Designs](https://windrosstailoringanddesign.com) booking engine and extended into a full SaaS platform by [iCreate Solutions & Services](https://icreatesolutionsandservices.com).

---

## Features

- **Multi-tenant architecture** — shared PostgreSQL DB with `tenant_id` isolation on every table
- **JWT authentication + RBAC** — 4 roles: `customer`, `staff`, `tenant_admin`, `super_admin`
- **Subscription plans** — Starter / Pro / Enterprise with booking limits and feature flags
- **Tenant websites** — every tenant gets a mobile-first website (Home, About, Gallery, Book) built from an individually designed industry template
- **Website Builder** — layered page/section editor with a pixel-accurate desktop/tablet/phone live preview, draft autosave, undo/redo and one-click publish; background video, photo slideshows, galleries, fonts, colours and theme music
- **Media library** — uploads stored in Postgres with byte-range streaming (video seeking on iOS), automatic client-side image resizing/compression and size/aspect-ratio guidance
- **Tenant payment options** — PayPal, Fygaro, EasyPay, First Atlantic Commerce / PowerTranz, Lynk and bank transfer, pre-wired so a tenant only pastes their merchant link/handle
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

## Tenant Websites & Website Builder

| URL | What it is |
|---|---|
| `/:slug`, `/:slug/about`, `/:slug/gallery`, `/:slug/book` | A tenant's public website (published version) |
| `/admin/customize.html` | Website Builder (tenant admin) |
| `/demo/:template` | Live demo of any template, with simulated bookings |
| `/playground` | Public builder playground linked from the landing page (nothing saved) |

- The site document lives in `tenants.site_draft` (autosaved by the builder) and `tenants.site_config` (published, served by `GET /api/v1/public/tenant`).
- Template presets: `frontend/src/site/presets/*.js`. Section types, fields and the media size guide: `frontend/src/site/siteSchema.js`. The builder (`admin/js/siteBuilder.js`) receives that catalogue from the preview iframe over same-origin `postMessage`, so the forms always match what the site can render.
- Endpoints: `GET /tenants/:slug/site`, `PUT /tenants/:slug/site/draft`, `POST /tenants/:slug/site/publish`, `DELETE /tenants/:slug/site/draft`, `POST|GET /tenants/:slug/media`, `DELETE /tenants/:slug/media/:id`, and public `GET /media/:id`.

### Payment gateways

Defined in `server/services/paymentGateways.js`. *Link* gateways (PayPal, Fygaro, EasyPay, FAC/PowerTranz) send the customer to the tenant's hosted checkout with the amount and a `BK-XXXXXXXX` reference pre-filled; the booking stays `pending_payment` until the tenant verifies it. *Receipt* gateways (Lynk, bank transfer) require a screenshot and create `pending_manual_confirmation` bookings. Tenants configure everything in **Settings → Payment Gateways**, which includes step-by-step activation instructions.

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
| POST | `/payments/paypal/create-subscription` | Public | Begin verified tenant subscription checkout |
| POST | `/payments/paypal/approve` | Public | Verify PayPal subscription and queue provisioning |
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
| `BUSINESS_NOTIFICATION_EMAIL` | Default business inbox used for email CC and reply-to |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` | PayPal subscription API credentials |
| `PAYPAL_WEBHOOK_ID` | Required PayPal webhook signature identity |
| `PLATFORM_ADMIN_KEY` | Key to protect tenant provisioning routes |
| `NODE_ENV` | `development` or `production` |

---

## Deployment (Railway)

Production uses Railway's native GitHub integration: `Shamzbruv/ICSS-Booking-System`, branch `main`, service `ICSS-Booking-System`, environment `production`.

Push or merge changes into `main`; Railway automatically builds that commit and deploys it to https://icssbookings.com. Keep the source attached to the branch without a pinned commit so future pushes remain enabled. GitHub Actions validates the code and publishes the container image; its placeholder deployment job does not trigger Railway.

Verify each release in Railway's deployment history: the commit hash must match GitHub `main`, and the deployment must reach `SUCCESS`. Then check `/health` and the updated feature on the live site. If a GitHub push produces no Railway deployment, inspect or reconnect the service's GitHub source before retrying.

For a new environment, connect the repository, configure `DATABASE_URL` and the other variables from `.env.example`, and deploy. The server runs database migrations on startup.

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
| Payments | PayPal subscriptions, PayPal.Me, manual transfer |
| Containerization | Docker + docker-compose |
| CI/CD | GitHub Actions + GHCR |

---

## License

Private — © iCreate Solutions & Services. All rights reserved.
