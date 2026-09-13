import { z } from 'zod';
import { priceForMargin, type WorkOrder, type Estimate } from '../core.ts';
import { quoteTotals, type FieldProfile, type PricebookItem } from '../field.ts';

export const AI_KINDS = ['consultation','estimate','handoff'] as const;
export type AIKind = typeof AI_KINDS[number];
export const AI_LABELS:Record<AIKind,string>={consultation:'Summarize consultation',estimate:'Draft estimate',handoff:'Prepare production handoff'};
export const draftSchema=z.object({
 summary:z.string().max(5000),scope:z.string().max(10000),notes:z.string().max(4500),
 items:z.array(z.object({product_id:z.uuid(),quantity:z.number().positive().max(100000).nullable(),quantity_evidence:z.string().max(500),description:z.string().max(3000)})).max(30),
 tasks:z.array(z.string().min(1).max(300)).max(20),questions:z.array(z.string().min(1).max(500)).max(20),
});
export type AIResult=z.infer<typeof draftSchema>;
export type AISnapshot={order:WorkOrder;profile:(FieldProfile & {consultation_summary?:string})|null;pricebook:PricebookItem[];approved_estimate:Estimate|null;tasks:{title:string;completed:boolean}[]};
export type AIDraft={id:string;workspace_id:string;work_order_id:string;kind:AIKind;status:'pending'|'ready'|'failed'|'applied';input_snapshot:AISnapshot;result:AIResult|null;reviewed_result:Review|null;error_message:string|null;created_at:string;finished_at:string|null;estimated_cost_cents:number|null};
export const reviewSchema=z.object({summary:z.string().trim().min(1).max(5000)}).or(z.object({scope:z.string().trim().min(1).max(10000),items:z.array(z.object({product_id:z.uuid(),quantity:z.number().positive().max(100000).refine(n=>Math.abs(n*1000-Math.round(n*1000))<1e-6,'Use up to three decimal places.'),description:z.string().max(3000)})).min(1).max(30)})).or(z.object({notes:z.string().trim().min(1).max(4500),tasks:z.array(z.string().trim().min(1).max(300)).max(20)}));
export type Review=z.infer<typeof reviewSchema>;

export function estimatePreview(snapshot:AISnapshot,items:{product_id:string;quantity:number|null;description:string}[]){
 const seen=new Set<string>();
 const lines=items.map((item,index)=>{
  const product=snapshot.pricebook.find(p=>p.id===item.product_id&&p.active&&p.workspace_id===snapshot.order.workspace_id);
  if(!product||seen.has(item.product_id))throw new Error('Choose unique, active pricebook items from this workspace.');
  seen.add(item.product_id);
  if(item.quantity===null)throw new Error('Confirm the quantity for each selected item.');
  return {id:`preview-${index}`,product_id:product.id,name:product.name,description:item.description,quantity:item.quantity,unit:product.unit,material_cents:product.material_cents,labor_cents:product.labor_cents,unit_price_cents:priceForMargin(product.material_cents+product.labor_cents,snapshot.order.target_margin),taxable:product.taxable};
 });
 const totals=quoteTotals(lines,snapshot.order.discount_percent,snapshot.order.tax_rate,snapshot.order.deposit_percent);
 if(totals.price_cents<=0)throw new Error('Add costs to the selected pricebook items before saving an estimate.');
 return {lines,totals};
}
export function validateDraft(kind:AIKind,result:unknown,snapshot:AISnapshot):AIResult {
 const draft=draftSchema.parse(result);
 if(kind==='consultation'&&!draft.summary.trim())throw new Error('The assistant did not produce a consultation summary.');
 if(kind==='handoff'&&!draft.notes.trim())throw new Error('The assistant did not produce a handoff.');
 if(kind==='estimate'){
  if(!draft.scope.trim())throw new Error('The assistant did not produce an estimate scope.');
  const seen=new Set<string>();
  for(const item of draft.items){
   if(seen.has(item.product_id)||!snapshot.pricebook.some(p=>p.id===item.product_id&&p.active&&p.workspace_id===snapshot.order.workspace_id))throw new Error('The assistant selected an unavailable pricebook item.');
   seen.add(item.product_id);
   if(item.quantity!==null&&Math.abs(item.quantity*1000-Math.round(item.quantity*1000))>1e-6)throw new Error('The assistant returned an unsupported quantity.');
  }
 }
 return draft;
}
