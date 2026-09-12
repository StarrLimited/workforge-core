import type { DataSet, WorkOrder } from './core';

export type EstimateLine = { id:string; product_id:string|null; name:string; description:string; quantity:number; unit:string; material_cents:number; labor_cents:number; unit_price_cents:number; taxable:boolean };
export type PricebookItem = { id:string; workspace_id:string; name:string; category:string; description:string; unit:string; material_cents:number; labor_cents:number; target_margin:number; taxable:boolean; active:boolean };
export type FieldProfile = { work_order_id:string; workspace_id:string; service:string; source:string; sales_owner:string; priority:'normal'|'high'; follow_up_on:string|null; sales_status:'open'|'lost'; lost_reason:string; job_address:string; goals:string; measurements:string; access_notes:string; site_conditions:string; consultation_complete:boolean; operations_owner:string; materials_status:'not_ordered'|'ordered'|'staged'|'delivered'; walkthrough_complete:boolean; costs_reviewed:boolean; operations_notes:string };
export type FinancialRecord = { id:string; workspace_id:string; work_order_id:string; kind:'expense'|'receipt'; category:string; amount_cents:number; reference:string; occurred_on:string; notes:string; voided:boolean };
export const money = (cents:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const integer=(v:number,max:number,label:string)=>{if(!Number.isSafeInteger(v)||v<0||v>max)throw new Error(`Invalid ${label}.`);return BigInt(v);};
const round=(n:bigint,d:bigint)=>(n+d/2n)/d;
const percent=(v:number,label:string,max=100)=>{if(!Number.isFinite(v)||v<0||v>max||Math.abs(v*100-Math.round(v*100))>1e-6)throw new Error(`Invalid ${label}.`);return BigInt(Math.round(v*100));};

/** Integer arithmetic mirrors private.field_quote_totals; amounts are cents. */
export function quoteTotals(lines:EstimateLine[],discountPercent=0,taxRate=0,depositPercent=0){
  if(!Array.isArray(lines)||lines.length>200)throw new Error('An estimate supports up to 200 items.');
  const ids=new Set<string>();
  let subtotal=0n, taxable=0n, labor=0n, material=0n;
  for(const line of lines){
    if(typeof line.id!=='string'||!line.id||ids.has(line.id))throw new Error('Estimate item identifiers must be unique.');ids.add(line.id);
    if(!line.name.trim()||line.name.length>200||line.description.length>3000||!line.unit.trim()||line.unit.length>30)throw new Error('Each item needs a name and unit.');
    if(typeof line.taxable!=='boolean')throw new Error('Choose whether the item is taxable.');
    const q=integer(Math.round(line.quantity*1000),100000000,'quantity');
    if(!q||!Number.isFinite(line.quantity)||Math.abs(line.quantity*1000-Number(q))>1e-6)throw new Error('Quantity must be positive, with up to three decimal places.');
    const total=round(q*integer(line.unit_price_cents,1000000000,'unit price'),1000n);
    subtotal+=total;if(line.taxable)taxable+=total;
    labor+=round(q*integer(line.labor_cents,1000000000,'labor cost'),1000n);
    material+=round(q*integer(line.material_cents,1000000000,'material cost'),1000n);
  }
  const discountBps=percent(discountPercent,'discount',99.99),taxBps=percent(taxRate,'tax rate',30),depositBps=percent(depositPercent,'deposit');
  const discount=round(subtotal*discountBps,10000n),net=subtotal-discount;
  const tax=round(round(taxable*(10000n-discountBps),10000n)*taxBps,10000n),total=net+tax;
  if([total,labor,material].some(v=>v>100000000000n))throw new Error('Estimate exceeds the supported amount.');
  return {subtotal_cents:Number(subtotal),discount_cents:Number(discount),tax_cents:Number(tax),price_cents:Number(total),deposit_cents:Number(round(total*depositBps,10000n)),labor_cost_cents:Number(labor),material_cost_cents:Number(material),net_cents:Number(net),profit_cents:Number(net-labor-material),margin_percent:net?Number(net-labor-material)/Number(net)*100:0};
}
export function profileFor(data:DataSet,order:WorkOrder):FieldProfile {
  return data.profiles.find(p=>p.work_order_id===order.id)??{workspace_id:data.workspace.id,work_order_id:order.id,service:'',source:'Unclassified',sales_owner:'',priority:'normal',follow_up_on:null,sales_status:'open',lost_reason:'',job_address:data.contacts.find(c=>c.id===order.contact_id)?.address??'',goals:'',measurements:'',access_notes:'',site_conditions:'',consultation_complete:false,operations_owner:'',materials_status:'not_ordered',walkthrough_complete:false,costs_reviewed:false,operations_notes:''};
}
export function latestEstimate(data:DataSet,orderId:string){return data.estimates.filter(e=>e.work_order_id===orderId).sort((a,b)=>b.version-a.version)[0];}
export function jobFinancials(data:DataSet,order:WorkOrder){
  const estimate=data.estimates.find(e=>e.work_order_id===order.id&&e.status==='approved');
  const records=data.financials.filter(r=>r.work_order_id===order.id&&!r.voided);
  const expenses=records.filter(r=>r.kind==='expense').reduce((s,r)=>s+r.amount_cents,0);
  const receipts=records.filter(r=>r.kind==='receipt').reduce((s,r)=>s+r.amount_cents,0);
  const depositReceived=records.filter(r=>r.kind==='receipt'&&r.category==='deposit').reduce((s,r)=>s+r.amount_cents,0);
  const committed=data.purchases.filter(p=>p.work_order_id===order.id&&p.status!=='planned').reduce((s,p)=>s+p.cost_cents,0);
  const reviewed=profileFor(data,order).costs_reviewed;
  const net=estimate?estimate.price_cents-(estimate.tax_cents??0):0;
  return {estimate,expenses,receipts,depositReceived,committed,reviewed,net,balance:estimate?estimate.price_cents-receipts:null,profit:estimate&&reviewed?net-expenses:null};
}

export function lineAmount(quantity:number,unitCents:number){if(!Number.isFinite(quantity)||!Number.isFinite(unitCents)||quantity<0||quantity>100000||unitCents<0||unitCents>1000000000)return 0;return Number(round(BigInt(Math.round(quantity*1000))*BigInt(Math.round(unitCents)),1000n));}

export function closeoutChecks(data:DataSet, order:WorkOrder) {
  const profile=profileFor(data,order), finances=jobFinancials(data,order);
  return [
    {label:'Work completed and invoice handoff prepared',done:order.stage==='invoice_ready',tab:'production' as const},
    {label:'Customer walkthrough completed',done:profile.walkthrough_complete,tab:'production' as const},
    {label:'Job tasks and punch list completed',done:data.tasks.filter(t=>t.work_order_id===order.id).every(t=>t.completed),tab:'production' as const},
    {label:'Purchases received and production assignments completed',done:data.purchases.filter(p=>p.work_order_id===order.id).every(p=>p.status==='received'),tab:'production' as const},
    {label:'Job costs reviewed',done:profile.costs_reviewed,tab:'production' as const},
    {label:'Customer payments recorded and balance settled',done:!!finances.estimate&&finances.balance===0,tab:'financials' as const},
  ];
}
