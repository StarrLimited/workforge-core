# WorkForge Core / Field 0.2

Initial development foundation and Field demonstration for WorkForge Systems Limited. Built for dedicated customer environments. This is a development release, not a launch-ready commercial platform.

## Release status

The 0.2 source builds and passes the automated and database checks. GitHub source publication is enabled. Deployment remains blocked by the Vercel connection returning permission errors and an empty project list. The hosted application remains 0.1. Follow [the release handoff](ops/release-0.2.md) to publish and activate the staged workflow. Signed-in browser verification remains pending.

## Field expansion

Field 0.2 adds detailed customer/opportunity records, consultation capture, a service pricebook, itemized estimates and printable proposals, production readiness, supplier/subcontract commitments, and a manual job financial ledger. See [the FRX comparison and remaining scope](ops/field-expansion.md).

## Implemented

- Server-verified Supabase sessions and explicit workspace memberships; invitation claiming requires a verified email. No hard-coded owner bypass.
- Core workspaces, contacts, tasks, partners, files and audit history.
- Field workflow: lead → consultation → versioned estimate → simulated demo approval → crew/date assignment → production → completion → invoice preparation.
- Atomic workflow transitions, immutable accepted estimates, required completion tasks, and unique invoice handoffs.
- Margin-based pricing in integer cents, protected estimate revisions, job and invoice-handoff CSV exports.
- Interactive calendar items, job detail dialogs, purchasing status, private file/photo upload and expiring downloads.
- Five accelerator profiles, with Field implemented first. Build, Supply, Federal and Executive are explicitly marked planned.

## Local development

Use Node 22.13 or newer. Copy `.env.example` to `.env.local`, fill the public Supabase URL and publishable key, then:

```sh
npm ci
npm run dev
```

Set `NEXT_PUBLIC_APP_URL` to the deployment origin when an application has a fixed hostname. Otherwise callback redirects use the actual request origin. Enable `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` only after the dedicated Supabase project has a working Google OAuth provider.

## Database and access bootstrap

Apply migrations in `supabase/migrations` in order. They match the development project's remote migration history. `supabase/seed.sql` adds only a fictional Field demonstration, without a user or owner default. Its guard makes the seed repeatable.

An administrator can bootstrap a specific owner by inserting a scoped record into `private.workspace_invitations`, using the desired workspace ID, lowercase email and role. The user must authenticate and verify that same email before the server can claim the invitation. Invitations expire after 30 days and do not send email. Membership revocation immediately denies database access.

The storage bucket is private. Uploads allow JPEG, PNG, WebP and PDF up to 3 MB. Object paths contain workspace and job identifiers, and access checks both membership and the linked job. Downloads expire after 60 seconds. User-facing file deletion is not part of this release.

## Authentication setup before use

In the dedicated Supabase project, configure Authentication → URL Configuration:

The confirmed development application is `https://workforge-development.vercel.app`. For this deployment, use that address as Site URL and allow `https://workforge-development.vercel.app/auth/callback` in [the dedicated project's URL configuration](https://supabase.com/dashboard/project/vtjwkyukmddvlsdejeyd/auth/url-configuration).

1. Set Site URL to the application's deployment origin.
2. Add that origin's `/auth/callback` to the redirect allowlist.
3. For email codes as an alternative to links, include the provider's token placeholder in the email template. The default link flow needs only the URL configuration above.
4. For Google, configure a dedicated Google OAuth client and add the Supabase project's callback URL in Google, then enable the Google provider in Supabase and the UI flag in this application's environment.

No existing SCL authentication credentials should be copied into the Core repository.

The optional `supabase/field-demo-seed.sql` adds illustrative catalog entries only to an empty catalog in the fictional Juniper workspace. These are demonstration costs, not market pricing.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

`tests/field-integration.sql` adds itemized pricing, snapshot/revision retention, stale saves, customer reuse, purchasing/crew gates, walkthrough and ledger controls.

`tests/database-integration.sql` verifies workspace isolation, read-only access, revocation, direct-stage-write denial, consultation prerequisites, margin pricing, revisions, approval locks, scheduling, required completion tasks and idempotent invoice preparation. Run it only against a development database as an administrator. Its test users and records are rolled back; identity sequences may advance.

## Current limits and remaining launch work

- Approval is explicitly simulated in demo workspaces. Real customer e-signature and proposal delivery are not connected.
- Invoices are prepared for CSV handoff, with no Xero/API transmission, customer emails or payment collection.
- Google Calendar, operational email/SMS and external accounting connectors are not connected.
- Team invitations and membership administration currently require an administrator database operation. Self-service owner administration is a later module.
- Query results are capped at 1,000 records per collection and 100 recent audit events in the first demonstration. Pagination and large-customer import/export are required before production scale.
- Change orders and production estimate amendments are not implemented; accepted estimates remain locked.
- Backup/restore validation, dev/staging/production separation, monitoring, operator runbooks, a technical escalation owner and remaining commercial launch requirements remain open.

## Ownership and separation

Development infrastructure initially belongs to the Starr Company Limited accounts, with dedicated WorkForge resources. Core source contains no live operating-company data or runtime dependency on their databases. Track deployment-specific values separately, and move repositories, application projects, database/storage/auth configuration and integration ownership into WorkForge accounts before commercial launch.
