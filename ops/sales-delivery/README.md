# WorkForge HQ: discovery, agreements, and delivery

Status: review draft, September 14, 2026. These documents are prepared; the HQ application changes described here are not implemented or deployed.

The current coding environment is unavailable. The existing repository was inspected through GitHub at main commit 35ffad722e0aef6807ee45ae07e751c55bfb849c. Application implementation, database migrations, automated tests, and browser verification remain outstanding.

## The customer journey

| Step | Staff action | Required output |
| --- | --- | --- |
| Qualify | Confirm the problem, buyer, budget range, and timing | Named owner, next meeting, and fit decision |
| Discover | Walk through real work and exceptions | Requirements, current systems, access needs, and measurable success |
| Scope | Resolve unknowns or sell a bounded Blueprint engagement | Deliverables, exclusions, dependencies, and acceptance tests |
| Estimate and agree | Price the scope and record customer authorization | An identified, immutable agreement revision and payment schedule |
| Build | Implement and demonstrate complete workflows | Requirements linked to delivered functionality and internal test evidence |
| Beta | Have customer users perform agreed scenarios | Recorded results, defect fixes, retests, and customer acceptance |
| Launch and support | Cut over, train, and hand off | Launch approval, support owner, support terms, and dated check-ins |

A paid Blueprint authorizes discovery and design deliverables only. It does not authorize implementation. A proposal, an accepted agreement, a payment, a subscription activation, and a production launch are separate events.

## Ready-to-review forms

- [Discovery and sales playbook](discovery-playbook.md): meeting agenda, questions, requirement form, fit decision, and proposal readiness.
- [Estimate and agreement template](estimate-agreement.md): customer-facing scope, commercial schedule, draft service terms, and acceptance blocks.
- [Implementation and beta playbook](implementation-beta.md): build checklist, scenario tests, issue severity, customer acceptance, and support handoff.

All example operating practices are proposed WorkForge defaults. Prices, deposit percentages, service levels, and legal terms have not been approved or imposed on any customer.

## Changes to the HQ screens

### Sales pipeline and customer account

Add a Discovery tab to the account and a clear Resume discovery action to the opportunity card. Show unanswered critical questions and outstanding customer requests. Preserve phone, source, and attribution from website intake.

Discovery sections should save independently, indicate unsaved changes, and work on a tablet. Support Unknown and Not applicable with a reason. Never treat an empty field as a confirmed answer.

An opportunity needs a buyer, business problem, scope decision, next action, and due date. Lost opportunities need a reason. A customer can later buy additional work without recreating the customer account.

### Estimates and agreements

Add Estimates & agreements to navigation and to each account. Provide:
- New estimate from discovery.
- One-time, monthly, annual, and usage-based line items displayed in separate totals.
- A customer preview and print/PDF output with stable page breaks and repeating table headings.
- Draft, Issued, Accepted, Declined, Expired, and Superseded states.
- Revision history and change-order links.
- Record acceptance with the signer, date, method, and retained evidence.
- A visible difference between an estimate and the final agreed scope.

The first release can use PDF signing outside HQ and record the signed copy in private document storage. Label the action Record acceptance. It must never describe a staff click as a customer signature. A public customer signing portal is a separate implementation that needs its own identity, document integrity, and access tests.

Do not send proposals, signature requests, invoices, or reminders automatically as part of saving a draft.

### Implementation workspace

Show the approved scope revision at the top, then Milestones, Requirements, Beta tests, Issues, Changes, and Launch & support. Every milestone and issue has an owner and date. Customer-dependent work identifies the customer contact, request, request date, and impact.

Separate build defects from requested enhancements. A change request records its effect on scope, price, recurring costs, and schedule before authorization. The originally accepted agreement remains available after a change.

### Owner dashboard

Add proposals awaiting response, discovery blockers, unsigned build scopes, overdue customer dependencies, beta failures, overdue launches, and upcoming post-launch reviews. Counts must drill into saved records. An unresolved critical question is shown explicitly.

## Data model and continuity

| Record | Minimum persisted fields |
| --- | --- |
| Opportunity | Account, engagement type, sales stage, owner, next action/date, buyer, expected value, close/lost reason |
| Discovery | Opportunity, section answers, evidence references, unknowns, owner, reviewed date, revision |
| Requirement | Opportunity/project, stable ID, actor, trigger, inputs, rules, output, exceptions, priority, measurable acceptance criteria |
| Agreement | Opportunity, document number/revision, parties, scope snapshot, commercial/terms snapshot, status, expiry, predecessor, issued timestamp |
| Agreement line | Agreement revision, category, description, quantity/unit, currency, unit price, discount/tax treatment, cadence, start trigger |
| Acceptance event | Agreement revision, signer identity/authority, method, accepted timestamp, evidence reference, staff recorder and timestamp |
| Project | Account, opportunity, accepted agreement, project type, owner, target date, scope snapshot, status |
| Milestone | Project, exit criteria, owner/date, status, evidence, dependencies |
| Test case/run | Project, requirement ID, role/environment/build, steps/data, expected/actual result, tester/date, evidence, result |
| Defect | Project/test, severity, reproduction, owner/date, status, resolution, retest evidence |
| Change order | Project, baseline revision, requested change, fee/time/usage impact, authorization evidence |
| Launch acceptance | Project/release, approved tests, accepted minor issues, customer approver, approval date/evidence |
| Support handoff | Account/project, support owner/terms, escalation route, system access, known issues, next review |

Existing HQ links implementation uniquely to an account and uses the account sales stage as the opportunity. The migration must preserve those records, introduce explicit opportunities, and allow projects per agreed engagement. Backfill one legacy opportunity per existing sales record, link existing projects and commercial rows, and reconcile counts before removing the account-level uniqueness assumption. Keep compatibility adapters until the new screens and stage actions are deployed together.

Do not fabricate historical customer acceptance for existing agreements. Display Legacy agreement — acceptance evidence not recorded and provide a staff reconciliation action. Already-live projects retain their launch state and get a dated review task for missing records.

## Workflow rules to enforce in the database and server

1. An implementation proposal cannot be issued while a required discovery question that affects feasibility, scope, or price is unresolved. A Blueprint proposal may explicitly contract to resolve those questions.
2. All issued documents have complete parties, scope, acceptance criteria, price/cadence, payment terms, and resolved agreement terms. Internal costs never enter the customer snapshot.
3. Issued content is immutable. Changes create a new revision. Superseding a revision does not erase it.
4. Acceptance always references the exact issued revision and retained evidence. Reject expired, superseded, or already-declined revisions. Use an explicit new offer if terms change.
5. Acceptance of a Blueprint creates its agreed fee and design milestones. Acceptance of implementation creates its agreed fees and project. Both operations are atomic and repeat-safe.
6. Record payment separately. Build can start once the accepted agreement's funding condition is satisfied; an approved exception requires an owner, reason, and timestamp.
7. An agreed recurring line does not activate billing or count as active recurring revenue. Subscription activation uses its separately agreed trigger.
8. Beta entry requires an identifiable release, internal test evidence, test users/data, and rollback instructions.
9. Launch requires passing mandatory tests on the approved release, zero open critical/high defects, customer acceptance, training, migration reconciliation if applicable, and a support handoff.
10. Minor issues may be accepted explicitly with a workaround, owner, deadline, and customer acknowledgement. Access-control, data-loss, or incorrect financial-transaction defects cannot be waived as minor.
11. Editing functionality after acceptance invalidates affected test approvals. Preserve prior evidence and require retesting of the affected workflows.
12. Use HQ membership and row-level access controls throughout. Customer links, when implemented, expose only the relevant customer document. Record changes and stage transitions in the audit history.
13. Conflicting updates return an actionable refresh message. An error must not leave partial fees, projects, signatures, or milestones.

## Meaningful acceptance tests for the implementation

- Website intake still creates one new inquiry and preserves phone/source; repeated delivery remains deduplicated.
- A salesperson completes discovery, produces an estimate, and prints the exact stored revision.
- Unknown integration feasibility prevents an implementation offer but can be the stated deliverable of a Blueprint offer.
- Mixed billing cadences remain separate. Deposits reduce outstanding project fees, never increase the project total. Unpriced tax is not silently shown as zero.
- Customer output contains no internal margin, labor cost, credentials, or staff-only notes.
- Issued agreement changes require a revision. Acceptance of an old, expired, or superseded revision is rejected.
- Concurrent acceptance/retry creates only one set of linked fees and milestones.
- A Blueprint acceptance creates only its authorized work. Later implementation preserves the earlier engagement history.
- A second engagement for one customer does not overwrite the first agreement or project.
- A failed beta scenario blocks launch until corrected and retested. Customer acceptance remains tied to a release.
- An accepted minor issue creates an owned follow-up; unresolved critical/high defects still block launch.
- Read-only staff cannot mutate records; customer-only users and anonymous callers cannot read HQ records or private documents.
- Migration preserves existing accounts, implementations, tasks, fees, subscriptions, tickets, and scope snapshots.
- Signed-in browser verification covers proposal save/preview, acceptance record, build, beta results, launch, and support handoff on desktop and tablet.

## Implementation order

1. Restore the coding workspace and read the repository's required installed Next.js documentation.
2. Implement the linked discovery/opportunity records and account navigation.
3. Implement estimate revisioning, printable agreement, private document evidence, and atomic acceptance/handoff.
4. Implement expanded delivery, beta, issues, and launch acceptance.
5. Run migration/access/concurrency tests and signed-in browser verification.
6. Release through the existing GitHub, Supabase, and Vercel projects and verify the deployed flow.

Contract wording needs legal review before customer use. No new paid signing service is assumed.
