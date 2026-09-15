# Field Solo — HQ 0.7.1

Approved by Shawn on September 15, 2026 as an additional offering below Foundation, Operations and Scale.

## Offering

Field Solo is $1,495 one time for one business and one owner-operator. It configures one proven standard Field OS workflow, with business branding, contacts and lead intake, follow-up tasks, one estimate/approval layout, a basic approved pricebook, calendar and estimate-to-job conversion, notes/photos, one completion checklist, invoice preparation and accounting handoff.

Implementation includes one 45-minute setup session, one 60-minute training session, one configuration revision, and 14 days of launch help. Target delivery is 1–2 weeks after usable data and access arrive. Import allowance: one clean spreadsheet with up to 250 contacts, 50 pricebook items and 10 open jobs. These are import allowances, not ongoing record limits.

Custom integrations, extra/custom workflows, crew/branch setup, historical attachments and custom reports are excluded. Payment processing or automatic accounting synchronization requires a separately scoped supported integration. Retain customer data and configuration when the business grows and separately quote added implementation work.

Solo Care is optional at $99/month: monitoring, scheduled backups, routine maintenance and up to 15 minutes of user help monthly. New features and changes are separately scoped. Third-party hosting, messaging and usage costs remain additional and must be disclosed before purchase. Care hours, response expectations and recovery terms are completed for the customer; the builder does not inherit Managed's response targets.

## Quote behavior

- Solo appears first in Packages & pricing, labeled “For owner-operators.” The four build offers use a two-column comparison on large screens.
- Care plan choices are None, Solo Care (Solo only) and WorkForge Managed. Solo defaults to Solo Care and other packages retain the Managed default; either can be deselected.
- Automation, AI and Continuous Improvement require $149/month Managed. It replaces Solo Care, and only one care plan is charged. Required add-on setup fees remain separate one-time lines.
- Manual proposal validation and the database reject duplicate care, Solo Care on another build package, multiple implementation packages and add-ons without Managed/setup.
- Solo with Care totals $1,495 one time and $99/month. Milestones: $747.50 start, $448.50 testing and $299 acceptance, before tax.
- Solo plus AI Assistant or Automation Essentials totals $1,990 one time and $248/month, including Managed and the $495 setup.
- Solo includes its 45-minute setup session; it does not promise the full standalone Blueprint deliverable. A previously purchased Blueprint can be credited using the existing documented payment/credit procedure.
- Applying a package fills complete scope, exclusions, timeline, payment and support terms. It does not activate services, charge, send or sign an agreement.

## Migration and verification

`20260915201632_hq_field_solo.sql` adds only WF-FIELD-SOLO and WF-SOLO-CARE, preserving existing records and administrator pricing. It replaces the private invoker trigger function with updated catalog validation, retaining its existing permissions and frozen issued-agreement behavior.

- 67 Node tests passed, including the Solo scope, milestones, optional care and automatic care replacement checks.
- TypeScript and optimized Next.js production build passed. The initial local build required replacing an external dependency symlink with a local hardlink copy; application code needed no workaround.
- The exact migration and rollback-only Solo database suite passed against the existing WorkForge Supabase project. Checks cover approved rates, optional care, duplicate care, larger-package eligibility, Managed dependency, upgraded quote totals, immutable issued prices and acceptance creating the correct fixed/recurring commitments and implementation.
- All synthetic database changes were rolled back. No subscription, payment, message or signature was created by verification.
