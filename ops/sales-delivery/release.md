# Sales and delivery release — September 14, 2026

## User workflow

Open **Sales & delivery** in HQ, choose a customer and engagement, and work through Discovery, Estimates & agreements, then Implementation & beta. New inquiries automatically receive an initial discovery engagement. Additional Blueprint, implementation and change engagements stay under the same account.

Discovery captures outcomes, buyer/users, workflow exceptions, roles, current systems and integration feasibility, migration, calculations, automation, security and commercial constraints. Each section has a status and notes; unresolved questions block an implementation offer. A bounded Blueprint offer may explicitly resolve those unknowns.

Add deliverables with user roles, steps and measurable expected results. Create an estimate with parties, scope, exclusions, dependencies, payment, tax, recurring service, support and agreement terms. One-time, monthly and annual totals stay separate; usage rates are excluded from fixed charges. A deposit is part of the one-time total. Terms must be completed and reviewed before issuing.

An issued offer is frozen. Revisions preserve the prior offer. Use **Preview / PDF** to print the stored version and obtain signatures outside HQ. **Record acceptance** retains the authorized signer, date, exact version and signed-document reference; it does not create a customer signature. Signed documents must be retained in the team's controlled document system. HQ has no direct signing portal or file-upload feature in this release.

Acceptance creates agreed fixed fees, one project per accepted engagement, its checklist and tests copied from the issued requirements. Blueprint creates four design tasks; implementation/change creates twelve kickoff, build, beta and launch tasks. Recurring commitments do not activate subscriptions or collect money.

Record funding evidence, complete checklist evidence, identify the release, and enter each test result. Runs retain actual results, tester, time and evidence. Ready/launch requires passing mandatory tests for the current release and resolving blocking defects. Minor exceptions require an owner, correction date, workaround and acknowledgement. Launch additionally requires customer release approval, completed tasks and a support plan. Release changes or new beta evidence clear prior approval. Software launch creates the initial customer support check-in.

## Technical and validation notes

- Additive migration preserves existing account IDs, fees and project scope; backfills initial opportunities without inventing signatures. No existing project rows were present in the production preflight (one account and one fee).
- Existing manual commercial entries remain editable. Fees linked to accepted agreements preserve their original commercial values; payments/status remain separate.
- All new routes/actions use HQ membership. New tables use RLS and audit triggers. Issued documents are immutable and beta logs are append-only. Acceptance/handoff is atomic and repeat-safe.
- `npm test`: 51 passing tests. `npm run build`: passed.
- `PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node tests/hq-db-runner.mjs`: isolated migration and workflow/access suites, including website intake after the new migration. Fixtures roll back.
- Production: `hq_sales_delivery` and `hq_sales_indexes` applied successfully. Existing counts reconciled; the rollback-only sales integration suite passed against the live database. The composite foreign-key indexes flagged by the advisor were added. New sales tables have no security findings.
- PR #7 merged as `9398dbba1426463911e14b651133292125042774`; Vercel production succeeded. Authenticated desktop browser checks passed for inquiry creation, ten-section discovery save, deliverable save, estimate save/issue, customer document preview, acceptance handoff, project update, checklist evidence and beta result persistence. One fixture account was used; no real customer was signed, contacted or charged. Remaining checklist prerequisites were simulated in the fixture database; automated SQL tests exercised failed tests, blocked launch, customer release approval and support handoff.
- Visual review checked the live agreement/workspace layouts. A follow-up corrects header-logo stretching and prevents opening another editor while discovery changes are unsaved. Responsive CSS is included; tablet interaction and an exported PDF file were not independently verified in this browser.

## Boundaries and follow-on work

The broader playbooks also describe dedicated change-order comparisons, lost reasons, customer dependency records, private file storage and dashboard analytics. This release uses separate change engagements, owner/next-action fields, project blockers and evidence references for those needs. Discovery saves as one form; unsaved changes are flagged. There is no automated email, invoicing, recurring charge collection or public customer login added by this release.

WorkForge's actual legal entity, prices, payment policies and final agreement terms must be supplied for customer offers. The default text is a draft framework with unresolved legal placeholders, which block issuing until completed.
