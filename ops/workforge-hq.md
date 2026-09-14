# WorkForge HQ — initial implementation

WorkForge HQ manages the internal WorkForge business at `/hq`, using the existing
application and Supabase project. It is separate from Field customer workspaces.

## Included

- Staff workspace and membership-based access using the existing sign-in system.
- Sales pipeline: new inquiry, discovery, Blueprint, proposal, won, lost.
- Accounts with phone/email, lead source, owner, dated next action, scope, and notes.
- Agreed Blueprint, implementation/custom build, migration, and support fees.
- One-time payment recording, one-time outstanding balance, and monthly commitments.
- Atomic, repeat-safe won-to-implementation handoff and six onboarding tasks.
- Original scope preserved on the implementation, with launch gated by checklist completion.
- Assigned tasks, follow-ups, meetings, implementation dates, and an interactive calendar.
- Dashboard and audit activity based on saved records. No sample customer data is seeded.
- Optimistic concurrency checks for record updates and explicit loading failures.

The HQ workspace is identified by an intentionally reserved constant UUID shared
by code and schema. The database also constrains every HQ table to that workspace.
Customer membership does not grant HQ membership. Read-only members can read but
cannot write. New HQ functions use security invoker; anonymous RPC access is revoked.

## Activation order

1. Review and deploy the source change to the existing WorkForge Vercel project.
2. Apply `supabase/migrations/20260914043443_workforge_hq.sql` to the existing
   WorkForge database. Do not apply twice. No new paid project is required.
3. Confirm the five HQ tables have RLS and verify the authenticated owner flow.
4. Open `/hq`, or select WorkForge HQ from the existing workspace switcher.

The migration provisions Shawn's existing confirmed account as owner. It records
a member invitation for the previously authorized `neil@starrlimited.com` address;
the existing sign-in invitation claim process accepts it. It sends no email.

The migration has not been applied to the shared database during development.
This prevents HQ from appearing in the existing workspace menu before its route
is deployed. The customer product's default route and data remain compatible.

## Verification

- Production build succeeded on Next.js 16.3.4.
- TypeScript passed.
- All 31 Node tests passed, including three HQ commercial/dashboard tests.
- The exact HQ migration and `tests/hq-integration.sql` passed in an isolated
  PGlite 0.5.8 PostgreSQL engine. Production membership policy and audit function
  definitions were reused in the test bootstrap.
- Database tests cover owner writes, agreed-fee gating, repeat-safe handoff,
  six generated tasks, frozen scope, launch gating, read-only restrictions,
  outsider isolation, RLS presence, and anonymous RPC revocation.
- Local browser QA was blocked by `net::ERR_BLOCKED_BY_CLIENT` when the browser
  attempted to reach localhost. Signed-in browser verification remains required.

## Website intake mapping

The live Webflow site is `6aa5acbf7ae3bb9c0c7b7ec5` (WorkForge Systems). Four
consultation form families were inspected: Workflow Consultation, Jobber
Alternative, Custom CRM, and Business Automation. Webflow exposes separate form
IDs for the apex, www, and Webflow domains; integration must accept the correct
forms across those domains and deduplicate by submission ID.

| Webflow field | HQ destination |
| --- | --- |
| Company | company |
| Full Name | contact_name |
| Email | email |
| Phone | phone |
| Workflow Notes | initial requirements / scope |
| Lead Source | normalized source |
| UTM Source / Medium / Campaign / Content / Term | attribution to preserve when intake is added |
| Landing Page / Landing Variant | attribution to preserve when intake is added |

Automatic intake is not yet connected. Manual inquiry entry works in this release.
Before enabling Webflow delivery, add a verified webhook or authenticated API sync,
durable submission ID deduplication, the attribution fields, and an observed
submission-to-HQ acceptance test. Preserve Webflow's existing submissions and
Google Ads conversion behavior.

## Remaining connections

- Automatic Webflow intake and its end-to-end verification.
- SCL Executive summary feed.
- Accounting, invoice generation, payment charging, Google Calendar sync, and
  AI/hosting cost attribution are not connected in this initial release.
- Dedicated support tickets and product roadmap are later phases.

The connected Vercel app returned an empty project list and a 404 for the known
project. The canonical portal and GitHub Vercel deployment status were verified
separately. Use the existing Git integration for this change; do not create a
replacement hosting project to work around the connector discrepancy.
