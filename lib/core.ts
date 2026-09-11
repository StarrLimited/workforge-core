import type { EstimateLine, PricebookItem, FieldProfile, FinancialRecord } from './field';
export const MODEL_PROFILES = {
  field: { name: 'Field', audience: 'Field service and home services', modules: ['crm', 'estimates', 'jobs', 'calendar', 'partners', 'purchasing'] },
  build: { name: 'Build', audience: 'Construction and project delivery', modules: ['crm', 'estimates', 'jobs', 'purchasing', 'changes', 'progress_billing'] },
  supply: { name: 'Supply', audience: 'Materials, distribution and logistics', modules: ['crm', 'orders', 'dispatch', 'tickets', 'reconciliation'] },
  federal: { name: 'Federal', audience: 'Government contracting', modules: ['opportunities', 'bid_decisions', 'proposals', 'sourcing', 'awards'] },
  executive: { name: 'Executive', audience: 'Portfolio and multi-company management', modules: ['portfolio', 'initiatives', 'tasks', 'calendar', 'reporting'] }
} as const;
export type Model = keyof typeof MODEL_PROFILES;
export const STAGES = ['lead','appointment','estimated','approved','scheduled','in_progress','completed','invoice_ready'] as const;
export type Stage = typeof STAGES[number];
export const STAGE_LABELS: Record<Stage,string> = { lead:'New lead', appointment:'Consultation', estimated:'Estimate ready', approved:'Approved', scheduled:'Scheduled', in_progress:'In progress', completed:'Completed', invoice_ready:'Invoice ready' };
export type Role = 'owner' | 'administrator' | 'member' | 'read_only';
export const canWrite = (role: Role) => ['owner','administrator','member'].includes(role);
export function priceForMargin(costCents: number, marginPercent: number): number {
  if (!Number.isSafeInteger(costCents) || costCents < 0) throw new Error('Cost must be a non-negative number of cents.');
  if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent >= 100) throw new Error('Margin must be between 0 and less than 100%.');
  const result = Math.ceil(costCents / (1 - marginPercent / 100) - 1e-8);
  if (!Number.isSafeInteger(result)) throw new Error('Price exceeds the supported range.');
  return result;
}
export function moneyToCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter an amount with at most two decimal places.');
  const [whole, decimals = ''] = value.trim().split('.');
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2,'0'));
  if (!Number.isSafeInteger(cents) || cents > 100000000000) throw new Error('Amount is too large.');
  return cents;
}
export const currency = (cents: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(cents/100);
export function nextStage(stage: Stage): Stage | null { return STAGES[STAGES.indexOf(stage)+1] ?? null; }
export function dateLabel(value: string | null, timeZone = 'America/Denver'): string {
  return value ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone}).format(new Date(value)) : 'Not scheduled';
}
export type Workspace = { id:string; name:string; model:Model; is_demo:boolean; timezone:string };
export type Contact = { id:string; workspace_id:string; name:string; email:string; phone:string; address:string; customer_type:string; notes:string };
export type Partner = { id:string; name:string; kind:'crew'|'subcontractor'|'vendor'; phone:string; email:string; contact_name:string; trade:string; status:'active'|'hold'|'inactive'; coi_expires:string|null; w9:boolean; agreement:boolean; notes:string };
export type WorkOrder = { id:string; workspace_id:string; number:number; title:string; contact_id:string; stage:Stage; description:string; scheduled_at:string|null; assigned_partner_id:string|null; material_cost_cents:number; labor_cost_cents:number; target_margin:number; created_at:string; updated_at:string; estimate_lines:EstimateLine[]; discount_percent:number; tax_rate:number; deposit_percent:number; terms:string; valid_until:string|null };
export type Estimate = { id:string; work_order_id:string; version:number; scope:string; labor_cost_cents:number; material_cost_cents:number; margin_percent:number; price_cents:number; status:'draft'|'approved'; approved_by:string|null; approved_at:string|null; line_items:EstimateLine[]; subtotal_cents:number; discount_cents:number; tax_cents:number; deposit_cents:number; terms:string; valid_until:string|null; customer_snapshot:{name?:string; email?:string; address?:string; company?:string} };
export type Task = { id:string; title:string; due_on:string|null; completed:boolean; work_order_id:string|null };
export type Appointment = { id:string; work_order_id:string; title:string; starts_at:string; ends_at:string };
export type Purchase = { id:string; work_order_id:string; partner_id:string; description:string; cost_cents:number; status:'planned'|'ordered'|'received'; order_kind:'materials'|'subcontract'; po_number:number; delivery_on:string|null; reference:string; notes:string };
export type Activity = { id:string; work_order_id:string|null; action:string; created_at:string; actor_id:string|null };
export type JobFile = { id:string; work_order_id:string; name:string; mime_type:string; size_bytes:number };
export type DataSet = { workspace:Workspace; role:Role; contacts:Contact[]; partners:Partner[]; orders:WorkOrder[]; estimates:Estimate[]; tasks:Task[]; appointments:Appointment[]; purchases:Purchase[]; activity:Activity[]; files:JobFile[]; pricebook:PricebookItem[]; profiles:FieldProfile[]; financials:FinancialRecord[] };
