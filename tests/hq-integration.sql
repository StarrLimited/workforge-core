-- Run in an isolated test database after migrations. All fixture changes roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','hq-owner@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000002','hq-reader@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000003','hq-outsider@example.invalid',now());
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('8ac08858-038c-41df-90a8-4a84f25cb400','10000000-0000-4000-8000-000000000001','owner'),
 ('8ac08858-038c-41df-90a8-4a84f25cb400','10000000-0000-4000-8000-000000000002','read_only');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.hq_accounts(id,workspace_id,company,contact_name,email,owner,next_action,due_on,scope)
 values('20000000-0000-4000-8000-000000000001','8ac08858-038c-41df-90a8-4a84f25cb400','HQ integration fixture','Test contact','fixture@example.invalid','Shawn','Scope review',current_date,'Configure Field OS and train users.');
do $$ begin
 begin
  perform public.hq_set_stage('20000000-0000-4000-8000-000000000001','new','won','');
  raise exception 'TEST FAILED: won without an agreement';
 exception when raise_exception then
  if sqlerrm not like 'Add at least one agreed fee%' then raise; end if;
 end;
end; $$;
insert into public.hq_engagements(workspace_id,account_id,service,description,cadence,amount_cents,status)
 values('8ac08858-038c-41df-90a8-4a84f25cb400','20000000-0000-4000-8000-000000000001','implementation','Test implementation','one_time',250000,'agreed');
select public.hq_set_stage('20000000-0000-4000-8000-000000000001','new','won','');
select public.hq_set_stage('20000000-0000-4000-8000-000000000001','new','won','');
do $$ begin
 if (select count(*) from public.hq_implementations where account_id='20000000-0000-4000-8000-000000000001')<>1 then raise exception 'TEST FAILED: duplicate handoff'; end if;
 if (select count(*) from public.hq_tasks where account_id='20000000-0000-4000-8000-000000000001')<>6 then raise exception 'TEST FAILED: checklist count'; end if;
 begin
  update public.hq_implementations set status='live',target_on=current_date where account_id='20000000-0000-4000-8000-000000000001';
  raise exception 'TEST FAILED: launched with open tasks';
 exception when raise_exception then
  if sqlerrm not like 'Complete all implementation tasks%' then raise; end if;
 end;
 begin
  update public.hq_implementations set scope_snapshot='Changed original scope' where account_id='20000000-0000-4000-8000-000000000001';
  raise exception 'TEST FAILED: overwritten handoff';
 exception when raise_exception then
  if sqlerrm not like 'The original handoff scope is preserved%' then raise; end if;
 end;
end; $$;
update public.hq_tasks set completed=true where account_id='20000000-0000-4000-8000-000000000001';
update public.hq_implementations set status='live',target_on=current_date where account_id='20000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ declare affected int; begin
 if (select count(*) from public.hq_accounts where id='20000000-0000-4000-8000-000000000001')<>1 then raise exception 'TEST FAILED: reader cannot read'; end if;
 update public.hq_accounts set company='Unauthorized edit' where id='20000000-0000-4000-8000-000000000001';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'TEST FAILED: reader edited account'; end if;
 begin
  insert into public.hq_events(workspace_id,title,owner,starts_at,ends_at) values('8ac08858-038c-41df-90a8-4a84f25cb400','Unauthorized event','Shawn',now(),now()+interval '1 hour');
  raise exception 'TEST FAILED: reader inserted event';
 exception when insufficient_privilege then null;
 end;
end; $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
 if exists(select 1 from public.hq_accounts) then raise exception 'TEST FAILED: outsider can read HQ'; end if;
 if exists(select 1 from public.hq_engagements) then raise exception 'TEST FAILED: outsider can read fees'; end if;
 begin
  perform public.hq_set_stage('20000000-0000-4000-8000-000000000001','won','lost','No access');
  raise exception 'TEST FAILED: outsider invoked handoff';
 exception when raise_exception then
  if sqlerrm not like 'WorkForge HQ write access required%' then raise; end if;
 end;
end; $$;
reset role;
do $$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'hq_%' and c.relkind='r' and not c.relrowsecurity) then raise exception 'TEST FAILED: HQ table missing RLS'; end if;
 if has_function_privilege('anon','public.hq_set_stage(uuid,text,text,text)','execute') then raise exception 'TEST FAILED: anonymous RPC access'; end if;
end; $$;
rollback;
