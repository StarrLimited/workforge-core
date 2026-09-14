# Field OS packages — HQ 0.7

Shawn approved incorporating the package model from the pricing discussion into WorkForge HQ on September 14, 2026.

## Commercial catalog

- Field Foundation: $2,950 one time.
- Field Operations: $5,950 one time, recommended for established teams.
- Field Scale: $9,950 one time.
- WorkForge Blueprint: $500, included/credited toward a selected implementation package.
- WorkForge Managed: $149/month, no additional setup with implementation.
- Automation Essentials: $99/month and $495 setup; five automations / 1,000 monthly runs.
- Automation Plus: $199/month and $995 setup; 12 automations / 5,000 monthly runs.
- AI Assistant: $99/month and $495 setup; three defined drafting/summarization functions.
- AI Operations: $249/month and $1,495 setup; Assistant plus two scoped operations functions.
- Continuous Improvement: $249/month; two hours with no rollover or setup fee.

The versioned approved scope is in `lib/hq-catalog.ts`. Standard rates and customer descriptions are stored in the existing HQ pricebook; estimates use the currently loaded pricebook values and preserve their own snapshots. The seed updates only previously unpriced matching entries, preserving any later administrator pricing and all saved proposals. Other custom services retain their existing scope-based pricing.

## User flow

Open HQ → Sales & delivery → Packages & pricing. Select an existing customer and an implementation/change engagement, then choose a package. The estimate editor also offers the package builder directly.

Choose optional monthly services and apply the package. Setup and monthly fees are separate lines. The builder fills included scope, exclusions, responsibilities, timeline, payment schedule, recurring terms and support allowances. Existing seller/customer identity, objective and legal fields are retained. Applying to an edited draft asks before replacing fee lines and standard scope. Agreement review is reset after application.

Discovery findings, customer-specific deliverables and acceptance tests, actual dates, tax treatment, rights and legal terms still need review before issue. Selecting a package does not assert that discovery is complete, sign a document, activate a subscription, send email or record payment.

The payment default is 50% of one-time fees before tax, with a 30% testing milestone and the remaining 20% at acceptance. Previously separately purchased Blueprint credit must be applied to the implementation line and reconciled with the prior agreement/payment; no automatic payment receipt is created.

## Pricing rules

Both proposal validation and the database enforce one implementation package, no duplicate catalog lines, no stacking of lower/higher automation or AI plans, required Managed service and setup fees, and no additional Blueprint line on top of a package. Catalog billing cadence, category and quantity remain fixed; unit prices and negotiated discounts remain editable. Custom noncatalog lines are supported.

Catalog identity is retained in proposal line snapshots. Existing issued/accepted proposals are governed by the original immutable-agreement checks. Acceptance still creates one implementation and separate fixed/recurring fee records; subscription activation remains a separate action.

## Verification

- 64 Node tests passed, including package totals, no-monthly option, required setup/Managed, mutually exclusive plans, current rates, inactive/unpriced entries and proposal validation.
- TypeScript and optimized Next.js production build passed.
- All six isolated PostgreSQL suites passed, including the package migration and rollback-only acceptance/fee-handoff checks.
- The exact package migration and package integration suite passed together in a rollback-only transaction against the existing WorkForge project.
- PR #9 merged as `2edf7d218fd21a36c0609ae72c40d4ca85e992da`; Vercel reported success and the canonical version endpoint returned HQ 0.7.0. The deployed tree matches the locally tested tree.
- The live catalog showed all three package prices and six monthly services. Browser verification selected Operations + Automation Essentials + AI Assistant, applied the package, preserved a previously entered objective, saved and reopened the draft, and verified $6,940 one time, $347/month and $3,470 initial payment. All six fee lines and full scope appeared in the agreement preview.
- No application errors were observed in the agreement preview; an unrelated browser-extension metadata error was excluded. The temporary draft and engagement were removed with exact identity/status guards; the existing WORKFLOW TESTING customer and original proposal were preserved. No email, signatures, subscription activation or customer charge occurred.
- The deployed package integration suite passed again in a rollback-only transaction. Existing private-table/password advisories were unchanged; no new findings concerned the package objects.

No new hosting project, paid service or customer-facing publication outside HQ is required.
