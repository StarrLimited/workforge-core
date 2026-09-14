import { z } from 'zod';
import { packageLineErrors } from './hq-catalog.ts';

export const DISCOVERY = [
  ['outcomes', 'What needs to improve?', 'What is breaking, why now, and how will we measure improvement? Record the baseline and target.'],
  ['people', 'Who is involved?', 'Name the decision-maker, signer, daily users, beta lead, and launch approver.'],
  ['workflow', 'How does the work happen today?', 'Walk through a real item from intake to payment/support. Include changes, cancellations, duplicates, and failed handoffs.'],
  ['roles', 'Who can do what?', 'Who can view, edit, approve, or send? Identify customer boundaries, tablets/mobile, browsers, and offline needs.'],
  ['systems', 'Which apps need to work together?', 'What stays or is replaced? Record the source of truth, API feasibility, sync direction, retries, owner, and vendor fees.'],
  ['migration', 'What information needs to move?', 'Record data/history/attachments, volume, export sample, mapping, cleanup, reconciliation, and cutover owner.'],
  ['rules', 'How do pricing and paperwork work?', 'Confirm calculations, approval limits, reports, estimates, invoices, sender identities, and accounting responsibilities.'],
  ['automation', 'What should happen automatically?', 'Define permitted actions/data, human approvals, fallback, spend limits, and failure handling.'],
  ['security', 'What needs protection?', 'Identify sensitive data, retention, access removal, backups/recovery, peak volumes, and performance needs.'],
  ['commercial', 'What is the budget and timeline?', 'Separate setup and recurring budgets. Name customer dependencies, deadlines, support expectations, and export/exit needs.'],
] as const;
export const DOC_FIELDS = [
  ['seller', 'Provider legal name & address'], ['customer', 'Customer legal name & address'],
  ['objective', 'Business objective'], ['scope', 'Included deliverables & limits'], ['exclusions', 'Exclusions'],
  ['assumptions', 'Assumptions & customer responsibilities'], ['timeline', 'Milestones & target dates'],
  ['payment', 'Payment schedule & funding condition'], ['tax', 'Tax treatment'],
  ['subscription', 'Subscription start, renewal & usage terms'], ['support', 'Support hours, response targets & included services'],
  ['rights', 'Data, confidentiality & software ownership/license'], ['termination', 'Cancellation, transition & data export'],
  ['legal', 'Agreement terms & referenced documents'],
] as const;
export const CATEGORIES = ['blueprint', 'implementation', 'migration', 'software', 'support'] as const;
export const CADENCES = ['one_time', 'monthly', 'annual', 'usage'] as const;
const short = z.string().trim().max(500);
const req = z.string().trim().min(1, 'Complete the required fields.').max(20000);
export const lineSchema = z.object({ catalog_sku:z.string().max(80).optional(), description: short.min(1), service: z.enum(CATEGORIES), cadence: z.enum(CADENCES), quantity_units: z.number().int().min(1).max(1000000), unit_cents: z.number().int().min(0).max(100000000), discount_cents: z.number().int().min(0).max(100000000000) }).refine(l => (l.unit_cents === 0 && l.discount_cents === 0) || l.discount_cents < Math.floor((l.quantity_units * l.unit_cents + 50) / 100), 'Discount must be less than the line value.');
export type EstimateLine = z.infer<typeof lineSchema>;
export function lineAmount(l: EstimateLine) { return Math.floor((l.quantity_units * l.unit_cents + 50) / 100) - l.discount_cents; }
export function estimateTotals(lines: EstimateLine[]) { return lines.reduce((s,l) => { if (l.cadence !== 'usage') s[l.cadence] += lineAmount(l); return s; }, {one_time:0,monthly:0,annual:0}); }
export function decimalUnits(value: string) { if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) throw new Error('Use a positive number with up to two decimal places.'); const [a,b='']=value.split('.'); return Number(a)*100+Number(b.padEnd(2,'0')); }
export const opportunitySchema = z.object({ account_id: z.uuid(), title: short.min(1), kind: z.enum(['blueprint','implementation','change']), owner:z.enum(['Shawn','Neil']), next_action:short.min(1), due_on:z.iso.date() });
export const discoverySchema = z.object({ answers:z.record(z.string(),z.object({status:z.enum(['unknown','confirmed','not_applicable']),notes:z.string().trim().max(10000)})), open_questions:z.string().trim().max(20000) });
export const requirementSchema = z.object({ opportunity_id:z.uuid(),title:short.min(1),priority:z.enum(['must','should','later']),actor:short.min(1),steps:req,expected:req });
export const proposalSchema = z.object({ opportunity_id:z.uuid(),title:short.min(1),valid_until:z.iso.date(),document:z.record(z.string(),z.string().trim().max(20000)),lines:z.array(lineSchema).min(1).max(50),deposit_cents:z.number().int().min(0).max(100000000000),tax_cents:z.number().int().min(0).max(100000000000),terms_reviewed:z.boolean() }).refine(v => v.deposit_cents<=estimateTotals(v.lines).one_time+v.tax_cents,'The deposit cannot exceed the one-time total.').superRefine((v,ctx)=>{for(const message of packageLineErrors(v.lines))ctx.addIssue({code:'custom',message,path:['lines']});});
export type Opportunity = z.infer<typeof opportunitySchema> & {id:string;stage:string;discovery:z.infer<typeof discoverySchema>;updated_at:string};
export type Requirement = z.infer<typeof requirementSchema> & {id:string;updated_at:string};
export type Proposal = z.infer<typeof proposalSchema> & {id:string;account_id:string;family_id:string;revision:number;number:string;status:string;requirements_snapshot:Requirement[];accepted_name:string;accepted_on:string|null;evidence:string;issued_at:string|null;updated_at:string};
export type DeliveryProject = {id:string;account_id:string;opportunity_id:string|null;proposal_id:string|null;project_kind:string;status:string;owner:string;target_on:string|null;blocker:string;scope_snapshot:string;release:string;approval_name:string;approval_on:string|null;approval_evidence:string;approval_release:string;funding_note:string;updated_at:string};
export type DeliveryTask = {id:string;account_id:string;implementation_id:string|null;title:string;phase:string;owner:string;due_on:string;completed:boolean;evidence:string;updated_at:string};
export type BetaCase = {id:string;implementation_id:string;requirement_id:string|null;title:string;actor:string;steps:string;expected:string;mandatory:boolean;updated_at:string};
export type BetaRun = {id:string;test_id:string;implementation_id:string;release:string;result:'passed'|'failed'|'blocked';actual:string;evidence:string;tester:string;created_at:string};
export type Defect = {id:string;implementation_id:string;title:string;detail:string;severity:'critical'|'high'|'medium'|'low';status:'open'|'in_progress'|'resolved'|'accepted';owner:string;due_on:string;resolution:string;retest:string;updated_at:string};
export function latestRun(runs:BetaRun[],testId:string,release:string) { return runs.filter(r=>r.test_id===testId&&r.release===release).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0]; }
export function betaReadiness(p:DeliveryProject,cases:BetaCase[],runs:BetaRun[],defects:Defect[]) { const required=cases.filter(c=>c.implementation_id===p.id&&c.mandatory);return {total:required.length,passed:required.filter(c=>latestRun(runs,c.id,p.release)?.result==='passed').length,blockers:defects.filter(d=>d.implementation_id===p.id&&d.status!=='resolved'&&(['critical','high'].includes(d.severity)||d.status!=='accepted')).length}; }
export const DEFAULT_TERMS = 'Scope changes require written approval of the scope, fee, recurring-cost and schedule impact. Customer acceptance must reference the delivered release and agreed tests. [Complete the agreed warranty, liability, dispute, and other legal terms before issuing.]';
