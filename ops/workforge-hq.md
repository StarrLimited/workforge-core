# WorkForge HQ

WorkForge HQ manages the internal WorkForge business at `/hq`, using the existing
application and Supabase project. It is separate from Field customer workspaces.

The initial release is a sales and implementation foundation. It is not yet a
complete SaaS business operating system. The owner's September 14 feedback and
the proposed business model are recorded in `ops/workforge-hq-saas-design.md`.
HQ members now land in HQ after sign-in; product workspaces require an explicit
selection from their authorized workspaces.

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

HQ was deployed through PR #1 and its database migration applied on September 14,
2026. The existing owner membership and empty HQ workspace were verified after
activation. The live portal is https://workforge-development.vercel.app/hq.

## Verification

- Production build succeeded on Next.js 16.3.4.
- TypeScript passed.
- All 36 Node tests passed, including HQ commercial/dashboard, intake, and
  authentication-provider tests.
- The exact HQ migration and `tests/hq-integration.sql` passed in an isolated
  PGlite 0.5.8 PostgreSQL engine. Production membership policy and audit function
  definitions were reused in the test bootstrap.
- Database tests cover owner writes, agreed-fee gating, repeat-safe handoff,
  six generated tasks, frozen scope, launch gating, read-only restrictions,
  outsider isolation, RLS presence, and anonymous RPC revocation.
- Both database suites also passed against the deployed schema in rollback-only
  transactions. All fixture users and fixture receipts were confirmed absent.
- Local browser QA was blocked by `net::ERR_BLOCKED_BY_CLIENT` when the browser
  attempted to reach localhost. Production Google sign-in and authenticated HQ
  access were subsequently verified with the owner's account on September 14.
  See `ops/google-sign-in.md` for the activation and verification record.

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
| UTM Source / Medium / Campaign / Content / Term | receipt attribution and visible account notes |
| Landing Page / Landing Variant | receipt attribution and visible account notes |
| Business Type / Main Challenge / Team Size | receipt attribution and visible account notes |

The `hq-webflow-intake` Edge Function accepts the twelve observed consultation
form IDs across all three domains. Cookie consent and unrelated forms are ignored.
New leads are assigned to Shawn with a same-day follow-up in America/Denver.
Product remains undecided until discovery. Existing accounts are never overwritten.
Submission ID deduplication and account creation occur in one database transaction.
Transient failures return a non-200 response so Webflow can retry. Repeated
submissions with distinct Webflow IDs remain separate inquiries for staff review.

The webhook uses a dedicated random 256-bit key in its destination URL. Treat
that full URL as a credential; never commit it or include it in routine output.
Only its SHA-256 hash is stored in `private.hq_webhook_keys`. The Edge Function
uses its built-in server credential to call a service-role-only RPC, which verifies
the integration key before writes. Anonymous users and staff browser sessions
cannot call this RPC or read the key table. No service key is sent to Webflow.
This is custom integration-key authentication, not Webflow HMAC verification.

To activate: apply `20260914053812_workforge_hq_intake.sql`, provision a fresh
random key hash under the `webflow` name, deploy the function with its custom-auth
configuration, and create one `form_submission` webhook on the existing site.
Keep the raw key only in the Webflow webhook destination. To disable, set
`private.hq_webhook_keys.enabled=false`; to rotate, replace the hash and webhook URL.
The endpoint limits incoming bodies to 64 KiB and does not log request bodies,
secret URLs, credentials, or database error details.

Webflow remains the source record for submissions. Its existing form actions and
Google Ads conversion behavior are preserved. Recovery can replay the original
submission ID through the authenticated handler; duplicates are safe. Monitor
the Webflow webhook's last-triggered status, Supabase function failures, and
`hq_intake_receipts` for delivery. Existing website submissions were inspected
and consist of prior setup/test inquiries; they are not imported as real leads.

## Activation record — September 14, 2026

- PR #1 deployed HQ; PR #2 deployed the intake source. Both Vercel deployments
  reported success. Both HQ migrations are applied to the existing project.
- Edge Function `hq-webflow-intake` is active, version 1. Its integration key
  is enabled. Webflow hook `6aa78af30038252eb2317ebe` is registered for the site's
  `form_submission` events. No additional subscription was created.
- Live HTTP checks returned 401 for missing/incorrect keys, 200 for an
  authenticated ignored event, 200/created for a replay of an existing labeled
  Webflow setup test, and 200/duplicate when the same submission was replayed.
- The resulting database record preserved the source submission ID, form family,
  contact, campaign attribution, owner, new-inquiry stage and Denver follow-up
  date. The test account and receipt were then removed; audit history is retained.
- A fresh native website submission could not be completed in the cloud browser:
  Cloudflare Turnstile reported error 600010 and kept the submit button disabled.
  No anti-bot setting was changed. Actual Webflow webhook delivery from a fresh
  website submission remains unobserved; backend replay is not proof of that hop.

## Remaining connections

- Verify a fresh website submission through Webflow's registered webhook.
- SCL Executive summary feed.
- Accounting, invoice generation, payment charging, Google Calendar sync, and
  AI/hosting cost attribution are not connected in this initial release.
- Dedicated support tickets and product roadmap are later phases.

The connected Vercel app returned an empty project list and a 404 for the known
project. The canonical portal and GitHub Vercel deployment status were verified
separately. Use the existing Git integration for this change; do not create a
replacement hosting project to work around the connector discrepancy.
