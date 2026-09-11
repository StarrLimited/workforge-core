# WorkForge Field 0.2 verification — September 11, 2026

## Verified

- The dedicated WorkForge Supabase project remains isolated from the operating-company databases.
- Five migrations applied successfully, with matching versions in source. The Field expansion is additive; a release gate preserves the existing workspace completion behavior until the 0.2 application is deployed.
- The original five fictional work orders and three estimates remain. Six illustrative catalog items were added only to the fictional workspace's empty pricebook.
- Eleven Node tests passed, covering margin, cent conversion, fractional quantities, taxable lines, discounts, deposits, invalid inputs, missing costs, commitments and voided records.
- TypeScript validation and optimized Next.js production build passed, including the new saved-proposal route and release-version endpoint.
- Both database integration suites passed before and after applying the expansion, and again after the compatibility gate. Test data was rolled back. The existing Juniper workspace remains on workflow version 1; newly provisioned workspaces default to version 2.
- Database checks cover workspace isolation, reader/revoked access, protected stages, consultations, estimates/revisions, immutable approvals, scheduling, tasks, walkthrough, idempotent invoice handoff, customer reuse, lost opportunities, stale saves, foreign catalog references, frozen customer/property snapshots, purchasing before deposit collection, partner holds, duplicate financial references and expense-review invalidation.
- GitHub repository `StarrLimited/workforge-core` is now accessible for writes after adding the app installation to the personal account. Initial README commit succeeded; this release publishes the complete source.

## Verification limits

- Full signed-in browser interaction, including visual QA of the new screens, private upload/download and printing, remains to be completed with a user session. Build/database success is not represented as completed browser verification.
- Vercel's connected project read endpoint continues to return 404 for the confirmed working project. Both production and preview deployment attempts for 0.2 returned HTTP 403 permission errors. No new deployment was created; the live application remains 0.1. See `release-0.2.md` and `resource-register.json`.
- Security advisor found no database/RLS issues. It reported one provider setting: [leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This app currently exposes email-link login, not password entry. Review the setting before adding password authentication.

## Remaining product work

See `field-expansion.md` for the implemented FRX-style scope and subsequent layers. Actual customer e-signature, message delivery, automatic intake, accounting integration, large-workspace pagination and launch hardening remain open.
