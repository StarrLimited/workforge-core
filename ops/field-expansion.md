# WorkForge Field 0.2

FRX's current sales and operations model informed this reusable implementation. No FRX customers, pricing, provider credentials, employee assignments or business-specific integration configuration were copied.

| Workflow | Implemented in Field 0.2 | Further development |
| --- | --- | --- |
| CRM | Editable customer records, customer type, notes, existing-customer jobs, job-specific addresses and history | Independent multi-property records and multiple contacts per company |
| Sales | Sales board, source, service, owner, priority, due follow-ups, lost reason and reopening | Automated intake, escalation and communication |
| Consultation | Customer goals/timing/budget, measurements, access, conditions, completion flag, linked appointments and photos | Configurable service-specific templates and drawing/measurement tools |
| Pricebook | Categories, unit costs, margin-based selling prices, tax flag and archiving | Product images, vendor catalogs and imports |
| Estimates | Itemized quantities/costs/prices, margin repricing, taxable lines, discounts, deposits, expiry and terms | Optional alternatives, allowances and customer change orders |
| Proposals | Saved revisions, immutable accepted terms/customer snapshot, customer-facing print/save-PDF preview excluding internal costs | Customer delivery, secure approval links and actual e-signature |
| Production | Operations board, owner, crew/date, materials readiness, task list and required walkthrough | Multi-day scheduling, capacity and recurring services |
| Purchasing | Multiple material and subcontract commitments per job, partner records, delivery dates, references and notes | Multi-line vendor POs, supplier delivery and subcontractor payment workflow |
| Finance | Manual expense/receipt ledger with unique references and voids, balances, deposits, reviewed profitability | Xero posting/reconciliation and automated payment collection |
| Reporting | Source conversion counts, contract values, costs, commitments, collections and missing-cost indicators | Date filters, targets, capacity and large-workspace pagination |

## Key controls

- Authenticated membership and database RLS scope every record to its workspace.
- Customer approval remains explicitly simulated and available only in demonstration workspaces. Staff do not sign a real customer contract.
- A draft PO can be prepared early. Issuance requires the approved customer estimate; collecting a deposit is separate.
- On-hold/inactive partners cannot receive a new crew assignment or an issued PO.
- Accepted estimates lock scope, costs, line items, terms and pricing settings. Later catalog/customer edits do not change the saved proposal.
- Expense additions or voids reopen cost review. Reports show costs incomplete until the operator reviews them.
- Commitments include ordered/received POs; draft purchases are excluded. Receipts do not replace contract revenue. Profit excludes sales tax.
- The optional sample catalog contains illustrative costs only and seeds only an empty catalog in the fictional Juniper Field Services workspace.

This remains a development release. The next major layer is customer proposal delivery/approval, followed by configurable intake and accounting connections.
