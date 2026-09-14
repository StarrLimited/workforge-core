import { membership } from './data';
import { HQ_WORKSPACE_ID } from './hq';
import type { Opportunity, Requirement, Proposal, DeliveryProject, DeliveryTask, BetaCase, BetaRun, Defect } from './hq-sales';
export type SalesData={opportunities:Opportunity[];requirements:Requirement[];proposals:Proposal[];projects:DeliveryProject[];tasks:DeliveryTask[];cases:BetaCase[];runs:BetaRun[];defects:Defect[]};
export async function loadSales():Promise<SalesData>{
  const {db}=await membership(HQ_WORKSPACE_ID);
  const names=['hq_opportunities','hq_requirements','hq_proposals','hq_implementations','hq_tasks','hq_beta_cases','hq_beta_runs','hq_defects'];
  const results=await Promise.all(names.map(name=>db.from(name).select('*').eq('workspace_id',HQ_WORKSPACE_ID).order(name==='hq_beta_runs'?'created_at':'updated_at',{ascending:false}).limit(1000)));
  if(results.some(r=>r.error))throw new Error('Sales & delivery could not load. Please retry.');
  if(results.some(r=>r.data?.length===1000))throw new Error('Sales & delivery needs pagination before more records can be shown. Contact your administrator.');
  return Object.fromEntries(['opportunities','requirements','proposals','projects','tasks','cases','runs','defects'].map((key,i)=>[key,results[i].data])) as SalesData;
}
