# WorkForge Field 0.3 — Demo workflow

Prepared September 12, 2026 for the existing WorkForge development portal.

## Changes

- Lead Source uses standard choices: Unclassified, Google, Google Ads, LSAs, Meta, Print, Referral, Website, Phone, Repeat customer and Other. Existing custom values remain selectable.
- Demo operations owners: Shawn, Neil, Alex Morgan, Jordan Lee and Taylor Brooks.
- Purchasing & Production Assignments sits directly below production readiness. Status can be updated inside the job.
- Materials purchases require a Vendor; Subcontract Work Orders require a Subcontractor; Internal Work Orders require an Internal Crew. Every partner option identifies its category. Production assignments use Planned / Assigned / Completed labels.
- Estimate saving creates a proposal atomically after a completed consultation. Subsequent saves preserve revisions. Accepted estimates remain locked; an editable demo copy starts a fresh lead for the same customer, with the scope and draft estimate copied.
- Closeout checks saved delivery, walkthrough, punch list, assignments, cost review and full recorded payment. Receipt recording is manual; no charge or invoice is sent.

## Demonstration steps

1. Choose **New lead**, or open an approved job's **Estimate** tab and choose **Create editable demo copy**.
2. Save the customer/opportunity details and Lead Source.
3. Schedule the consultation and choose **Move to consultation**. Complete and save the consultation checklist.
4. Open **Estimate**, edit scope and itemized costs/prices, and choose **Save & create proposal**. Preview the saved proposal. Further saves create new revisions.
5. Choose **Record demo approval** and enter a fictional customer's name.
6. In **Production**, select an Operations Owner, add purchasing/production assignments, and update their statuses. Assign the date and crew, confirm the schedule, and start the job.
7. Complete tasks, assignments and the customer walkthrough. Record expenses and customer receipts in **Job financials**, then save the completed cost review in **Production**.
8. Complete the job and prepare the invoice. Open **Closeout** to resolve remaining checks and download the invoice handoff CSV.

## Verification

- All 18 unit tests pass, including cent arithmetic, dropdown compatibility, partner category matching, approval redirects and closeout completeness.
- `npm run build` passes, including TypeScript.
- `tests/demo-workflow-integration.sql` passes against the dedicated WorkForge database with fictional records rolled back afterward. It covers intake drafts, consultation prerequisites, atomic/stale saves, immutable revisions, all three assignment types, approval protection, demo copy isolation, scheduling, tasks, costs, receipts, invoice totals and role/tenant restrictions.
- Database migrations `20260912041321_demo_workflow_assignments` and `20260912041549_demo_copy_read_access` are applied. No broader table update permissions were granted.
- Security advisor reports no database security findings. The existing Auth password-protection warning remains; [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- The available browser is logged out. Signed-in visual and interactive verification remains pending; database tests do not substitute for browser verification.
