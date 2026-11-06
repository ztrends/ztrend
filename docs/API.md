# ZTrend API (initial backend milestone)

Base URL: `/api`

## Health
- `GET /health` — API and PostgreSQL health.

## Authentication
- `POST /auth/register` — `{ name, email, password }` (password minimum 10 characters).
- `POST /auth/login` — `{ email, password }`.
- `GET /auth/me` — authenticated current user.

Successful login/register returns `{ user, token }`. Send subsequent requests with `Authorization: Bearer <token>`.

## Catalogue
- `GET /products?search=&page=1&limit=24` — active products only.
- `GET /categories` — categories.
- `GET /products/admin/all` — staff inventory list.
- `POST /products` — staff product creation.
- `PATCH /products/:id` — staff product update.
- `POST /categories` — founder/admin category creation.

Product body fields: `name, slug, description, sku, price, compareAtPrice, costPrice, stock, status, imageUrl`.

## Orders
- `POST /orders` — authenticated checkout. Body: `{ items:[{productId,quantity}], paymentMethod, shippingAddress, notes? }`.
- `GET /orders/mine` — signed-in customer's orders.
- `GET /orders` — staff order list.
- `PATCH /orders/:id/status` — staff status update.

Checkout currently records a pending order and atomically decrements stock. Payment provider confirmation, refunds, cancellation restocking and shipping-label workflows are not yet implemented; do not enable live payment collection until those workflows are completed and tested.

## Admin
- `GET /admin/summary` — protected dashboard metrics, low-stock list and recent orders.

## Roles
- `FOUNDER`, `ADMIN`, `INVENTORY_MANAGER`, `ORDER_MANAGER`, `ACCOUNTANT`, `CUSTOMER`.
- Every staff endpoint enforces role checks server-side. UI hiding is not a security boundary.

## Local setup
1. Install Node.js 20+ and PostgreSQL.
2. Copy `backend/.env.example` to `backend/.env` and configure `DATABASE_URL` and a random `JWT_SECRET` (32+ characters).
3. From repository root run `npm install`.
4. Run `npm run db:init`.
5. Run `npm run dev`; API listens on port 4000.
6. Set `FOUNDER_EMAIL` and a strong `FOUNDER_PASSWORD` only for initial bootstrap. Remove those values after founder creation.

Production PostgreSQL must support TLS. Configure secrets in the hosting provider, never commit real credentials.
