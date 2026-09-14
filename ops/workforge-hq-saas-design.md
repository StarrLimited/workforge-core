# WorkForge HQ: SaaS business design

Status: proposed redesign based on the owner's September 14, 2026 feedback.
This describes the required product direction; these modules are not all built.

## Purpose

Run WorkForge as a software business with recurring subscriptions, paid setup,
custom implementation, migration, and ongoing customer support. Its internal
operating record should follow a customer from inquiry through sale, onboarding,
active use, renewal, expansion, and possible cancellation.

The existing HQ release covers inquiry intake, a sales pipeline, account records,
implementation checklists, tasks, calendar, and manually recorded commercial fees.
It does not yet manage the full subscription or customer-support lifecycle.
Routing staff through the Field OS demo was also a separate entry-point defect.

## Business areas

| Area | Primary work | Decisions it should support |
| --- | --- | --- |
| Owner dashboard | Paying accounts, recurring revenue, pipeline, onboarding, support, renewals, and delivery costs | What needs attention, who owns it, and how is the business performing? |
| Sales and growth | Website inquiries, sources, qualification, discovery/demo calls, proposals, and follow-ups | Which opportunities are converting and what is the next action? |
| Customer accounts | Company, contacts, product/workspace, owner, plan, start date, onboarding, and support history | What have we promised this customer and how are they doing? |
| Subscriptions and revenue | Plan terms, monthly/annual cadence, setup charges, start/renewal/end dates, changes, invoices, and payment status | What recurring revenue is active, changing, or at risk? |
| Onboarding and delivery | Configuration, migrations, integrations, training, acceptance, blockers, and launch dates | Which customers can launch and what is blocking the others? |
| Support and retention | Customer tickets, priority, owner, response due dates, resolution, follow-up, and renewal actions | Which customers need help and what threatens retention? |
| Product and platform | Feature requests, bugs, roadmap, releases, integration health, and attributable hosting/AI costs | What should we build or fix, and what does each account cost to serve? |

## Data and workflow changes

- Keep the company account as the shared customer record. Model sales
  opportunities separately so renewals and expansion do not overwrite the first
  sale or create duplicate customer accounts.
- Introduce explicit subscription records and dated subscription changes.
  Retain historical terms and prices when a customer upgrades or cancels.
- Separate recurring software charges, recurring managed support, and one-time
  setup/implementation charges. An agreed fee alone is not a paying subscription.
- Connect the won opportunity, agreed scope, subscription, and onboarding project
  using explicit references. Activating a subscription and completing onboarding
  are distinct events with recorded dates and owners.
- Add customer-linked support tickets and customer-requested product work.
  Staff should be able to see both from the account without searching other areas.
- Link customer workspaces to accounts for service administration while keeping
  HQ membership and customer data authorization separate.
- Capture costs with source, period, account allocation, and recorded/estimated
  status. Display missing cost data explicitly; do not treat it as zero cost.

## Metric rules for implementation

- Monthly recurring revenue is normalized recurring subscription value as of a
  date. One-time fees, proposals, trials, and future starts are excluded. Show
  software subscriptions and managed support separately before any combined total.
- Monthly recurring revenue changes must distinguish new subscriptions,
  expansion, contraction, and cancellations using historical effective dates.
- Payment status and cash collected are separate from contracted recurring value.
  An invoice is not a payment, and manual notes are not an accounting sync.
- A customer is not automatically at risk just because telemetry is absent.
  Show explicit signals such as overdue onboarding, unresolved support, failed
  payment, approaching renewal, or a staff-recorded concern.
- Do not show fabricated revenue, churn, customer health, campaign return, or
  margins. Empty or unconnected sources must have clear, actionable empty states.

## Delivery order

1. Correct staff landing into HQ. Keep Google login and existing membership checks.
2. Redesign the account and revenue model, then build subscriptions, onboarding,
   basic support, and an owner dashboard from those saved records.
3. Add product requests/releases, renewals and retention workflows, and cost
   attribution. Add accounting, billing, marketing, and platform integrations as
   explicit connections with verified data sources.

Use the existing repository, Vercel project, and Supabase project. Retain the
working website intake, authorization, audit history, and useful account records.
Do not start a new paid service as part of this redesign without the owner's
authorization. Product demos should remain an intentional navigation destination.

## Acceptance criteria

- A WorkForge staff sign-in opens its internal business dashboard.
- A customer-only account continues to access only its authorized workspace.
- A won software sale can be followed through onboarding, subscription activation,
  ongoing support, renewal/upgrade, and cancellation with a consistent account.
- Every dashboard total can be traced to underlying saved records and an as-of date.
- WorkForge's operational navigation is expressed in software-business terms.
- Automated billing and provider integrations are described as connected only
  after the complete flow has been verified.
