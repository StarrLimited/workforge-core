-- Snapshot the rate with each draft so deployments and later model upgrades
-- cannot reprice an in-flight or historical request. USD per million tokens.
-- Rates verified 2026-09-14: https://vercel.com/ai-gateway/models/gpt-5.6-luna
-- All pre-migration requests used Astra ($10 input / $50 output).
alter table public.ai_drafts
 add column input_rate_usd_per_million numeric(12,4) not null default 10 check(input_rate_usd_per_million>=0),
 add column output_rate_usd_per_million numeric(12,4) not null default 50 check(output_rate_usd_per_million>=0),
 alter column estimated_cost_cents type numeric(16,6);
alter table public.ai_drafts
 alter column model set default 'openai/gpt-5.6-luna',
 alter column input_rate_usd_per_million set default 0.20,
 alter column output_rate_usd_per_million set default 1.20;

create function private.reserve_field_ai(w uuid,oid uuid,k text,requested_model text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 insert into public.ai_drafts(workspace_id,work_order_id,requested_by,kind,input_snapshot,model,input_rate_usd_per_million,output_rate_usd_per_million) values(w,oid,auth.uid(),k,s,requested_model,case requested_model when 'openai/gpt-5.6-luna' then 0.20 else 10 end,case requested_model when 'openai/gpt-5.6-luna' then 1.20 else 50 end) returning id into did;
 insert into private.ai_execution_keys values(did,secret);
 return jsonb_build_object('id',did,'execution_token',secret,'snapshot',s,'model',requested_model);
end $$;
create or replace function private.finish_field_ai(did uuid,secret uuid,p_result jsonb,p_raw text,p_input integer,p_output integer,p_error text) returns void language plpgsql security definer set search_path='' as $$
declare d public.ai_drafts;cost numeric;
begin
 select * into d from public.ai_drafts where id=did for update;
 if not found or auth.uid() is null or d.requested_by<>auth.uid() or not private.can_write(d.workspace_id) or not exists(select 1 from private.ai_execution_keys where draft_id=did and token=secret) then raise exception 'AI execution access denied.';end if;
 if d.status not in ('pending','failed') then raise exception 'This AI execution has already finished.';end if;
 if octet_length(coalesce(p_result::text,''))>60000 or length(coalesce(p_raw,''))>24000 or length(coalesce(p_error,''))>1000 then raise exception 'AI output exceeds the supported size.';end if;
 if p_error is null and (p_result is null or jsonb_typeof(p_result)<>'object') then raise exception 'A structured draft is required.';end if;
 if p_input is not null and p_output is not null then cost:=(p_input*d.input_rate_usd_per_million+p_output*d.output_rate_usd_per_million)/10000;end if;
 update public.ai_drafts set result=p_result,raw_output=p_raw,input_tokens=p_input,output_tokens=p_output,estimated_cost_cents=cost,budget_cost_cents=case when cost is null then budget_cost_cents else greatest(1,ceil(cost)::integer) end,status=case when p_error is null then 'ready' else 'failed' end,error_message=p_error,finished_at=now() where id=did;
 delete from private.ai_execution_keys where draft_id=did;
end $$;

-- v0.4.1 deployments still call three arguments and generate Astra. Preserve
-- their accounting during rollout or rollback. New deployments pass p_model.
create or replace function private.reserve_field_ai(w uuid,oid uuid,k text) returns jsonb language sql security definer set search_path='' as $$select private.reserve_field_ai(w,oid,k,'openai/gpt-6-astra');$$;
create function public.reserve_field_ai(p_workspace_id uuid,p_order_id uuid,p_kind text,p_model text) returns jsonb language sql security invoker set search_path='' as $$select private.reserve_field_ai(p_workspace_id,p_order_id,p_kind,p_model);$$;
revoke all on function private.reserve_field_ai(uuid,uuid,text,text),public.reserve_field_ai(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function private.reserve_field_ai(uuid,uuid,text,text),public.reserve_field_ai(uuid,uuid,text,text) to authenticated;
