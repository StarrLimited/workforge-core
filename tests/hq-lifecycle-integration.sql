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
select public.hq_configure_ads('google_ads',jsonb_build_object('enabled',true,'default_owner','Neil','form_ids',jsonb_build_array('123'),'key_hash',repeat('a',64)));
select public.hq_configure_ads('meta',jsonb_build_object('enabled',true,'default_owner','Shawn','form_ids',jsonb_build_array('123'),'page_id','456','key_hash',repeat('b',64),'app_secret','fixture','page_token','fixture','graph_version','v25.0'));
set local role service_role;
select public.hq_receive_ad('google_ads','{"external_id":"lifecycle-fixture","form_id":"123","status":"received","company":"Lifecycle fixture","contact_name":"Test","phone":"+13035550100","email":"test@example.invalid","notes":"Campaign fixture","attribution":{"campaign_id":"789"}}');
select public.hq_receive_ad('google_ads','{"external_id":"lifecycle-fixture","form_id":"123","status":"received","company":"Duplicate","contact_name":"Test","phone":"+13035550100","email":"test@example.invalid"}');
select public.hq_receive_ad('google_ads','{"external_id":"provider-test","form_id":"123","status":"test"}');
select public.hq_receive_ad('meta','{"external_id":"meta-fixture","form_id":"123","page_id":"456","status":"pending"}');
select public.hq_receive_ad('meta','{"external_id":"meta-fixture","form_id":"123","page_id":"456","status":"failed","error_code":"meta_fetch_401"}');
select public.hq_receive_ad('meta','{"external_id":"meta-fixture","form_id":"123","page_id":"456","status":"received","company":"Meta fixture","contact_name":"Test","phone":"+13035550101","email":""}');
set local role authenticated;
do $$ declare a uuid; p uuid; n int; begin
 select account_id into a from public.hq_ad_receipts where external_id='lifecycle-fixture';
 if (select count(*) from public.hq_accounts where company='Lifecycle fixture')<>1 then raise exception 'TEST FAILED: delivery not deduplicated'; end if;
 if exists(select 1 from public.hq_accounts where company='Duplicate') then raise exception 'TEST FAILED: duplicate account'; end if;
 if (select account_id from public.hq_ad_receipts where external_id='provider-test') is not null then raise exception 'TEST FAILED: test in sales pipeline'; end if;
 if (select status from public.hq_ad_receipts where external_id='meta-fixture')<>'received' then raise exception 'TEST FAILED: failed retry not recovered'; end if;
 if (select owner from public.hq_accounts where id=a)<>'Neil' then raise exception 'TEST FAILED: routing'; end if;
 update public.hq_accounts set scope='Configure, migrate, train and support.' where id=a;
 insert into public.hq_engagements(workspace_id,account_id,service,description,cadence,amount_cents,status) values('8ac08858-038c-41df-90a8-4a84f25cb400',a,'implementation','Fixture agreement','one_time',200000,'agreed');
 perform public.hq_set_stage(a,'new','discovery','');
 perform public.hq_set_stage(a,'discovery','proposal','');
 perform public.hq_set_stage(a,'proposal','won','');
 perform public.hq_set_stage(a,'proposal','won','');
 select id into p from public.hq_implementations where account_id=a;
 if (select count(*) from public.hq_tasks where implementation_id=p)<>6 then raise exception 'TEST FAILED: handoff tasks'; end if;
 update public.hq_tasks set completed=true where implementation_id=p;
 begin
  update public.hq_implementations set status='live',target_on=current_date where id=p;
  raise exception 'TEST FAILED: launched without support';
 exception when raise_exception then if sqlerrm not like 'Record the support owner%' then raise; end if; end;
 insert into public.hq_support_plans(workspace_id,account_id,owner,terms,next_review_on) values('8ac08858-038c-41df-90a8-4a84f25cb400',a,'Neil','Support by email, response within agreed business hours.',current_date+7);
 update public.hq_implementations set status='live',target_on=current_date where id=p;
 update public.hq_implementations set status='live' where id=p;
 if (select count(*) from public.hq_tasks where account_id=a and implementation_id is null and title='Post-launch customer check-in')<>1 then raise exception 'TEST FAILED: post-launch task is not idempotent'; end if;
 if (select launched_at from public.hq_support_plans where account_id=a) is null then raise exception 'TEST FAILED: support not activated'; end if;
 insert into public.hq_subscriptions(workspace_id,account_id,plan,service,cadence,amount_cents,status,starts_on,renews_on) values('8ac08858-038c-41df-90a8-4a84f25cb400',a,'Field OS','software','monthly',29900,'active',current_date,current_date+30);
 insert into public.hq_tickets(workspace_id,account_id,title,priority,owner,response_due_at) values('8ac08858-038c-41df-90a8-4a84f25cb400',a,'Login assistance','high','Neil',now()+interval '4 hours');
 begin
  update public.hq_tickets set status='resolved' where account_id=a;
  raise exception 'TEST FAILED: resolved without notes';
 exception when raise_exception then if sqlerrm not like 'Record the resolution%' then raise; end if; end;
 update public.hq_tickets set status='resolved',resolution='Confirmed customer can sign in.',first_response_at=now() where account_id=a;
 if (select resolved_at from public.hq_tickets where account_id=a) is null then raise exception 'TEST FAILED: no resolution timestamp'; end if;
 update public.hq_tickets set status='open' where account_id=a;
 if (select resolved_at from public.hq_tickets where account_id=a) is not null then raise exception 'TEST FAILED: reopened ticket remains resolved'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ declare n int; begin
 update public.hq_tickets set title='Unauthorized'; get diagnostics n=row_count; if n<>0 then raise exception 'TEST FAILED: read-only modified ticket'; end if;
 begin perform public.hq_configure_ads('google_ads','{}'); raise exception 'TEST FAILED: reader configured secrets'; exception when raise_exception then if sqlerrm not like 'HQ administrator%' then raise; end if; end;
 begin perform public.hq_ad_config('meta'); raise exception 'TEST FAILED: credentials exposed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
 if exists(select 1 from public.hq_tickets) or exists(select 1 from public.hq_subscriptions) or exists(select 1 from public.hq_support_plans) or exists(select 1 from public.hq_ad_receipts) or exists(select 1 from public.hq_ad_integrations) then raise exception 'TEST FAILED: outsider can read HQ lifecycle data'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.hq_receive_ad(text,jsonb)','execute') or has_function_privilege('authenticated','public.hq_ad_config(text)','execute') then raise exception 'TEST FAILED: service RPC exposed'; end if;
 if has_table_privilege('authenticated','private.hq_ad_credentials','select') then raise exception 'TEST FAILED: secrets exposed'; end if;
end $$;
rollback;
