# WorkForge HQ administration and lead connections

## Staff access

Owners and administrators can open **User administration** from the HQ sidebar.
Add the exact email the teammate will use to sign in. An existing verified user
gets HQ membership immediately; otherwise access is reserved for 30 days and is
claimed after verified Google/email sign-in. Adding access sends no email. Copy
and share the normal HQ link with the teammate. Pending access can be revoked.

Roles are Administrator, Member, and Read only. Only the owner can appoint or
change administrators. The owner and the current user's own account are protected.
Deactivation is checked on every HQ data request, including existing sessions.
This panel manages HQ only; it does not grant Field OS demo or customer access.

## Leads

Native Google Ads and Meta connectors remain under **Lead connections**. The
WorkForge Meta Page and two verified form IDs are prefilled. Native connections
need provider credentials and provider-side callback configuration before they
receive leads. Configured is not the same as verified receiving.

An optional **Connect through GoHighLevel** panel is available per source. It uses
GHL's outbound Webhook action with POST and the displayed `transport=relay` URL.
The generated key is shown once and stored only as a hash in a private table.
GHL can send it as `x-workforge-key` or custom data `workforge_key`; do not put
keys in URL query strings. Restrict each workflow to the WorkForge source/form.

Required fields: `form_id`, `contact_id` (unless original `lead_id` is provided),
`page_id` for Meta, and at least email or phone. Standard GHL `full_name`, `email`,
`phone`, and `company_name` fields map automatically. Both flat custom data and
`customData` objects are accepted. Optional fields: original `submitted_at` with
timezone, `lead_id`, `campaign_id`, `campaign_name`, `ad_id`, `ad_name`, `gclid`,
`fbclid`, and an `answers` object containing string values. Use actual GHL field
picker values, including the exact source form ID; don't guess provider IDs.

Set `is_test=true` for the provider test, check the HQ delivery receipt, then remove
the flag and publish the GHL workflow. Native Meta dummy test contacts and Google
provider tests also produce only test receipts. No outreach is sent by intake.

Native and relay deliveries share receipts. Original provider lead IDs deduplicate
exactly. Without a provider ID, the GHL relay uses contact ID plus form ID (one
inquiry per contact/form). An exact original timestamp, form, and matching email
or phone also links a provider delivery to a prior backfill, without resetting
the existing sales status. Distinct submissions at different times remain separate.
Database failures return 503 for retries. Invalid credentials and foreign forms
are rejected. Failed native Meta fetches retain IDs for HQ's existing retry action.

The relay is a receiver, not a polling job: GHL must publish the workflow. Native
Meta setup requires a Page token and app secret, neither available through the
advertising connector. Never claim continuous sync until a provider test succeeds.

## Verification

`npm run typecheck`, `npm test`, `npm run build`.

Isolated PostgreSQL integration suite:
`PGLITE_MODULE=/tmp/workforge-test-tools/node_modules/@electric-sql/pglite/dist/index.js node tests/hq-db-runner.mjs`

This exercises invitation claims/revocation, active-membership checks, owner and
administrator protection, private key isolation, duplicate deliveries, test-only
receipts, invalid form rejection, and the existing sales/lifecycle gates.

Official provider references:
- https://developers.google.com/google-ads/webhook/docs/implementation
- https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/
- https://help.gohighlevel.com/support/solutions/articles/155000003299-actions-webhook

## Form responses (HQ 0.8.1)

Each HQ inquiry and its Sales & delivery discovery view now has **Form responses**.
Responses load by account under the existing HQ membership/RLS rules, separate
from salesperson notes. Each submission retains its source, form, submitted time,
questions, answers and available campaign/ad names. The standalone CRM demo is
unaffected. Refresh retrieves the latest saved submission snapshots.

The GHL receiver now captures its standard root-level contact custom fields,
`custom_fields`/`customFields` objects or arrays, and explicit `answers` objects
or JSON strings. Arrays, numbers and booleans are accepted. It excludes contact
routing, workflow/location objects and credential fields. Empty or unresolved
merge values do not override a populated answer. The existing WorkForge source,
Page/form allowlists, key verification and provider-test isolation remain in force.

Replaying a received provider ID fills missing answers while preserving populated
answers, the original timestamp, linked account, notes, ownership, sales stage and
follow-up date. It does not create another account. Website intake saves every
submitted question; older receipts retain their existing qualification fields.
Google native intake already captured all question columns and now displays them.

Verification: typecheck, 80 unit tests, production build and isolated HQ database
integration tests, including replay enrichment and no-duplicate/no-overwrite checks.
