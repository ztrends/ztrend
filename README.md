# NEXORA COMMERCE ERP

A production-oriented monorepo scaffold for exactly three experiences:
1. Founder Control Center (`/founder/*`)
2. One unified Admin ERP (`/admin/*`)
3. Customer Store (`/shop/*`)

**Important:** this is a functional foundation, not a claim that every enterprise feature is production-ready. Payment gateway, email/SMS delivery, production hosting, and live credentials require configuration. GitHub Pages hosts only the frontend; the API and PostgreSQL database must be deployed separately.

## Stack
- Frontend: React + TypeScript + Vite + React Router
- API: Node.js + Express + TypeScript
- Database: PostgreSQL, SQL schema and seed script
- Auth: bcrypt password hashing, signed JWT in HttpOnly cookie, server-side permission checks
- Tests: Vitest (frontend), Node test runner / Supertest API tests

## Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm

## Setup
1. Copy `.env.example` to `backend/.env` and set strong unique secrets. For local frontend overrides, copy `frontend/.env.example` to `frontend/.env.local`.
2. Create a PostgreSQL database and apply schema:
   ```sh
   psql "$DATABASE_URL" -f backend/db/schema.sql
   ```
3. Install dependencies:
   ```sh
   npm install
   ```
4. Create the first Founder safely:
   ```sh
   npm run founder:create --workspace backend -- --name "Founder Name" --email "founder@example.com"
   ```
   The command prompts for the password; it is not stored in source.
5. Start API and frontend:
   ```sh
   npm run dev
   ```
   Frontend: http://localhost:5173; API: http://localhost:4000/api/health

## Initial Founder setup
The setup command creates a Founder identity only when no Founder exists. It hashes the password using bcrypt. Do not expose the setup endpoint publicly.

## Environment
See `.env.example`. Never commit real `.env` files, database passwords, JWT secrets, or payment keys.

## Implemented foundation
- Separate Founder/Admin/customer login experiences and protected route boundaries
- Server-side authentication and permission middleware
- Founder admin account and permission assignment APIs
- Unified permission-filtered Admin navigation
- Product list/create, stock movement ledger, purchase receiving, POS sale transaction, online order creation
- Database constraints and transactional stock/sale updates
- Basic storefront, cart, customer registration/login, order history endpoint
- Audit events for critical actions
- API tests and a manual acceptance checklist

## Not yet production-complete
- Real payment provider integration (only unpaid/COD/manual-payment statuses; never pretends to charge a card/UPI)
- Email/SMS password reset delivery
- GST/accounting compliance validation by a qualified professional
- Shipping carrier integration, image storage/CDN, automated backups, monitoring and deployment secrets
- Comprehensive coverage for every module/action listed in the brief
- Full end-to-end browser test execution against a configured deployed environment

## Deployment
- Frontend: set `VITE_API_BASE_URL` and `VITE_BASE_PATH`; build with `npm run build --workspace frontend`. Configure GitHub Pages workflow.
- Backend: deploy `backend` to a Node hosting provider with HTTPS and environment variables.
- Database: managed PostgreSQL with backups, restricted network access and least-privilege credentials.
- Configure `CORS_ORIGIN` to the exact frontend origin with no trailing slash (for example `https://YOURNAME.github.io`). Use HTTPS in production.
- Set the GitHub repository variable `VITE_API_BASE_URL` to the deployed backend API base URL, including `/api` (for example `https://api.example.com/api`). Never point the deployed site at `localhost`.
- If frontend and API are cross-site, set backend `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true`; both must use HTTPS. Some browsers block third-party cookies regardless, so same-site hosting/custom-domain reverse proxy is the most reliable production setup.
- The GitHub Pages workflow deploys only the frontend. Login and data features remain unavailable until the API and database are deployed and configured.

## QA
Run:
```sh
npm test
npm run build
```
The provided tests cover representative authentication/permission and inventory invariants. Do not report the entire acceptance suite as passed unless it has been run against a configured environment.
