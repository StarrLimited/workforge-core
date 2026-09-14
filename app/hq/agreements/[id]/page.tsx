import {notFound} from 'next/navigation';
import {z} from 'zod';
import {membership} from '@/lib/data';
import {HQ_WORKSPACE_ID} from '@/lib/hq';
import {DOC_FIELDS,estimateTotals,lineAmount,type Proposal,type Requirement} from '@/lib/hq-sales';
import AgreementDocument from '@/components/hq/agreement-document';
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
 const signatures=await db.from('hq_signatures').select('*').eq('proposal_id',p.id).eq('workspace_id',HQ_WORKSPACE_ID);if(signatures.error)throw new Error('Unable to load signatures.');
 return <main className="agreement-page"><div className="agreement-toolbar"><a className="secondary" href={'/hq/sales?account='+p.account_id}>Back to sales & delivery</a><PrintButton/></div><AgreementDocument proposal={p} requirements={requirements} signatures={signatures.data}/></main>;
}
