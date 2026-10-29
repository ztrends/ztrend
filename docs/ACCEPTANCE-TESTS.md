# Acceptance and QA checklist

Status is **NOT RUN** until performed against a configured database/backend. Automated checks do not prove every scenario in the original master prompt.

| Test | Expected result | Current implementation |
|---|---|---|
| Founder sign-in | Only Founder identity enters `/founder/*` | Server verifies identity type; manual DB test required |
| Admin blocked from Founder | Direct URL/API rejected | Route guard + backend identity guard |
| Customer blocked from internal ERP | Direct URL/API rejected | Route guard + backend identity guard |
| Two admins, different permissions | Same panel, different permitted APIs | Permission join/middleware; configure two accounts to verify |
| Finance permission denied | API returns 403 | Permission middleware present; add finance endpoint to verify |
| View-only inventory cannot receive | API returns 403 | `inventory:receive` checked server-side |
| Discount permission | Unauthorized discounts rejected | `pos:discount` checked server-side |
| Founder creates admin | New admin receives only assigned permissions | Implemented |
| Founder revokes admin | Login/session invalid after deactivation | `active` checked on every authenticated request |
| POS stock and invoice consistency | Sale, items, stock ledger commit together | Transaction + row locks |
| Partial purchase receiving | Stock only increases for received quantity | Purchase receiving workflow not yet exposed in UI/API |
| Online order server pricing/stock | Server revalidates stock and price | Implemented basic COD/manual order endpoint |
| Store mobile/desktop | Responsive layouts | CSS responsive rules; manual device QA needed |
| No broken buttons/routes | Every control has a defined action | Main foundation controls implemented; full browser QA needed |
| Build/deploy | Build succeeds and Pages deploys | Must run in configured environment |

## Known gaps before production
- Purchase order creation/approval/partial receiving API and UI
- Full role/permission builder UI and data-scope enforcement
- Expense/accounting workflows and complete reports
- Real refunds, shipping, coupon/tax configuration, email reset delivery
- Real payment gateway
- Full E2E suite across all 15 original acceptance scenarios
