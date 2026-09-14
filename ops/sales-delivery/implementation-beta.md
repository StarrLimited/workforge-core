# WorkForge implementation, beta, and launch playbook

Status: proposed operating forms and HQ workflow requirements. Prepared September 14, 2026; not yet implemented in HQ.

Account: [ ]  
Project / engagement: [ ]  
Accepted agreement and revision: [ ]  
WorkForge delivery owner: [ ]  
Customer sponsor / beta lead / launch approver: [ ]  
Target launch and constraints: [ ]  
Current phase: [ ]  
Current blocker, owner, and next review: [ ]

Every completed checklist item needs an owner, completion date, and appropriate evidence. Required evidence may be a document, saved result, test run, customer approval, or reconciliation report. “Not applicable” requires a reason and reviewer.

## 1. Kickoff and baseline

- [ ] Confirm the accepted agreement revision and funding condition.
- [ ] Review objectives, must-have workflows, exclusions, and measurable success with the customer.
- [ ] Convert each committed deliverable to linked requirements and acceptance scenarios.
- [ ] Confirm project owner, customer decision-maker, beta testers, and communication schedule.
- [ ] Assign customer dependencies with requested/due dates and escalation contacts.
- [ ] Confirm system owners, secure access, roles, integration permissions, and third-party costs.
- [ ] Confirm source data, mapping, cleanup responsibility, retention, and migration reconciliation.
- [ ] Identify material security/data requirements and unresolved constraints.
- [ ] Set milestone dates, beta window, training, cutover, and recovery plan.

Exit: an approved delivery baseline with owned tasks and no unresolved dependency that prevents the planned first build.

## 2. Initial build and internal review

- [ ] Configure the intended customer workspace, branding, roles, and device layouts.
- [ ] Verify sign-in, invited-user access, logout, and user removal.
- [ ] Implement a complete critical workflow from entry through its final result.
- [ ] Demonstrate the workflow with representative inputs to the customer; record feedback against requirement IDs.
- [ ] Verify create/edit/save/reopen behavior, required fields, duplicates, and concurrent updates.
- [ ] Test integrations in both required directions, including failure and retry behavior.
- [ ] Validate calculations using known expected totals, including rounding, discounts, credits, and cadence.
- [ ] Validate data migration with counts, sample records, relationships, attachments, and relevant financial totals.
- [ ] Verify roles cannot read or change restricted records, including through direct requests.
- [ ] Keep one customer's records inaccessible to another customer.
- [ ] Verify the agreed browser/tablet/mobile layouts and relevant accessibility controls.
- [ ] Exercise realistic expected data volume and agreed response-time targets.
- [ ] Test backup restoration and documented recovery where included in the service.
- [ ] For AI/automation, verify human approval requirements, allowed data, spend limits, fallback, and activity history.
- [ ] Identify the release/build and maintain a defect log with resolution/retest evidence.

Use sandbox integrations and approved recipients for tests. A test must not charge a real customer, send an unintended email/text, or modify production business records.

Exit: mandatory internal scenarios passed, release identified, known issues triaged, and beta access/data prepared.

Security activities belong throughout delivery, not only at the end. This approach is informed by [NIST's Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final). It is an operating checklist, not a claim of certification.

## 3. Customer beta plan

Beta release/build: [ ]  
Environment and URL: [ ]  
Permitted data and test accounts: [ ]  
Beta start/end: [ ]  
Customer tester roster and roles: [ ]  
Feedback channel and triage owner: [ ]  
Rollback or stop-test procedure: [ ]

Choose a small representative user group, including the person who performs the work daily. Have them perform the scenarios themselves. A sales demo alone is not customer testing.

### Scenario record

Test ID: [UAT-___]  
Requirement/deliverable IDs: [ ]  
Business workflow: [ ]  
User role / device / browser: [ ]  
Release / environment: [ ]  
Preconditions and sample data: [ ]  
Steps: [ ]  
Expected outcome and measurable check: [ ]  
Actual outcome: [ ]  
Result: [Not run / Passed / Failed / Blocked / Not applicable with reason]  
Tester and run date: [ ]  
Evidence: [ ]  
Linked defect(s): [ ]  
Retest build/date/result: [ ]

Retain each run. A corrected result creates a new run; it does not overwrite the evidence of the original failure.

### Required scenario families, where applicable

| ID family | Customer task | Evidence of success |
| --- | --- | --- |
| Access | Sign in as each role and attempt an unauthorized action | Intended access works; prohibited access is denied |
| Intake | Submit through the actual inquiry source, including a duplicate delivery | One correct customer record, attribution, owner, and next action |
| Sales | Update discovery, create/revise an estimate, and record customer authorization | Correct version, scope, totals, and follow-up |
| Delivery | Start the authorized work and complete a representative handoff | Correct project/tasks, owners, dependencies, and status |
| Financial | Follow the agreed invoice/payment/accounting path | Expected calculations and source-of-truth reconciliation |
| Migration | Find representative historical records and relationships | Counts, balances, attachments, and sample fields reconcile |
| Integration | Cause a provider failure and retry after recovery | Visible error, recoverable state, no duplicate effects |
| Reporting | Compare a dashboard total to its underlying records | Filters, dates, status rules, and totals agree |
| Automation/AI | Exercise approvals, limits, fallback, and unexpected input | No unauthorized action; clear review and failure behavior |
| Support | Open, assign, respond to, and close a support issue | Responsible owner, deadlines, history, and resolution |
| Recovery | Recover the agreed representative records/workflow | Documented procedure and verified usable data |

Tailor families to the contracted scope. Mark unrelated families not applicable with a reason; do not create unnecessary accounting or AI requirements for a project that excludes them.

For deeper web security scenarios, use the versioned [OWASP Web Security Testing Guide v4.2](https://owasp.org/www-project-web-security-testing-guide/v42/). Its testing framework informs the access and session checks here; this checklist does not replace a scoped security assessment where one is required.

## 4. Defects, enhancements, and changes

| Severity | Practical definition | Launch treatment |
| --- | --- | --- |
| Critical | Unauthorized access, data loss/corruption, unintended financial transaction, or system unusable | Stop affected activity; fix and retest before launch |
| High | A required core workflow fails and has no acceptable workaround | Fix and retest before launch |
| Medium | A noncritical defect has a documented safe workaround | Customer may explicitly accept a dated correction plan |
| Low | Cosmetic or minor usability issue with no material workflow impact | Record owner/date; obtain acknowledgement if deferred |

Defect record: ID, linked requirement/test, description, reproduction steps, expected/actual result, severity, customer impact, owner, due date, status, fix/release, and retest evidence.

An enhancement requests behavior beyond the accepted scope. Record it as a change request with cost, schedule, and acceptance impact. Do not bill a defect as a scope change merely because fixing it takes time.

## 5. Customer acceptance form

Customer: [ ]  
Project / agreement revision: [ ]  
Release/build approved: [ ]  
Beta dates and completed scenario set: [ ]  
Mandatory scenarios passed: [ ]  
Open critical/high defects: [must be zero]  
Approved minor exceptions and correction plan: [IDs, workaround, owner, due date]  
Training completed / remaining agreed sessions: [ ]  
Data migration/reconciliation approval: [ ]  
Customer approver name, title, and authority: [ ]  
Customer approval date and evidence: [ ]  
WorkForge reviewer and date: [ ]

Proposed acknowledgement:
“We reviewed the identified release against the listed acceptance criteria. We approve launch subject only to the expressly listed minor exceptions and correction plan.”

Retain the actual customer approval. Do not prefill it from an internal completion checkbox.

## 6. Launch checklist

- [ ] Customer acceptance references the release being deployed.
- [ ] Mandatory tests passed; critical/high defects are closed and retested.
- [ ] Minor exceptions have customer acknowledgement and assigned due dates.
- [ ] Customer access, roles, production integrations, and sender identities verified.
- [ ] Final migration/sync reconciled; source archive retained as agreed.
- [ ] Cutover timing, change freeze, responsible people, and rollback decision point confirmed.
- [ ] Backup/recovery instructions and authorized operational access available.
- [ ] Customer training and quick-start instructions delivered.
- [ ] Production smoke test completes the critical workflow.
- [ ] Subscription/support start dates match the agreement; billing remains a separately verified action.
- [ ] Support owner, hours, contact channel, priorities, and escalation recorded.
- [ ] Stabilization and follow-up dates scheduled.

A production smoke-test failure triggers the agreed rollback or hold decision. Do not display Live merely because the deployment service returned success.

## 7. Support handoff and follow-up

Support owner: [ ]  
Customer operational contact: [ ]  
Support channel/hours/priority response targets: [ ]  
Purchased plan and included work: [ ]  
Known issues and correction dates: [ ]  
System inventory, administrative access owner, backup/recovery reference: [ ]  
Recurring vendors, billing responsibility, and usage/spend limits: [ ]  
Training/runbook and acceptance references: [ ]

Proposed follow-up cadence: a check-in during the first week and a value review around 30 days after launch. Adjust to the engagement and put actual dates in HQ.

First-week review: access issues, adoption, urgent defects, data/integration failures, outstanding training.  
Value review: the original success measure, usage, customer concerns, operating costs, and priorities for any separately scoped next phase.

Each accepted minor beta issue carries into support with its original ID, owner, and due date. Customer-requested enhancements remain distinguishable from defects and from the support plan's included services.
