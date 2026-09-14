import {notFound} from 'next/navigation';
import {z} from 'zod';
import {membership} from '@/lib/data';
import {HQ_WORKSPACE_ID} from '@/lib/hq';
import {DOC_FIELDS,estimateTotals,lineAmount,type Proposal,type Requirement} from '@/lib/hq-sales';
import BrandLogo from '@/components/brand-logo';
import PrintButton from '@/components/hq/print-button';
import '../../hq.css';
import '../../sales/sales.css';
export const dynamic='force-dynamic';
export const metadata={title:'Estimate & agreement | WorkForge',robots:{index:false,follow:false}};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {db}=await membership(HQ_WORKSPACE_ID);const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();
 const {data,error}=await db.from('hq_proposals').select('*').eq('workspace_id',HQ_WORKSPACE_ID).eq('id',id).maybeSingle();if(error)throw new Error('Unable to load this agreement.');if(!data)notFound();const p=data as Proposal;
 let requirements=p.requirements_snapshot;
 if(p.status==='draft'){const r=await db.from('hq_requirements').select('*').eq('workspace_id',HQ_WORKSPACE_ID).eq('opportunity_id',p.opportunity_id).neq('priority','later');if(r.error)throw new Error('Unable to load draft deliverables.');requirements=r.data as Requirement[];}
 const t=estimateTotals(p.lines);
 return <main className="agreement-page"><div className="agreement-toolbar"><a className="secondary" href={'/hq/sales?account='+p.account_id}>Back to sales & delivery</a><PrintButton/></div><article className="agreement-document"><header><BrandLogo plate/><div><p>ESTIMATE & PROJECT AGREEMENT</p><h1>{p.title}</h1><p>{p.number} · Revision {p.revision} · {p.status.toUpperCase()}</p><p>Valid through {p.valid_until}</p></div></header>{p.status==='draft'&&<p className="agreement-draft">DRAFT — terms and pricing remain subject to review. Not an issued offer.</p>}{p.document.previous_offer&&<p>Revises offer: {p.document.previous_offer}</p>}
 {DOC_FIELDS.slice(0,8).map(([k,label])=><section key={k}><h2>{label}</h2><p className="hq-preserve">{p.document[k]||'To be completed'}</p></section>)}
 <section><h2>Fees · USD</h2><table><thead><tr><th>Service / description</th><th>Quantity</th><th>Unit price</th><th>Discount</th><th>Line amount</th><th>Basis</th></tr></thead><tbody>{p.lines.map((l,i)=><tr key={i}><td>{l.description}<small>{l.service}</small></td><td>{l.quantity_units/100}</td><td>{money(l.unit_cents)}</td><td>{money(l.discount_cents)}</td><td>{money(lineAmount(l))}</td><td>{l.cadence.replaceAll('_',' ')}</td></tr>)}</tbody></table><div className="agreement-totals"><p>One-time subtotal <strong>{money(t.one_time)}</strong></p><p>One-time tax <strong>{money(p.tax_cents)}</strong></p><p>One-time total <strong>{money(t.one_time+p.tax_cents)}</strong></p><p>Initial payment toward total <strong>{money(p.deposit_cents)}</strong></p><p>Monthly charges <strong>{money(t.monthly)} / month</strong></p><p>Annual charges <strong>{money(t.annual)} / year</strong></p></div>{p.lines.some(l=>l.cadence==='usage')&&<p>Usage lines state rates for the listed quantity. Actual charges depend on consumption and the usage terms below; they are excluded from fixed totals.</p>}</section>
 <section><h2>Deliverables and acceptance criteria</h2>{requirements.map((r,i)=><div className="agreement-requirement" key={r.id}><h3>{i+1}. {r.title}</h3><p>{r.priority==='must'?'Required':'Included'} · {r.actor}</p><p className="hq-preserve"><strong>Workflow: </strong>{r.steps}</p><p className="hq-preserve"><strong>Acceptance: </strong>{r.expected}</p></div>)}</section>
 {DOC_FIELDS.slice(8).map(([k,label])=><section key={k}><h2>{label}</h2><p className="hq-preserve">{p.document[k]||'To be completed'}</p></section>)}
 <section><h2>Agreement acceptance</h2><p>The authorized representatives approve the scope, prices, payment schedule, service terms and referenced documents in this revision.</p><div className="agreement-signatures"><div><h3>Customer</h3><p>Name and title: ________________________</p><p>Signature: _____________________________</p><p>Date: __________________________________</p></div><div><h3>Provider</h3><p>Name and title: ________________________</p><p>Signature: _____________________________</p><p>Date: __________________________________</p></div></div>{p.status==='accepted'&&<p>Customer acceptance recorded for {p.accepted_name} on {p.accepted_on}. The signed source document is retained separately.</p>}</section><footer>WorkForge · {p.number} · Revision {p.revision}</footer></article></main>;
}
