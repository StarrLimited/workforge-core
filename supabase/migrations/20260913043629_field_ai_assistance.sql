-- Bounded, reviewable AI drafts. No AI action approves work or sends messages.
alter table public.field_profiles add column consultation_summary text not null default '' check(length(consultation_summary)<=5000);
grant insert(consultation_summary),update(consultation_summary) on public.field_profiles to authenticated;
create table public.ai_drafts (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),work_order_id uuid not null,
 requested_by uuid not null,kind text not null check(kind in ('consultation','estimate','handoff')),
 status text not null default 'pending' check(status in ('pending','ready','failed','applied')),
 model text not null default 'openai/gpt-6-astra',prompt_version text not null default 'field-v1',
 input_snapshot jsonb not null,result jsonb,reviewed_result jsonb,raw_output text,
 input_tokens integer check(input_tokens>=0),output_tokens integer check(output_tokens>=0),
 estimated_cost_cents numeric(12,4),budget_cost_cents integer not null default 100 check(budget_cost_cents>=0),
 error_message text,created_at timestamptz not null default now(),finished_at timestamptz,applied_at timestamptz,applied_by uuid,
 foreign key(workspace_id,work_order_id) references public.work_orders(workspace_id,id)
);
create index ai_drafts_job on public.ai_drafts(workspace_id,work_order_id,created_at desc);
create index ai_drafts_budget on public.ai_drafts(workspace_id,created_at);
alter table public.ai_drafts enable row level security;
create policy member_read on public.ai_drafts for select to authenticated using(private.can_read(workspace_id));
revoke all on public.ai_drafts from public,anon,authenticated;
grant select on public.ai_drafts to authenticated;
create table private.ai_execution_keys(draft_id uuid primary key references public.ai_drafts(id),token uuid not null);
revoke all on private.ai_execution_keys from public,anon,authenticated;
alter table private.ai_execution_keys enable row level security;

create function private.reserve_field_ai(w uuid,oid uuid,k text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.work_orders;p jsonb;b jsonb;e jsonb;t jsonb;s jsonb;did uuid;secret uuid:=gen_random_uuid();spent bigint;runs integer;
begin
 if auth.uid() is null or not private.can_write(w) then raise exception 'Workspace write access required.';end if;
 if k not in ('consultation','estimate','handoff') or k is null then raise exception 'Choose a supported assistant.';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text,7281));
 select * into o from public.work_orders where workspace_id=w and id=oid;
 if not found or not exists(select 1 from public.workspaces where id=w and model='field') then raise exception 'Field job not found.';end if;
 select to_jsonb(f) into p from public.field_profiles f where workspace_id=w and work_order_id=oid;
 if k='consultation' and coalesce(p->>'goals','')||coalesce(p->>'measurements','')||coalesce(p->>'access_notes','')||coalesce(p->>'site_conditions','')='' then raise exception 'Save consultation notes before requesting a summary.';end if;
 if k='estimate' and o.stage not in ('lead','appointment','estimated') then raise exception 'The accepted estimate is locked. Start a new demo job to draft another estimate.';end if;
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
 insert into public.ai_drafts(workspace_id,work_order_id,requested_by,kind,input_snapshot) values(w,oid,auth.uid(),k,s) returning id into did;
 insert into private.ai_execution_keys values(did,secret);
 return jsonb_build_object('id',did,'execution_token',secret,'snapshot',s);
end $$;
create function private.finish_field_ai(did uuid,secret uuid,p_result jsonb,p_raw text,p_input integer,p_output integer,p_error text) returns void language plpgsql security definer set search_path='' as $$
declare d public.ai_drafts;cost numeric;
begin
 select * into d from public.ai_drafts where id=did for update;
 if not found or auth.uid() is null or d.requested_by<>auth.uid() or not private.can_write(d.workspace_id) or not exists(select 1 from private.ai_execution_keys where draft_id=did and token=secret) then raise exception 'AI execution access denied.';end if;
 if d.status not in ('pending','failed') then raise exception 'This AI execution has already finished.';end if;
 if octet_length(coalesce(p_result::text,''))>60000 or length(coalesce(p_raw,''))>24000 or length(coalesce(p_error,''))>1000 then raise exception 'AI output exceeds the supported size.';end if;
 if p_error is null and (p_result is null or jsonb_typeof(p_result)<>'object') then raise exception 'A structured draft is required.';end if;
 if p_input is not null and p_output is not null then cost:=p_input*0.001+p_output*0.005;end if;
 update public.ai_drafts set result=p_result,raw_output=p_raw,input_tokens=p_input,output_tokens=p_output,estimated_cost_cents=cost,budget_cost_cents=case when cost is null then budget_cost_cents else greatest(1,ceil(cost)::integer) end,status=case when p_error is null then 'ready' else 'failed' end,error_message=p_error,finished_at=now() where id=did;
 delete from private.ai_execution_keys where draft_id=did;
end $$;
create function private.apply_field_ai(did uuid,review jsonb) returns void language plpgsql security definer set search_path='' as $$
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
  if o.stage not in ('lead','appointment','estimated') then raise exception 'The accepted estimate is locked.';end if;
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
create function public.reserve_field_ai(p_workspace_id uuid,p_order_id uuid,p_kind text) returns jsonb language sql security invoker set search_path='' as $$select private.reserve_field_ai(p_workspace_id,p_order_id,p_kind);$$;
create function public.finish_field_ai(p_id uuid,p_token uuid,p_result jsonb,p_raw text,p_input integer,p_output integer,p_error text) returns void language sql security invoker set search_path='' as $$select private.finish_field_ai(p_id,p_token,p_result,p_raw,p_input,p_output,p_error);$$;
create function public.apply_field_ai(p_id uuid,p_review jsonb) returns void language sql security invoker set search_path='' as $$select private.apply_field_ai(p_id,p_review);$$;
revoke all on function private.reserve_field_ai(uuid,uuid,text),private.finish_field_ai(uuid,uuid,jsonb,text,integer,integer,text),private.apply_field_ai(uuid,jsonb),public.reserve_field_ai(uuid,uuid,text),public.finish_field_ai(uuid,uuid,jsonb,text,integer,integer,text),public.apply_field_ai(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.reserve_field_ai(uuid,uuid,text),private.finish_field_ai(uuid,uuid,jsonb,text,integer,integer,text),private.apply_field_ai(uuid,jsonb),public.reserve_field_ai(uuid,uuid,text),public.finish_field_ai(uuid,uuid,jsonb,text,integer,integer,text),public.apply_field_ai(uuid,jsonb) to authenticated;
