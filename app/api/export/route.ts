import { NextRequest } from 'next/server';
import { loadWorkspace, membership } from '@/lib/data';
import { STAGE_LABELS } from '@/lib/core';
const csv=(v:unknown)=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export async function GET(request:NextRequest){
  const id=request.nextUrl.searchParams.get('workspace');if(!id)return new Response('Workspace required',{status:400});
  try{
    const d=await loadWorkspace(id);let lines:unknown[][];let filename='workforge-work-orders.csv';
    if(request.nextUrl.searchParams.get('kind')==='invoices'){
      const {db}=await membership(id);let query=db.from('invoice_handoffs').select('*').eq('workspace_id',id);
      const order=request.nextUrl.searchParams.get('order');if(order)query=query.eq('work_order_id',order);
      const {data,error}=await query;if(error)throw error;
      lines=[['Handoff ID','Reference','Customer','Scope','Amount USD','Handoff status','Data source'],...(data??[]).map(h=>{const o=d.orders.find(o=>o.id===h.work_order_id);const q=d.estimates.find(e=>e.id===h.estimate_id);return[h.id,o?`WF-${o.number}`:'',d.contacts.find(c=>c.id===o?.contact_id)?.name,q?.scope??o?.description,h.amount_cents/100,h.status,d.workspace.is_demo?'Fictional demonstration':'Workspace records'];})];
      filename='workforge-invoice-handoff.csv';
    }else{
      lines=[['Reference','Job','Customer','Stage','Approved estimate USD','Scheduled','Data source'],...d.orders.map(o=>{const q=d.estimates.find(e=>e.work_order_id===o.id&&e.status==='approved');return [`WF-${o.number}`,o.title,d.contacts.find(c=>c.id===o.contact_id)?.name,STAGE_LABELS[o.stage],q?q.price_cents/100:'',o.scheduled_at??'',d.workspace.is_demo?'Fictional demonstration':'Workspace records'];})];
    }
    return new Response(lines.map(row=>row.map(csv).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, no-store'}});
  }catch{return new Response('Unable to export this workspace.',{status:403});}
}
