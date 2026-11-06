# ZTrend Commerce Platform

Premium single-brand ecommerce platform for ZTrend.

## Current repository status
The first design-preview milestone is committed:
- `index.html`: responsive premium storefront preview and Glassy V5 admin dashboard preview.
- Use the floating preview switcher to move between Store Preview and Admin Preview.
- This is a visual design prototype only. The displayed products, metrics, charts and orders are illustrative and are not connected to a backend.

## Confirmed product requirements
- Single-brand/company store: ZTrend; product catalogue supports all product categories.
- Premium luxury storefront, English + Hindi.
- Desktop header: logo, categories/navigation, Search, Wishlist, Cart, Profile.
- Mobile header: hamburger menu left, centered logo, Wishlist right.
- Mobile fixed glass navigation: Home, Search, Cart, AI, Profile.
- Glassy V5 admin, dark and light themes, responsive desktop/mobile navigation.
- Razorpay + UPI + COD; Shiprocket + manual shipping.
- Products, variants, image gallery, inventory, purchase/suppliers, orders/shipping, returns/replacements/refunds, accounts/GST, marketing/coupons, social media, reports/analytics, customers/CRM, CMS/settings.
- Customer AI and Admin AI, plus configurable AI knowledge and extensible tools/integrations.
- Product-level actual profit and complete accounting calculations.
- Automatic stock alerts, customer support, email/SMS/WhatsApp notifications.
- Backups, restore, audit logs, role-based access control.

## Production principles
- No production demo data or fake success states.
- Shared backend and database for storefront and admin.
- Server-side authorization for every protected operation.
- Payment and shipping integrations must be verified with provider credentials and webhooks before being described as live.
- AI customer access must be isolated from private admin, supplier, cost-price and financial data.
- Secrets belong in deployment environment variables, never in source control.
- GitHub Pages can serve the static frontend, but cannot run the API, database, scheduled jobs or secure secrets. Production deployment will use a separately hosted backend, database and object storage.

## Next milestones
1. Approve the visual preview and refine branding/product category-specific imagery.
2. Establish production application architecture and database schema.
3. Build authentication, authorization, catalog, inventory, checkout and order workflows.
4. Implement finance, GST, returns, purchase, notifications and reports.
5. Add provider integrations and AI tool/knowledge management.
6. Add tests, security checks, backup/restore verification and deployment configuration.

See [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) for the detailed implementation blueprint.
