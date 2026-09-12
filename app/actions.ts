'use server';
import { revalidatePath } from 'next/cache';
import { membership, session } from '@/lib/data';
import { canWrite, moneyToCents, STAGES, type Stage } from '@/lib/core';
import { quoteTotals, type EstimateLine } from '@/lib/field';
export type ActionResult = { ok:boolean; error?:string; id?:string };
const field = (f:FormData,key:string,max=3000) => { const x=String(f.get(key)??'').trim(); if(x.length>max)throw new Error(`${key} is too long.`); return x; };
const required = (f:FormData,key:string,max=3000) => {const x=field(f,key,max);if(!x)throw new Error(`Please enter ${key.replaceAll('_',' ')}.`);return x;};
const date = (value:string) => {const d=new Date(value);if(!value||Number.isNaN(d.getTime()))throw new Error('Please enter a valid date and time.');return d.toISOString();};
function fail(error:unknown):ActionResult { return {ok:false,error:error instanceof Error?error.message:'Unable to save. Please retry.'}; }
export async function mutate(workspaceId:string,action:string,form:FormData):Promise<ActionResult> {
  try {
    const {db,role} = await membership(workspaceId);
    if(!canWrite(role))throw new Error('This workspace is read only for your account.');
    const orderId=field(form,'work_order_id',100);
    let id:string|undefined;
    if(action==='demo_copy') {
      const {data,error}=await db.rpc('copy_demo_field_job',{p_workspace_id:workspaceId,p_order_id:orderId});if(error)throw new Error(error.message);id=String(data);
    } else if(action==='customer_job') {
      const {data,error}=await db.rpc('create_customer_job',{p_workspace_id:workspaceId,p_contact_id:required(form,'contact_id',100),p_title:required(form,'title',200),p_scope:field(form,'description',5000)});if(error)throw new Error(error.message);id=String(data);
    } else if(action==='field_estimate') {
      const lines=JSON.parse(required(form,'lines',200000)) as EstimateLine[];
      const discount=Number(required(form,'discount_percent')),tax=Number(required(form,'tax_rate')),deposit=Number(required(form,'deposit_percent')),margin=Number(required(form,'target_margin'));
      quoteTotals(lines,discount,tax,deposit);
      const {error}=await db.rpc('save_and_prepare_field_estimate',{p_workspace_id:workspaceId,p_order_id:orderId,p_expected:required(form,'expected_updated_at'),p_lines:lines,p_scope:field(form,'description',10000),p_margin:margin,p_discount:discount,p_tax:tax,p_deposit:deposit,p_terms:field(form,'terms',10000),p_valid_until:field(form,'valid_until')||null});if(error)throw new Error(error.message);
    } else if(['qualification','consultation','operations'].includes(action)) {
      const values:Record<string,string|boolean|null>={};
      const keys=action==='qualification'?['service','source','sales_owner','priority','follow_up_on','sales_status','lost_reason','job_address']:action==='consultation'?['goals','measurements','access_notes','site_conditions','consultation_complete']:['operations_owner','materials_status','walkthrough_complete','costs_reviewed','operations_notes'];
      for(const key of keys) values[key]=['consultation_complete','walkthrough_complete','costs_reviewed'].includes(key)?field(form,key)==='on':key==='follow_up_on'?(field(form,key)||null):field(form,key,5000);
      const {data:existing,error:readError}=await db.from('field_profiles').select('work_order_id').eq('workspace_id',workspaceId).eq('work_order_id',orderId).maybeSingle();if(readError)throw new Error(readError.message);
      const result=existing?await db.from('field_profiles').update(values).eq('workspace_id',workspaceId).eq('work_order_id',orderId).select('work_order_id').single():await db.from('field_profiles').insert({workspace_id:workspaceId,work_order_id:orderId,...values});if(result.error)throw new Error(result.error.message);
    } else if(action==='pricebook') {
      const values={name:required(form,'name',200),category:required(form,'category',100),description:field(form,'description',3000),unit:required(form,'unit',30),material_cents:moneyToCents(required(form,'material_cost')),labor_cents:moneyToCents(required(form,'labor_cost')),target_margin:Number(required(form,'target_margin')),taxable:field(form,'taxable')==='on',active:field(form,'active')==='on'};
      const itemId=field(form,'id',100);const result=itemId?await db.from('pricebook_items').update(values).eq('workspace_id',workspaceId).eq('id',itemId).select('id').single():await db.from('pricebook_items').insert({workspace_id:workspaceId,...values});if(result.error)throw new Error(result.error.message);
    } else if(action==='edit_contact') {
      const email=field(form,'email',254);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Please enter a valid email address.');
      const {error}=await db.from('contacts').update({name:required(form,'name',200),email,phone:field(form,'phone',40),address:field(form,'address',400),customer_type:required(form,'customer_type',100),notes:field(form,'notes',5000)}).eq('workspace_id',workspaceId).eq('id',required(form,'id',100)).select('id').single();if(error)throw new Error(error.message);
    } else if(action==='edit_partner') {
      const coverage=form.has('primary_region')?{primary_region:field(form,'primary_region',200),coverage_area:field(form,'coverage_area',2000)}:{};
      const {error}=await db.from('partners').update({name:required(form,'name',200),phone:field(form,'phone',40),email:field(form,'email',254),contact_name:field(form,'contact_name',200),trade:field(form,'trade',200),status:required(form,'status'),coi_expires:field(form,'coi_expires')||null,w9:field(form,'w9')==='on',agreement:field(form,'agreement')==='on',notes:field(form,'notes',5000),...coverage}).eq('workspace_id',workspaceId).eq('id',required(form,'id',100)).select('id').single();if(error)throw new Error(error.message);
    } else if(action==='partner_location') {
      const values={name:required(form,'name',200),address:required(form,'address',400),city:field(form,'city',100),region:field(form,'region',100),postal_code:field(form,'postal_code',20),contact_name:field(form,'contact_name',200),phone:field(form,'phone',40),notes:field(form,'notes',2000)};
      const locationId=field(form,'id',100),partnerId=required(form,'partner_id',100);
      const result=locationId?await db.from('partner_locations').update(values).eq('workspace_id',workspaceId).eq('partner_id',partnerId).eq('id',locationId).select('id').single():await db.from('partner_locations').insert({workspace_id:workspaceId,partner_id:partnerId,...values}).select('id').single();
      if(result.error)throw new Error(result.error.message);
    } else if(action==='remove_partner_location') {
      const {error}=await db.from('partner_locations').delete().eq('workspace_id',workspaceId).eq('partner_id',required(form,'partner_id',100)).eq('id',required(form,'id',100)).select('id').single();if(error)throw new Error(error.message);
    } else if(action==='financial') {
      const {error}=await db.from('financial_records').insert({workspace_id:workspaceId,work_order_id:orderId,kind:required(form,'kind'),category:required(form,'category'),amount_cents:moneyToCents(required(form,'amount')),reference:required(form,'reference',200),occurred_on:required(form,'occurred_on'),notes:field(form,'notes',5000)});if(error)throw new Error(error.code==='23505'?'That reference is already recorded for this job. Use the existing entry or a distinct reference.':error.message);
    } else if(action==='void_financial') {
      const {error}=await db.from('financial_records').update({voided:true}).eq('workspace_id',workspaceId).eq('id',required(form,'id',100)).select('id').single();if(error)throw new Error(error.message);
    } else if(action==='lead') {
      const {data,error}=await db.rpc('create_field_lead',{p_workspace_id:workspaceId,p_contact_name:required(form,'contact_name',200),p_email:field(form,'email',254),p_phone:field(form,'phone',40),p_address:field(form,'address',400),p_title:required(form,'title',200),p_description:field(form,'description')});
      if(error)throw new Error(error.message); id=String(data);
    } else if(action==='contact') {
      const email=field(form,'email',254);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Please enter a valid email address.');
      const {error}=await db.from('contacts').insert({workspace_id:workspaceId,name:required(form,'name',200),email,phone:field(form,'phone',40),address:field(form,'address',400)}); if(error)throw new Error(error.message);
    } else if(action==='partner') {
      const kind=field(form,'kind');if(!['crew','subcontractor','vendor'].includes(kind))throw new Error('Select a partner type.');
      const {error}=await db.from('partners').insert({workspace_id:workspaceId,name:required(form,'name',200),kind,phone:field(form,'phone',40)});if(error)throw new Error(error.message);
    } else if(action==='appointment') {
      const start=date(required(form,'starts_at')); const end=date(required(form,'ends_at'));if(end<=start)throw new Error('The end must be after the start.');
      const {error}=await db.from('appointments').insert({workspace_id:workspaceId,work_order_id:orderId,title:required(form,'title',200),starts_at:start,ends_at:end});if(error)throw new Error(error.message);
    } else if(action==='costs') {
      const margin=Number(required(form,'target_margin'));if(!Number.isFinite(margin)||margin<0||margin>=100)throw new Error('Margin must be between 0 and less than 100%.');
      const {error}=await db.rpc('save_field_budget',{p_workspace_id:workspaceId,p_order_id:orderId,p_labor:moneyToCents(required(form,'labor_cost')),p_materials:moneyToCents(required(form,'material_cost')),p_margin:margin,p_scope:field(form,'description')});if(error)throw new Error(error.message);
    } else if(action==='advance') {
      const expected=field(form,'expected_stage') as Stage; const next=field(form,'next_stage') as Stage;
      if(!STAGES.includes(expected)||!STAGES.includes(next))throw new Error('Invalid workflow stage.');
      const {error}=await db.rpc('advance_field_order',{p_workspace_id:workspaceId,p_order_id:orderId,p_expected:expected,p_next:next,p_approver:field(form,'approver',200)});if(error)throw new Error(error.message);
    } else if(action==='schedule') {
      const {error}=await db.rpc('schedule_field_order',{p_workspace_id:workspaceId,p_order_id:orderId,p_starts_at:date(required(form,'scheduled_at')),p_partner_id:required(form,'partner_id',100)});if(error)throw new Error(error.message);
    } else if(action==='task') {
      const due=field(form,'due_on');if(due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))throw new Error('Invalid due date.');
      const {error}=await db.from('tasks').insert({workspace_id:workspaceId,title:required(form,'title',300),due_on:due||null,work_order_id:orderId||null});if(error)throw new Error(error.message);
    } else if(action==='toggle_task') {
      const {error}=await db.from('tasks').update({completed:field(form,'completed')==='true'}).eq('workspace_id',workspaceId).eq('id',required(form,'id',100)).select('id').single();if(error)throw new Error(error.message);
    } else if(action==='purchase') {
      const {error}=await db.from('purchase_orders').insert({workspace_id:workspaceId,work_order_id:orderId,partner_id:required(form,'partner_id',100),description:required(form,'description',500),cost_cents:moneyToCents(required(form,'cost')),order_kind:field(form,'order_kind')||'materials',delivery_on:field(form,'delivery_on')||null,reference:field(form,'reference',200),notes:field(form,'notes',5000)});if(error)throw new Error(error.message);
    } else if(action==='purchase_status') {
      const status=field(form,'status');if(!['planned','ordered','received'].includes(status))throw new Error('Invalid purchase status.');
      const {error}=await db.from('purchase_orders').update({status}).eq('workspace_id',workspaceId).eq('id',required(form,'id',100)).select('id').single();if(error)throw new Error(error.message);
    } else if(action==='upload') {
      const file=form.get('file');
      if(!(file instanceof File)||file.size<1||file.size>3145728)throw new Error('Choose a file of 3 MB or less.');
      const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
      if(!extensions[file.type])throw new Error('Choose a JPEG, PNG, WebP or PDF file.');
      const objectPath=`${workspaceId}/${orderId}/${crypto.randomUUID()}.${extensions[file.type]}`;
      const {error:uploadError}=await db.storage.from('workforge-files').upload(objectPath,file,{contentType:file.type,upsert:false});
      if(uploadError)throw new Error('Unable to upload the file. Please retry.');
      const {error:recordError}=await db.from('file_records').insert({workspace_id:workspaceId,work_order_id:orderId,name:file.name.slice(0,200),object_path:objectPath,mime_type:file.type,size_bytes:file.size});
      if(recordError){await db.storage.from('workforge-files').remove([objectPath]);throw new Error('Unable to save the file record. Please retry.');}
    } else throw new Error('This action is not available.');
    revalidatePath('/'); return {ok:true,id};
  } catch(error) {return fail(error);}
}
export async function signOut() {const {db}=await session();await db.auth.signOut();revalidatePath('/');}
