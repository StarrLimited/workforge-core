# HQ lead connections and customer lifecycle

## Scope

HQ now has direct Google Ads and Meta lead-form connectors, support handoffs,
support tickets, subscription records and visible renewal/customer follow-ups.
The existing Webflow intake remains in place for ads that send visitors to the
website. No new paid platform is required. Field OS demo access stays available
through the HQ sidebar.

## Lead connections

In HQ → Lead connections, an owner/administrator can configure a provider.
The callback is `https://vtjwkyukmddvlsdejeyd.supabase.co/functions/v1/hq-ad-intake`
with `?provider=google_ads` or `?provider=meta`.

- **Google Ads:** add the exact allowed form IDs, save, copy the one-time key,
  then enter the URL and key in each Google Ads lead form's delivery settings.
  Include an email or phone question. Send the provider's test after saving.
- **Meta:** add the WorkForge Page and form IDs, an app secret, a Page token
  authorized for leads retrieval, and the Graph API version configured for that
  app. Save and copy the verification token. Configure the Page webhook callback,
  subscribe to `leadgen`, and subscribe the WorkForge Page to the app. Verify
  actual lead access and any required app review/permissions in Meta before launch.
  Meta's testing tool can create a CRM inquiry; use clearly labeled test contacts
  and remove only those fixtures after verification.
- Enabling/replacing a connection rotates its verification key and resets the
  success indicators. Replace the provider's key immediately. Disabling stops intake.
- Credentials are stored only in an unexposed private table. Staff readers cannot
  retrieve them. Only the server role reads the config; the owner-only configuration
  helper checks actual active membership. No secret is written to the receipt or audit.
- Google checks a SHA-256 key hash; Meta verifies HMAC-SHA256 on the raw body before
  saving or fetching. Page/form allowlists prevent other businesses entering HQ.
- Provider lead IDs deduplicate repeated deliveries atomically. Distinct submissions
  from the same person remain distinct inquiries for staff review; this is not
  automatic contact/company merging.
- Meta first saves the incoming ID, then fetches the contact. Failed retrievals remain
  visible in HQ with **Retry delivery**. The provider receives a retryable error.
  Google storage failures return 503 so Google can retry. Invalid requests return 4xx.
- Google `is_test` payloads are recorded as tests without creating an account.
  Unknown answer fields are retained, credentials are stripped, and int64 IDs are
  preserved without JavaScript rounding. Meta source IDs and Google click IDs are
  recorded when supplied by their respective APIs.
- Status reflects configured, provider-test received, or live lead received. Enabled
  alone never displays as a verified live connection.

References: [Google webhook implementation](https://developers.google.com/google-ads/webhook/docs/implementation),
[Meta lead retrieval](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/),
[Meta webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/).

## Operating workflow

| Stage | Required action / behavior |
| --- | --- |
| Intake | Contact, source, answers and campaign IDs enter HQ; owner and follow-up date assigned. |
| Sales | Record requirements, discovery/demo, next action and agreed fees. Won requires scope and an agreed fee. |
| Implementation | Won creates exactly one implementation and six linked checklist tasks. Set launch date, owner and blockers. |
| Launch | Complete checklist, clear blockers and record support owner, terms and review date. Original sold scope remains preserved. |
| Support handoff | Launch stamps the handoff and creates one post-launch customer check-in, with the same linked customer. |
| Subscription | Record actual plan, start, renewal, cadence, amount and payment status. Activation is a separate staff action. |
| Ongoing support | Record a ticket, owner, priority, response deadline and investigation. Resolution notes required to close. Reopening clears resolved timestamp. |
| Retention | Dashboard shows overdue responses, urgent issues, due reviews, delayed projects and renewals within 30 days. |

The support mailbox, customer self-service portal, automatic billing, provisioning,
calendar sync, external notifications and product roadmap are not connected by this
release. Staff capture calls/emails as tickets. Fee/payment records are manual.
Subscription activation does not charge a customer. MRR reflects current internal
subscription records, excluding pending/trial/paused/cancelled/future/ended records.
For a plan change, end the previous record and add the replacement; historical
MRR movement reporting is not implemented.

## Verification

- `npm test`: 48 application tests passed, including provider authentication,
  Google tests, int64 IDs, Meta failure recovery, and MRR exclusions.
- `npm run build`: production build and TypeScript passed.
- `tests/hq-db-runner.mjs`: isolated PostgreSQL tests pass the complete Google and
  Meta intake → sale → project → launch → support/subscription sequence, duplicate
  delivery, launch gates, read-only roles, outsider isolation and secret protection.
- Fixtures use `.invalid` addresses; database test transactions roll back.
- Provider setup and live signed-in verification are tracked in the release follow-up.
