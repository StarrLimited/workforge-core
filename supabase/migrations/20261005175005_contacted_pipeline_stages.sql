-- Contacted: outreach sent, awaiting a reply or discovery/consultation booking.
-- Existing records retain their current stages. Standalone CRM already includes Contacted.
alter table public.hq_accounts drop constraint hq_accounts_stage_check;
alter table public.hq_accounts add constraint hq_accounts_stage_check check(stage in ('new','contacted','discovery','blueprint','proposal','won','lost'));
alter table public.work_orders drop constraint work_orders_stage_check;
alter table public.work_orders add constraint work_orders_stage_check check(stage in ('lead','contacted','appointment','estimated','approved','scheduled','in_progress','completed','invoice_ready'));


create or replace function private.advance_order(w uuid,oid uuid,expected text,next_stage text,approver text) returns void language plpgsql security definer set search_path='' as $$
declare o public.work_orders; q public.estimate_versions; stages text[]:=array['lead','contacted','appointment','estimated','approved','scheduled','in_progress','completed','invoice_ready']; v integer; price bigint;
begin
 if auth.uid() is null or not private.can_write(w) then raise exception 'Workspace write access required.'; end if;
 select * into o from public.work_orders where id=oid and workspace_id=w for update;
 if not found then raise exception 'Work order not found.'; end if;
 if o.stage=next_stage then return; end if;
 if o.stage<>expected then raise exception 'This job has changed. Refresh before continuing.'; end if;
 -- A booked consultation can still move directly from New lead to Consultation.
 if array_position(stages,next_stage) is null or (array_position(stages,next_stage)<>array_position(stages,o.stage)+1 and not (o.stage='lead' and next_stage='appointment')) then raise exception 'Complete the preceding workflow step first.'; end if;
 if next_stage='appointment' and not exists(select 1 from public.appointments where work_order_id=oid and workspace_id=w) then raise exception 'Add a consultation appointment first.'; end if;
 if next_stage='estimated' then
  if o.labor_cost_cents+o.material_cost_cents<=0 and jsonb_array_length(o.estimate_lines)=0 then raise exception 'Enter the labor and material budget first.'; end if;
  price:=ceil((o.labor_cost_cents+o.material_cost_cents)::numeric/(1-o.target_margin/100));
  select coalesce(max(version),0)+1 into v from public.estimate_versions where work_order_id=oid;
  insert into public.estimate_versions(workspace_id,work_order_id,version,scope,labor_cost_cents,material_cost_cents,margin_percent,price_cents)
   values(w,oid,v,o.description,o.labor_cost_cents,o.material_cost_cents,o.target_margin,greatest(price,1));
 end if;
 if next_stage='approved' then
  if not exists(select 1 from public.workspaces where id=w and is_demo) then raise exception 'Customer approval integration is not enabled in this release.'; end if;
  if length(trim(approver))<2 then raise exception 'Enter the simulated approving customer name.'; end if;
  select * into q from public.estimate_versions where work_order_id=oid order by version desc limit 1;
  if q.id is null then raise exception 'An estimate is required.'; end if;
  if (q.labor_cost_cents,q.material_cost_cents,q.margin_percent,q.scope) is distinct from (o.labor_cost_cents,o.material_cost_cents,o.target_margin,o.description) then raise exception 'The estimate has changed. Generate a revised estimate before approving.'; end if;
  update public.estimate_versions set status='approved',approved_by=trim(approver),approved_at=now() where id=q.id;
 end if;
 if next_stage='scheduled' and (o.scheduled_at is null or o.assigned_partner_id is null) then raise exception 'Choose the production date and crew first.'; end if;
 if next_stage='completed' and exists(select 1 from public.tasks where work_order_id=oid and not completed) then raise exception 'Complete the open job tasks first.'; end if;
 if next_stage='invoice_ready' then
  select * into q from public.estimate_versions where work_order_id=oid and status='approved' order by version desc limit 1;
  if q.id is null then raise exception 'Approved estimate required.'; end if;
  insert into public.invoice_handoffs(workspace_id,work_order_id,estimate_id,amount_cents) values(w,oid,q.id,q.price_cents) on conflict(work_order_id) do nothing;
 end if;
 update public.work_orders set stage=next_stage where id=oid;
 insert into public.audit_events(workspace_id,work_order_id,actor_id,action) values(w,oid,auth.uid(),'Moved to '||replace(next_stage,'_',' '));
end; $$;

create or replace function private.save_budget(w uuid,oid uuid,labor bigint,materials bigint,margin numeric,scope_text text) returns void language plpgsql security definer set search_path='' as $$
declare o public.work_orders; v integer;
begin
 if auth.uid() is null or not private.can_write(w) then raise exception 'Workspace write access required.'; end if;
 select * into o from public.work_orders where workspace_id=w and id=oid for update;
 if not found then raise exception 'Work order not found.'; end if;
 if jsonb_array_length(o.estimate_lines)>0 then raise exception 'Use the itemized estimate editor for this job.';end if;
 if o.stage not in ('lead','contacted','appointment','estimated') then raise exception 'An accepted estimate is locked.'; end if;
 if labor is null or materials is null or margin is null or labor<0 or materials<0 or margin<0 or margin>=100 then raise exception 'Invalid cost or margin.'; end if;
 if o.stage='estimated' and labor+materials<=0 then raise exception 'The estimate must have a positive budget.'; end if;
 update public.work_orders set labor_cost_cents=labor,material_cost_cents=materials,target_margin=margin,description=scope_text where id=oid;
 if o.stage='estimated' then
  select coalesce(max(version),0)+1 into v from public.estimate_versions where work_order_id=oid;
  insert into public.estimate_versions(workspace_id,work_order_id,version,scope,labor_cost_cents,material_cost_cents,margin_percent,price_cents)
   values(w,oid,v,scope_text,labor,materials,margin,ceil((labor+materials)::numeric/(1-margin/100)));
 end if;
end; $$;

create or replace function private.save_itemized_estimate(w uuid,oid uuid,expected timestamptz,lines jsonb,scope_text text,margin numeric,discount numeric,tax numeric,deposit numeric,terms_text text,valid_date date) returns void language plpgsql security definer set search_path='' as $$
declare o public.work_orders;t jsonb;v integer;l jsonb;
begin
 if auth.uid() is null or not private.can_write(w) then raise exception 'Workspace write access required.';end if;
 select * into o from public.work_orders where workspace_id=w and id=oid for update;
 if not found then raise exception 'Work order not found.';end if;
 if o.stage not in ('lead','contacted','appointment','estimated') then raise exception 'The accepted estimate is locked.';end if;
 if expected is null or o.updated_at<>expected then raise exception 'This estimate changed. Refresh before saving.';end if;
 if margin is null or margin<0 or margin>=100 or length(scope_text)>10000 or length(terms_text)>10000 then raise exception 'Invalid scope, terms or margin.';end if;
 t:=private.field_quote_totals(lines,discount,tax,deposit);
 for l in select value from jsonb_array_elements(lines) loop
  if nullif(l->>'product_id','') is not null and not exists(select 1 from public.pricebook_items where id=(l->>'product_id')::uuid and workspace_id=w) then raise exception 'Pricebook item is outside this workspace.';end if;
 end loop;
 update public.work_orders set estimate_lines=lines,description=scope_text,labor_cost_cents=(t->>'labor_cost_cents')::bigint,material_cost_cents=(t->>'material_cost_cents')::bigint,target_margin=margin,discount_percent=discount,tax_rate=tax,deposit_percent=deposit,terms=terms_text,valid_until=valid_date where id=oid;
 if o.stage='estimated' then
  select coalesce(max(version),0)+1 into v from public.estimate_versions where work_order_id=oid;
  insert into public.estimate_versions(workspace_id,work_order_id,version,scope,labor_cost_cents,material_cost_cents,margin_percent,price_cents) values(w,oid,v,scope_text,(t->>'labor_cost_cents')::bigint,(t->>'material_cost_cents')::bigint,margin,(t->>'price_cents')::bigint);
 end if;
end $$;

create or replace function private.guard_field_profile() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.sales_status='lost' and exists(select 1 from public.work_orders where id=new.work_order_id and stage not in ('lead','contacted','appointment','estimated')) then raise exception 'Approved work cannot be marked as a lost lead.';end if;
 return new;
end $$;

create or replace function private.reserve_field_ai(w uuid,oid uuid,k text,requested_model text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.work_orders;p jsonb;b jsonb;e jsonb;t jsonb;s jsonb;did uuid;secret uuid:=gen_random_uuid();spent bigint;runs integer;
begin
 if auth.uid() is null or not private.can_write(w) then raise exception 'Workspace write access required.';end if;
 if requested_model is null or requested_model not in ('openai/gpt-6-astra','openai/gpt-5.6-luna') then raise exception 'Unsupported AI model.';end if;
 if k not in ('consultation','estimate','handoff') or k is null then raise exception 'Choose a supported assistant.';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text,7281));
 select * into o from public.work_orders where workspace_id=w and id=oid;
 if not found or not exists(select 1 from public.workspaces where id=w and model='field') then raise exception 'Field job not found.';end if;
 select to_jsonb(f) into p from public.field_profiles f where workspace_id=w and work_order_id=oid;
 if k='consultation' and coalesce(p->>'goals','')||coalesce(p->>'measurements','')||coalesce(p->>'access_notes','')||coalesce(p->>'site_conditions','')='' then raise exception 'Save consultation notes before requesting a summary.';end if;
 if k='estimate' and o.stage not in ('lead','contacted','appointment','estimated') then raise exception 'The accepted estimate is locked. Start a new demo job to draft another estimate.';end if;
 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') into b from public.pricebook_items i where workspace_id=w and active;
 if k='estimate' and jsonb_array_length(b)=0 then raise exception 'Add active pricebook items before drafting an estimate.';end if;
 select to_jsonb(v)-'customer_snapshot' into e from public.estimate_versions v where workspace_id=w and work_order_id=oid and status='approved' order by version desc limit 1;
 if k='handoff' and (e is null or o.stage not in ('approved','scheduled','in_progress')) then raise exception 'An approved job is required for a production handoff.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('title',title,'completed',completed) order by id),'[]') into t from public.tasks where workspace_id=w and work_order_id=oid;
 s:=jsonb_build_object('order',to_jsonb(o),'profile',p,'pricebook',case when k='estimate' then b else '[]'::jsonb end,'approved_estimate',case when k='handoff' then e else null end,'tasks',case when k='handoff' then t else '[]'::jsonb end);
 if octet_length(s::text)>160000 then raise exception 'This job is too large for an AI draft. Use the manual editor.';end if;
 -- Expired requests remain charged conservatively unless their execution finishes with usage.
 update public.ai_drafts set status='failed',error_message='The generation timed out. No job changes were made.',finished_at=now() where workspace_id=w and status='pending' and created_at<now()-interval '3 minutes';
 if exists(select 1 from public.ai_drafts where workspace_id=w and status='pending') then raise exception 'Another AI draft is running in this workspace. Check its saved history shortly.';end if;
 select coalesce(sum(budget_cost_cents),0) into spent from public.ai_drafts where workspace_id=w and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 select count(*) into runs from public.ai_drafts where workspace_id=w and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 if spent+100>1000 then raise exception 'The workspace AI budget for this month has been reached ($10 in estimated usage). Manual editing remains available.';end if;
 if runs>=20 then raise exception 'The workspace has reached its 20 AI drafts per day limit. Try again tomorrow.';end if;
 insert into public.ai_drafts(workspace_id,work_order_id,requested_by,kind,input_snapshot,model,input_rate_usd_per_million,output_rate_usd_per_million) values(w,oid,auth.uid(),k,s,requested_model,case requested_model when 'openai/gpt-5.6-luna' then 0.20 else 10 end,case requested_model when 'openai/gpt-5.6-luna' then 1.20 else 50 end) returning id into did;
 insert into private.ai_execution_keys values(did,secret);
 return jsonb_build_object('id',did,'execution_token',secret,'snapshot',s,'model',requested_model);
end $$;

create or replace function private.apply_field_ai(did uuid,review jsonb) returns void language plpgsql security definer set search_path='' as $$
declare d public.ai_drafts;o public.work_orders;p jsonb;l jsonb;i public.pricebook_items;lines jsonb:='[]';txt text;q numeric;seen uuid[]:='{}';task_text text;
begin
 select * into d from public.ai_drafts where id=did for update;
 if not found or auth.uid() is null or not private.can_write(d.workspace_id) then raise exception 'Workspace write access required.';end if;
 if d.status='applied' then return;end if;
 if d.status<>'ready' then raise exception 'Only a completed AI draft can be applied.';end if;
 if review is null or jsonb_typeof(review)<>'object' or octet_length(review::text)>60000 then raise exception 'Invalid review.';end if;
 select * into o from public.work_orders where workspace_id=d.workspace_id and id=d.work_order_id for update;
 select to_jsonb(f) into p from public.field_profiles f where workspace_id=d.workspace_id and work_order_id=d.work_order_id for update;
 if to_jsonb(o) is distinct from d.input_snapshot->'order' or coalesce(p,'null'::jsonb) is distinct from d.input_snapshot->'profile' then raise exception 'This job changed after the AI draft was created. Generate a fresh draft to avoid overwriting newer work.';end if;
 if d.kind='consultation' then
  txt:=trim(review->>'summary');if txt is null or length(txt) not between 1 and 5000 then raise exception 'Enter a consultation summary (up to 5,000 characters).';end if;
  if p is null then insert into public.field_profiles(workspace_id,work_order_id,consultation_summary) values(d.workspace_id,o.id,txt);
  else update public.field_profiles set consultation_summary=txt where work_order_id=o.id;end if;
 elsif d.kind='estimate' then
  if o.stage not in ('lead','contacted','appointment','estimated') then raise exception 'The accepted estimate is locked.';end if;
  if jsonb_typeof(review->'items') is distinct from 'array' or jsonb_array_length(review->'items') not between 1 and 30 then raise exception 'Select 1 to 30 pricebook items.';end if;
  txt:=trim(review->>'scope');if txt is null or length(txt) not between 1 and 10000 then raise exception 'Enter a scope of work.';end if;
  for l in select value from jsonb_array_elements(review->'items') loop
   select * into i from public.pricebook_items where workspace_id=d.workspace_id and id=(l->>'product_id')::uuid and active for share;
   if not found or not exists(select 1 from jsonb_array_elements(d.input_snapshot->'pricebook') b where b=to_jsonb(i)) then raise exception 'A pricebook item changed or is unavailable. Generate a fresh draft.';end if;
   if i.id=any(seen) then raise exception 'Each pricebook item can appear only once.';end if;seen:=array_append(seen,i.id);
   q:=(l->>'quantity')::numeric;if q is null or q<=0 or q>100000 or round(q,3)<>q then raise exception 'Confirm a positive quantity (up to three decimal places) for every selected item.';end if;
   if l->>'description' is null or length(l->>'description')>3000 then raise exception 'Invalid item description.';end if;
   lines:=lines||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'product_id',i.id,'name',i.name,'description',l->>'description','quantity',q,'unit',i.unit,'material_cents',i.material_cents,'labor_cents',i.labor_cents,'unit_price_cents',ceil((i.material_cents+i.labor_cents)/(1-o.target_margin/100)),'taxable',i.taxable));
  end loop;
  perform private.save_itemized_estimate(d.workspace_id,o.id,o.updated_at,lines,txt,o.target_margin,o.discount_percent,o.tax_rate,o.deposit_percent,o.terms,o.valid_until);
 else
  if o.stage not in ('approved','scheduled','in_progress') or not exists(select 1 from public.estimate_versions where id=(d.input_snapshot->'approved_estimate'->>'id')::uuid and workspace_id=d.workspace_id and status='approved') then raise exception 'The approved job is no longer available for handoff.';end if;
  txt:=trim(review->>'notes');if txt is null or length(txt) not between 1 and 4500 then raise exception 'Enter production handoff notes (up to 4,500 characters).';end if;
  txt:=concat_ws(E'\n\n',nullif(p->>'operations_notes',''),'Reviewed production handoff:'||E'\n'||txt);
  if length(txt)>5000 then raise exception 'Existing production notes plus this handoff exceed 5,000 characters. Shorten the handoff before saving.';end if;
  if jsonb_typeof(review->'tasks') is distinct from 'array' or jsonb_array_length(review->'tasks')>20 then raise exception 'Select up to 20 tasks.';end if;
  if p is null then insert into public.field_profiles(workspace_id,work_order_id,operations_notes) values(d.workspace_id,o.id,txt);
  else update public.field_profiles set operations_notes=txt where work_order_id=o.id;end if;
  for task_text in select jsonb_array_elements_text(review->'tasks') loop
   task_text:=trim(task_text);if length(task_text) not between 1 and 300 then raise exception 'Task titles must be 1 to 300 characters.';end if;
   insert into public.tasks(workspace_id,work_order_id,title) select d.workspace_id,o.id,task_text where not exists(select 1 from public.tasks where workspace_id=d.workspace_id and work_order_id=o.id and lower(trim(title))=lower(task_text));
  end loop;
 end if;
 update public.ai_drafts set status='applied',reviewed_result=review,applied_at=now(),applied_by=auth.uid() where id=did;
 insert into public.audit_events(workspace_id,work_order_id,actor_id,action) values(d.workspace_id,o.id,auth.uid(),'Reviewed AI '||d.kind||' draft applied');
end $$;
