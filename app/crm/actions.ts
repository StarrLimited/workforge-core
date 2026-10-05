'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { membership } from '@/lib/data';
import { canWrite, moneyToCents } from '@/lib/core';
import { parseCSV } from '@/lib/crm/logic';
const id=z.string().uuid();
const nullableId=z.union([id,z.literal(''),z.null()]).transform(v=>v||null);
const short=(max=200)=>z.string().trim().max(max);
const name=short().min(1,'A name is required.');
const email=z.union([z.email(),z.literal('')]).transform(v=>v.toLowerCase());
const person=z.object({name,email,phone:short(40),job_title:short(150),company_id:nullableId,source:short(100),lifecycle:z.enum(['lead','qualified','customer','archived']),tags:z.array(short(50)).max(20),owner_id:nullableId,do_not_contact:z.boolean()});
const company=z.object({name,website:short(500).refine(v=>!v||/^https?:\/\/[^\s]+$/i.test(v),'Use an https:// website address.'),phone:short(40),industry:short(100),address:short(500)});
const date=z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.literal(''),z.null()]).transform(v=>v||null);
const deal=z.object({title:name,pipeline_id:id,stage_id:id,contact_id:id,value:z.string().transform(moneyToCents),owner_id:nullableId,source:short(100),expected_close:date,priority:z.enum(['low','normal','high']).default('normal')});
const activity=z.object({title:short(300).min(1),contact_id:nullableId,deal_id:nullableId,owner_id:nullableId,kind:z.enum(['task','call','email','meeting']),due_at:z.iso.datetime({offset:true}),duration_minutes:z.number().int().min(5).max(1440),outcome:short(3000)});
export async function mutateCRM(workspaceId:string,operation:string,input:unknown):Promise<{ok:boolean;message:string;id?:string}> {
 id.parse(workspaceId);
 const {db,user,role}=await membership(workspaceId);
 if(!canWrite(role))return {ok:false,message:'This account has read-only access.'};
 const {data:workspace,error:workspaceError}=await db.from('workspaces').select('model').eq('id',workspaceId).single();
 if(workspaceError||workspace?.model!=='crm')return {ok:false,message:'CRM workspace access required.'};
 try {
 const raw=z.record(z.string(),z.unknown()).parse(input);
 let resultId:string|undefined;
 async function save(table:string,values:Record<string,unknown>,recordId:unknown,version?:unknown){
  const isUpdate=typeof recordId==='string'&&recordId!=='';
  let query=isUpdate?db.from(table).update(values).eq('workspace_id',workspaceId).eq('id',id.parse(recordId)):db.from(table).insert({...values,workspace_id:workspaceId});
  if(isUpdate&&(version||table==='crm_deals'))query=query.eq('updated_at',z.iso.datetime({offset:true}).parse(version));
  const {data,error}=await query.select('id').single();
  if(error){if(error.code==='23505')throw new Error('A contact with this email already exists. Open that contact to update it.');if(error.code==='PGRST116')throw new Error('This record changed or is unavailable. Refresh and try again.');throw new Error(error.message);}
  resultId=data.id;
 }
 if(operation==='contact')await save('crm_contacts',person.parse(raw),raw.id);
 else if(operation==='company')await save('crm_companies',company.parse(raw),raw.id);
 else if(operation==='deal'){
  const creating=!raw.id;
  const {value,...values}=deal.parse({...raw,contact_id:raw.contact_id||'00000000-0000-4000-8000-000000000000'});
  if(!creating)await save('crm_deals',{...values,value_cents:value},raw.id,raw.version);
  else {
   const first=z.object({contact_id:nullableId,contact_name:short().default(''),contact_email:email.default(''),contact_phone:short(40).default(''),next_title:short(300).min(1,'Enter the next activity.'),next_at:z.iso.datetime({offset:true})}).parse(raw);
   if(!first.contact_id&&!first.contact_name)throw new Error('Enter a contact name.');
   const {data,error}=await db.rpc('crm_open_opportunity',{w:workspaceId,p:{...values,...first,value_cents:value}});
   if(error)throw new Error(error.code==='23505'?'This email is already in your CRM. Choose the existing contact.':error.message);resultId=data;
  }
 }
 else if(operation==='qualification'){const parsed=z.object({need:short(5000),budget:short(1000),decision_maker:short(1000),buying_timeline:short(1000)}).parse(raw);await save('crm_deals',parsed,raw.id,raw.version);}
 else if(operation==='proposal'){const parsed=z.object({proposal_summary:short(10000),proposal_url:short(1000).refine(v=>!v||/^https?:\/\/[^\s]+$/i.test(v),'Use an https:// proposal address.'),proposal_status:z.enum(['draft','shared','accepted','declined']),proposal_sent_on:date,proposal_valid_until:date}).parse(raw);if(parsed.proposal_status==='shared'&&!parsed.proposal_sent_on)throw new Error('Enter the date the proposal was shared.');await save('crm_deals',parsed,raw.id,raw.version);}
 else if(operation==='checklist'){const parsed=z.object({completed_steps:z.array(short(500)).max(200)}).parse(raw);await save('crm_deals',parsed,raw.id,raw.version);}
 else if(operation==='touchpoint'){
  const parsed=z.object({id,version:z.iso.datetime({offset:true}),activity_id:nullableId,title:short(300).min(1),kind:z.enum(['call','email','meeting','task']),outcome:short(3000).min(1),next_title:short(300).min(1),next_kind:z.enum(['call','email','meeting','task']),next_at:z.iso.datetime({offset:true}),advance_contacted:z.boolean()}).parse(raw);
  const {id:did,version,...p}=parsed;const {error}=await db.rpc('crm_log_touchpoint',{w:workspaceId,did,expected:version,p});if(error)throw new Error(error.message);
 }
 else if(operation==='move'){const parsed=z.object({id,stage_id:id,pipeline_id:id,version:z.iso.datetime({offset:true})}).parse(raw);await save('crm_deals',{stage_id:parsed.stage_id,pipeline_id:parsed.pipeline_id},parsed.id,parsed.version);}
 else if(operation==='status'){const parsed=z.object({id,status:z.enum(['open','won','lost']),lost_reason:short(1000),version:z.iso.datetime({offset:true})}).parse(raw);if(parsed.status==='lost'&&!parsed.lost_reason)throw new Error('Please record why this deal was lost.');await save('crm_deals',{status:parsed.status,lost_reason:parsed.status==='lost'?parsed.lost_reason:''},parsed.id,parsed.version);}
 else if(operation==='activity')await save('crm_activities',activity.parse(raw),raw.id);
 else if(operation==='complete'){const parsed=z.object({id,done:z.boolean()}).parse(raw);await save('crm_activities',{completed_at:parsed.done?new Date().toISOString():null},parsed.id);}
 else if(operation==='note'){const parsed=z.object({body:short(10000).min(1),contact_id:nullableId,deal_id:nullableId}).parse(raw);await save('crm_notes',{...parsed,author_id:user.id},null);}
 else if(operation==='pipeline'){if(!['owner','administrator'].includes(role))throw new Error('Administrator access required.');const {data,error}=await db.rpc('crm_create_pipeline',{w:workspaceId,p_name:name.parse(raw.name)});if(error)throw new Error(error.message);resultId=data;}
 else if(operation==='stage'){if(!['owner','administrator'].includes(role))throw new Error('Administrator access required.');const parsed=z.object({pipeline_id:id,name:short(100).min(1),position:z.number().int().min(0).max(100),probability:z.number().int().min(0).max(100),followup_days:z.number().int().min(0).max(365).nullable(),purpose:short(1000),checklist:z.array(short(400).min(1)).max(12),stale_days:z.number().int().min(1).max(365)}).parse(raw);await save('crm_stages',parsed,raw.id);}
 else if(operation==='stage_order'){const parsed=z.object({id,direction:z.union([z.literal(-1),z.literal(1)])}).parse(raw);const {error}=await db.rpc('crm_reorder_stage',{w:workspaceId,sid:parsed.id,direction:parsed.direction});if(error)throw new Error(error.message);}
 else if(operation==='member'){const parsed=z.object({email:z.email(),role:z.enum(['member','read_only','administrator'])}).parse(raw);const {data,error}=await db.rpc('crm_add_member',{w:workspaceId,p_email:parsed.email,p_role:parsed.role});if(error)throw new Error(error.message);revalidatePath('/crm');return {ok:true,message:data};}
 else if(operation==='import'){
  const rows=parseCSV(z.string().max(500000).parse(raw.csv));
  if(!rows.length)throw new Error('The CSV has no contacts.');
  const contacts=rows.map((r,i)=>{const parsed=person.safeParse({name:r.name,email:r.email||'',phone:r.phone||'',job_title:r.job_title||'',company_id:null,source:r.source||'Import',lifecycle:'lead',tags:(r.tags||'').split(';').map(t=>t.trim()).filter(Boolean),owner_id:user.id,do_not_contact:false});if(!parsed.success)throw new Error(`Row ${i+2}: ${parsed.error.issues[0].message}`);return parsed.data;});
  const {data,error}=await db.rpc('crm_import_contacts',{w:workspaceId,rows:contacts});if(error)throw new Error(error.message);revalidatePath('/crm');return {ok:true,message:`Imported ${data.inserted} contacts; skipped ${data.skipped} duplicate emails.`};
 }else throw new Error('Unknown CRM action.');
 revalidatePath('/crm');return {ok:true,message:'Saved to your CRM.',id:resultId};
 } catch(error){return {ok:false,message:error instanceof z.ZodError?error.issues[0]?.message||'Check the form.':error instanceof Error?error.message:'Unable to save. Please retry.'};}
}
