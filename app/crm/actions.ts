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
const deal=z.object({title:name,pipeline_id:id,stage_id:id,contact_id:id,value:z.string().transform(moneyToCents),owner_id:nullableId,source:short(100),expected_close:date});
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
  if(isUpdate&&version)query=query.eq('updated_at',z.iso.datetime({offset:true}).parse(version));
  const {data,error}=await query.select('id').single();
  if(error){if(error.code==='23505')throw new Error('A contact with this email already exists. Open that contact to update it.');if(error.code==='PGRST116')throw new Error('This record changed or is unavailable. Refresh and try again.');throw new Error(error.message);}
  resultId=data.id;
 }
 if(operation==='contact')await save('crm_contacts',person.parse(raw),raw.id);
 else if(operation==='company')await save('crm_companies',company.parse(raw),raw.id);
 else if(operation==='deal'){const {value,...values}=deal.parse(raw);await save('crm_deals',{...values,value_cents:value},raw.id,raw.version);}
 else if(operation==='move'){const parsed=z.object({id,stage_id:id,pipeline_id:id,version:z.iso.datetime({offset:true})}).parse(raw);await save('crm_deals',{stage_id:parsed.stage_id,pipeline_id:parsed.pipeline_id},parsed.id,parsed.version);}
 else if(operation==='status'){const parsed=z.object({id,status:z.enum(['open','won','lost']),lost_reason:short(1000),version:z.iso.datetime({offset:true})}).parse(raw);if(parsed.status==='lost'&&!parsed.lost_reason)throw new Error('Please record why this deal was lost.');await save('crm_deals',{status:parsed.status,lost_reason:parsed.status==='lost'?parsed.lost_reason:''},parsed.id,parsed.version);}
 else if(operation==='activity')await save('crm_activities',activity.parse(raw),raw.id);
 else if(operation==='complete'){const parsed=z.object({id,done:z.boolean()}).parse(raw);await save('crm_activities',{completed_at:parsed.done?new Date().toISOString():null},parsed.id);}
 else if(operation==='note'){const parsed=z.object({body:short(10000).min(1),contact_id:nullableId,deal_id:nullableId}).parse(raw);await save('crm_notes',{...parsed,author_id:user.id},null);}
 else if(operation==='pipeline'){if(!['owner','administrator'].includes(role))throw new Error('Administrator access required.');const {data,error}=await db.rpc('crm_create_pipeline',{w:workspaceId,p_name:name.parse(raw.name)});if(error)throw new Error(error.message);resultId=data;}
 else if(operation==='stage'){if(!['owner','administrator'].includes(role))throw new Error('Administrator access required.');const parsed=z.object({pipeline_id:id,name:short(100).min(1),position:z.number().int().min(0).max(100),probability:z.number().int().min(0).max(100),followup_days:z.number().int().min(0).max(365).nullable()}).parse(raw);await save('crm_stages',parsed,raw.id);}
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
