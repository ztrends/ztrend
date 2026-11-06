# ZTrend — Product & Technical Specification

## 1. Product goal
Build a production-ready, single-company ecommerce platform for ZTrend, with a premium customer storefront and a separate Glassy V5 business administration experience. This is not a marketplace or a static mock store.

## 2. Experience and navigation

### Storefront desktop
- Brand mark at top-left.
- Category and collection navigation.
- Right-side Search, Wishlist, Cart and Profile actions.
- Premium luxury visual system, high-quality imagery, responsive product grids, accessible contrast and keyboard support.

### Storefront mobile
- Hamburger menu on left, centered logo, Wishlist on right.
- Fixed floating glass bottom bar: Home, Search, Cart, AI, Profile.
- Respect device safe areas; avoid covering checkout controls or content.

### Admin
- Glassmorphism V5: translucent surfaces, blur, restrained emerald/cyan highlights, rounded panels, readable charts and subtle motion.
- Dark and light themes.
- Desktop sidebar and mobile floating navigation.
- Dashboard overview: revenue, orders, product-level gross margin/net profit, stock alerts, recent orders and business insights.
- Distinguish actual database metrics from forecasts/AI estimates.

## 3. Storefront modules
- Homepage CMS: banners, collections, promotional sections and SEO metadata.
- Categories, subcategories, search, suggestions, filters and sorting.
- Product catalogue: SKU, descriptions, multiple images, variants, attributes, pricing, compare-at price, tax class, stock status and SEO fields.
- Product detail, image gallery/zoom, related products and recently viewed items.
- Cart, wishlist, coupon validation and checkout.
- Customer registration/login, profile, saved addresses and order history.
- Razorpay checkout, UPI via supported payment flow, COD eligibility/rules.
- Order confirmation, tracking and notifications.
- Reviews/ratings with moderation.
- Return, replacement and refund request lifecycle.
- Support tickets/contact and policy pages.
- English/Hindi localization for UI, transactional templates and editable content.

## 4. Admin modules
- Overview and analytics.
- Product, category, variant, attribute and media management.
- Inventory ledger, stock movement, adjustments, low-stock thresholds and alerts.
- Suppliers, purchase orders, goods received, purchase invoices and purchase returns.
- Orders, fulfilment, shipment, cancellation, returns, replacements and refunds.
- Shiprocket API integration and manual shipment entry; store AWB, label, tracking events and courier charges.
- Accounts: sales, expenses, payment fees, supplier balances, refunds, ledger and reconciliation.
- GST: configurable tax rates, invoice/credit-note records and reports. Tax calculations must be reviewed against applicable business rules before production use.
- Profit: calculate per order/product using recorded cost basis, discounts, refunds, shipping, payment fees, taxes and allocated expenses; show the formula and source transactions.
- Marketing: coupons, promotions, campaigns and abandoned-cart workflows.
- Social media integration framework with per-provider adapters, OAuth/token storage and permission scopes. Actual publishing/analytics depend on provider API access and approval.
- Customer CRM, support tickets and communication history.
- Reports: sales, product performance, inventory valuation, purchase, GST and profit/loss; CSV/XLSX/PDF exports as appropriate.
- Website CMS, navigation, banners, policies and SEO.
- Settings, staff accounts, roles, permissions, audit trail and integration settings.
- Backup/restore operations with documented retention, encryption and restore verification.

## 5. AI architecture
### Customer assistant
- Product discovery and recommendation based on published catalog, available stock, public price and customer-visible policy content.
- Help with cart, checkout guidance and order status after secure customer verification.
- Never expose supplier data, cost price, internal notes, other customers' data, admin reports or private business information.

### Admin assistant
- Role-aware access to authorized business metrics and records.
- Summaries and explanations for sales, stock, orders and finance.
- Any write action (refund, price change, stock adjustment, campaign launch, etc.) requires explicit confirmation and permission checks; high-risk actions should require a second confirmation.

### Knowledge and extensibility
- Admin-managed instructions, FAQs, policies and uploaded reference documents.
- Versioning, source attribution, review/publish workflow and rollback.
- Tool registry/adapter interface so new AI providers and business tools can be added without rewriting the assistant.
- Per-tool permissions, input validation, audit logs, timeouts and safe failure handling.
- Secrets stored server-side only.

## 6. Integrations
- Razorpay: server-created orders, signature verification, webhook idempotency, refunds and reconciliation.
- Shiprocket: credentials, serviceability/rates where available, shipment creation, AWB/label, tracking and cancellation where supported.
- Notifications: provider adapter for email, SMS and WhatsApp templates, opt-in/consent, delivery status and retry queue.
- Social platforms: official APIs only; scope depends on platform permissions and account approval.
- AI providers: configurable provider/model adapter with server-side keys.

## 7. Security and reliability
- Secure password hashing, session lifecycle, optional MFA and account recovery.
- Role-based access control enforced on the server for every API endpoint.
- Customer data isolation and ownership checks.
- Input validation, output encoding, CSRF protections where relevant, rate limits and secure upload validation.
- Payment webhook signature verification and idempotent order processing.
- Audit records for staff actions and sensitive changes.
- Encrypted secrets, HTTPS, database backups, restore drills, structured logs and monitoring.
- No secrets or real customer/payment data in Git.
- Production must not ship with fake orders, fake revenue, placeholder success states or sample customer records.

## 8. Data integrity and workflows
- Inventory changes must be transactional and protected against overselling.
- Order status changes must follow explicit state transitions.
- Payment status comes from verified provider callbacks/reconciliation, not client-side claims.
- Returns/refunds must link to original order/payment and update stock/ledger correctly.
- Financial reports must be reproducible from immutable source transactions and adjustments.
- Every integration should support retries and idempotency where applicable.

## 9. Deployment
- GitHub stores source and CI workflows.
- Static frontend hosting, API hosting, managed relational database and object storage are separate deployment concerns.
- Configure environment-specific secrets and database migrations.
- Add automated lint, type checks, unit/integration tests and deployment health checks.
- Configure custom domain later if desired; it is not a prerequisite for development.

## 10. Acceptance criteria
- Storefront and admin use the same live API/database.
- Product create/update/image upload is reflected on the storefront.
- Checkout creates a persistent order; stock is reserved/adjusted safely.
- Payment is confirmed only after verified gateway response/webhook.
- Shipping label/tracking data is saved and visible to customer/admin.
- Returns/refunds and accounting entries reconcile to source orders.
- Product-level profit can be traced to cost and transaction inputs.
- Customer AI cannot access private admin information; admin AI respects staff permissions.
- Hindi/English switching works across core customer flows.
- Backup can be restored in a tested environment.
- Mobile navigation and all core workflows are usable on phone-sized screens.
- No production-facing module is represented as complete until its integration and tests pass.
