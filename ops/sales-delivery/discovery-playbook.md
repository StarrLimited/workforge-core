# WorkForge discovery and sales playbook

Status: proposed operating form and HQ field specification. Prepared September 14, 2026; not yet built into HQ.

## Before the meeting

Account: [ ]  
Opportunity / product interest: [ ]  
WorkForge owner: [ ]  
Customer sponsor: [ ]  
Customer decision-maker and signer: [ ]  
Meeting date: [ ]  
Next action and date: [ ]

Review the inquiry, source, company, current software, and stated problem. Ask the customer to bring one real example of work, an existing form/report, and someone who performs the workflow daily. Use redacted samples where practical.

Suggested initial meeting: 45–60 minutes. Spend most of it on the actual workflow, then show only the parts of the demo that relate to the customer's needs. The demo is a discussion aid; record which capabilities exist today and which would require new development.

## Discovery questions and required records

| Topic | Questions to ask | What HQ must capture |
| --- | --- | --- |
| Business outcome | Why change now? What is breaking? What happens if nothing changes? | Problem, impact, urgency, business owner |
| Success | What measurable result would make this worthwhile? What is the baseline today? | Baseline, target, measurement method, review date |
| Buyer and users | Who pays, approves, uses, administers, and accepts the system? Who can veto? | Named contacts, roles, buying process, authorized signer |
| Current process | Show one real item from the first inquiry through completion, payment, and support. Who owns each handoff? | Steps, tools, handoffs, delays, current evidence |
| Exceptions | What happens with missing information, changes, cancellations, duplicates, refunds, and failed deliveries? | Exception path, decision owner, recovery action |
| Users and permissions | How many users/companies/locations? What must each role see or change? What must they never see? | Role matrix, tenant boundaries, expected growth, account offboarding |
| Devices and connectivity | Office desktop, customer portal, field phone, tablet? Which browsers? Does work need to continue offline? | Supported devices, browser requirements, offline requirement and feasibility |
| Existing systems | Which apps stay, which are replaced, and which are the system of record? | Inventory, account owners, source of truth by data type |
| Integrations | What moves in each direction, when, and on which event? Are APIs and suitable subscriptions available? | Access feasibility, sync direction/frequency, errors, duplicate prevention, external fees |
| Migration | What records, attachments, balances, and history move? How clean is the source? Who approves reconciliation? | Export sample, volume, mapping, duplicate rules, historical cutoff, validation owner |
| Financial rules | Show pricing, discounts, tax handling, approval limits, invoices, credits, and payment reconciliation. | Exact calculation/rounding rules, accounting boundary, approval authority |
| Documents and communication | Which forms, estimates, contracts, emails, texts, and reports must be produced? | Approved examples, sender identities, recipient/approval rules, delivery evidence |
| Automation and AI | What should run automatically? Which actions require a human? What if the result is wrong or the provider fails? | Allowed actions/data, approval steps, fallback, activity log, usage budget/limits |
| Data and security | What personal, payment, regulated, or confidential information is involved? What retention, export, and deletion obligations exist? | Data classification, access and backup needs, customer requirements, specialist review if needed |
| Capacity and reliability | How many records and transactions, at peak? How long may a critical task take? What downtime is tolerable? | Volumes, agreed performance targets, recovery objectives and constraints |
| Budget and recurring cost | What can be spent on setup and monthly operation? Who pays hosting, integration, messaging, and AI charges? | Separate setup/recurring ranges, payers, expected usage, assumptions |
| Timeline and participation | What deadline is real? Who provides access, data, feedback, and beta testing, and when? | Milestones, customer dependencies, blackout dates, approver availability |
| Support and exit | Who needs help after launch? During what hours? What happens if the customer leaves? | Support model, escalation, export requirements, transition expectations |

Do not enter passwords, API secrets, or recovery codes in these forms. Record the account owner and secure access-transfer method.

## Capture each critical workflow

Requirement ID: [REQ-___]  
Workflow name and business owner: [ ]  
User role: [ ]  
Business reason: [ ]  
Priority: [Must have / Should have / Later]  
Trigger: [ ]  
Inputs and source of truth: [ ]  
Steps and decision rules: [ ]  
Result / destination: [ ]  
Exception and recovery behavior: [ ]  
External dependency: [ ]  
Customer sample/reference: [ ]  
Measurable acceptance criterion: [ ]  
Planned beta scenario ID: [ ]  
In scope / excluded / unresolved: [ ]  
Customer confirmation and date: [ ]

A useful criterion states an observable outcome: “When the website submits the same inquiry twice, the pipeline contains one inquiry with the original contact details and one assigned follow-up.” Avoid “CRM works” or “automation complete.”

## Role and permission matrix

| Role | View | Create/edit | Approve/send | Financial access | Explicit restrictions |
| --- | --- | --- | --- | --- | --- |
| Owner/admin | [ ] | [ ] | [ ] | [ ] | [ ] |
| Sales | [ ] | [ ] | [ ] | [ ] | [ ] |
| Operations | [ ] | [ ] | [ ] | [ ] | [ ] |
| Accounting | [ ] | [ ] | [ ] | [ ] | [ ] |
| Customer/vendor | [ ] | [ ] | [ ] | [ ] | [ ] |

Test restrictions using actual role accounts. A hidden button is not an access-control test.

## System and migration register

| System / data type | Keep or replace | System of record | Owner / access confirmed | Volume/history | Mapping and reconciliation | Known constraint |
| --- | --- | --- | --- | --- | --- | --- |
| [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

For each integration, record create/update/delete direction, identity matching, retry behavior, and the person who handles a failed sync. Verify that the required API capability exists before promising it.

For financial migrations, define which totals must reconcile and how differences are resolved. Keep a dated source export and agree a final cutover window.

## Unknowns and customer requests

| Question/request | Why it matters | Owner | Due date | Evidence needed | Blocks estimate/build? |
| --- | --- | --- | --- | --- | --- |
| [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

A blank answer is still open. Not applicable requires a reason. An assumption affecting cost, scope, or timing belongs in the customer proposal.

## Discovery closeout

Read the following back to the customer:
- The problem and target result.
- The must-have workflows and the initial release boundary.
- The systems that remain in use.
- The customer inputs needed and their owners.
- The proposed commercial next step and meeting date.

Record the fit decision: Proceed to estimate / Paid Blueprint / Waiting for customer / Not a fit.

Use a paid Blueprint when the unknowns are substantial enough to prevent a reliable implementation scope. Its deliverables can include a workflow map, permission model, integration feasibility results, migration assessment, prioritized requirements, acceptance plan, and implementation estimate. Give the Blueprint its own price, completion criteria, and authorization.

## Estimate readiness review

- [ ] Buyer, signer, daily user representative, and acceptance owner named.
- [ ] Target outcome and baseline recorded.
- [ ] Must-have workflows include exceptions and measurable acceptance criteria.
- [ ] Access, integration, migration, and data constraints assessed.
- [ ] Initial scope, exclusions, and customer dependencies explicit.
- [ ] Build effort and recurring operating costs estimated separately.
- [ ] Timeline includes customer review and beta participation.
- [ ] WorkForge delivery owner has checked feasibility and capacity.
- [ ] Material unknowns resolved or explicitly scoped into a Blueprint.
- [ ] Customer agrees on the next action and date.

Internal estimate worksheet: implementation labor hours × loaded cost; migration/integration effort; contingency for identified risks; recurring hosting, support labor, AI, messaging, storage, and vendor charges. Show gross margin as (revenue − direct delivery cost) / revenue. Keep markup separate. An unknown cost remains unknown; do not substitute zero or use portfolio landscaping margins as an assumed software target.
