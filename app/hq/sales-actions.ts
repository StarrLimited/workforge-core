'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { membership } from '@/lib/data';
import { canWrite } from '@/lib/core';
import { HQ_WORKSPACE_ID } from '@/lib/hq';
import { opportunitySchema, discoverySchema, requirementSchema, proposalSchema } from '@/lib/hq-sales';

const text=z.string().trim().max(20000), required=text.min(1,'Complete the required fields.');
const owner=z.enum(['Shawn','Neil']);
const day=z.union([z.literal(''),z.iso.date()]).transform(v=>v||null);
export async function saveSales(action:string, form:FormData):Promise<{ok:boolean;error?:string;id?:string}> {
  const {db,role}=await membership(HQ_WORKSPACE_ID);
  if(!canWrite(role))return {ok:false,error:'Your account has read-only access.'};
  try {
    const raw=Object.fromEntries(form);
    const input=raw.payload?JSON.parse(z.string().max(600000).parse(raw.payload)):raw;
    const update=async(table:string,values:Record<string,unknown>)=>{
      const id=z.uuid().parse(raw.id);const expected=z.iso.datetime({offset:true}).parse(raw.updated_at);
      const r=await db.from(table).update(values).eq('workspace_id',HQ_WORKSPACE_ID).eq('id',id).eq('updated_at',expected).select('id').maybeSingle();
      if(!r.error&&!r.data)throw new Error('This record changed. Refresh and reopen it before saving.');return r;
    };
    const save=(table:string,values:Record<string,unknown>)=>raw.id?update(table,values):db.from(table).insert({...values,workspace_id:HQ_WORKSPACE_ID}).select('id').single();
    let result;
    if(action==='opportunity')result=await save('hq_opportunities',opportunitySchema.parse(input));
    else if(action==='discovery')result=await update('hq_opportunities',{discovery:discoverySchema.parse(input)});
    else if(action==='requirement')result=await save('hq_requirements',requirementSchema.parse(input));
    else if(action==='proposal'){
      const values=proposalSchema.parse(input);
      const {data:o,error}=await db.from('hq_opportunities').select('account_id').eq('workspace_id',HQ_WORKSPACE_ID).eq('id',values.opportunity_id).single();
      if(error||!o)throw new Error('Opportunity not found.');
      result=await save('hq_proposals',{...values,account_id:o.account_id});
    } else if(action==='proposal_status'){
      const v=z.object({status:z.enum(['issued','accepted','declined']),accepted_name:text.max(500),accepted_on:day,evidence:text.max(10000)}).parse(input);
      result=await update('hq_proposals',v.status==='accepted'?v:{status:v.status});
    } else if(action==='revise'){
      const r=await db.rpc('hq_revise_proposal',{p_id:z.uuid().parse(raw.id)});if(r.error)throw new Error(r.error.message);revalidatePath('/hq');revalidatePath('/hq/sales');revalidatePath('/hq/agreements/[id]','page');return {ok:true,id:r.data};
    } else if(action==='project'){
      const v=z.object({status:z.enum(['onboarding','building','testing','ready','live','on_hold']),owner,target_on:day,blocker:text.max(3000),release:text.max(200),funding_note:text.max(5000),approval_name:text.max(500),approval_on:day,approval_evidence:text.max(10000),approval_release:text.max(200)}).parse(input);
      result=await update('hq_implementations',v);
    } else if(action==='delivery_task'){
      result=await update('hq_tasks',z.object({owner,due_on:z.iso.date(),evidence:text.max(10000),completed:z.boolean()}).parse(input));
    } else if(action==='beta_case'){
      result=await save('hq_beta_cases',z.object({implementation_id:z.uuid(),title:required.max(500),actor:required.max(500),steps:required,expected:required,mandatory:z.boolean()}).parse(input));
    } else if(action==='beta_run'){
      const v=z.object({test_id:z.uuid(),implementation_id:z.uuid(),release:required.max(200),result:z.enum(['passed','failed','blocked']),actual:required,evidence:required.max(10000),tester:required.max(500)}).parse(input);
      result=await db.from('hq_beta_runs').insert({...v,workspace_id:HQ_WORKSPACE_ID}).select('id').single();
    } else if(action==='defect'){
      result=await save('hq_defects',z.object({implementation_id:z.uuid(),title:required.max(500),detail:required,severity:z.enum(['critical','high','medium','low']),status:z.enum(['open','in_progress','resolved','accepted']),owner,due_on:z.iso.date(),resolution:text.max(10000),retest:text.max(10000)}).parse(input));
    } else return {ok:false,error:'Unknown action.'};
    if(result.error)throw new Error(result.error.code==='23505'?'This record already exists. Refresh to see the current agreement.':result.error.message);
    revalidatePath('/hq');revalidatePath('/hq/sales');revalidatePath('/hq/agreements/[id]','page');
    return {ok:true,id:result.data?.id};
  } catch(e){return {ok:false,error:e instanceof z.ZodError?e.issues[0]?.message:e instanceof Error?e.message:'Unable to save.'};}
}
