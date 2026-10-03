begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000011','owner@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000012','admin@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000013','member@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000014','outsider@example.invalid',now());
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('8ac08858-038c-41df-90a8-4a84f25cb400','10000000-0000-4000-8000-000000000011','owner'),
 ('8ac08858-038c-41df-90a8-4a84f25cb400','10000000-0000-4000-8000-000000000012','administrator'),
 ('8ac08858-038c-41df-90a8-4a84f25cb400','10000000-0000-4000-8000-000000000013','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select public.hq_manage_user('add','{"email":"new@example.invalid","role":"member"}');
select public.hq_manage_user('add','{"email":"outsider@example.invalid","role":"read_only"}');
do $$ begin
 if jsonb_array_length(public.hq_team()->'members')<4 then raise exception 'TEST: member list missing'; end if;
 begin
  perform public.hq_manage_user('update','{"user_id":"10000000-0000-4000-8000-000000000011","role":"member","is_active":false}');
  raise exception 'TEST: owner deactivated';
 exception when raise_exception then if sqlerrm not like 'Your own access%' then raise; end if; end;
end $$;
select public.hq_configure_relay('meta','{"enabled":true,"default_owner":"Shawn","page_id":"123","form_ids":["456"],"key_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000012',true);
do $$ begin
 begin
  perform public.hq_manage_user('add','{"email":"elevated@example.invalid","role":"administrator"}');
  raise exception 'TEST: admin created admin';
 exception when raise_exception then if sqlerrm not like 'Only the owner%' then raise; end if; end;
end $$;
select public.hq_manage_user('update','{"user_id":"10000000-0000-4000-8000-000000000013","role":"member","is_active":false}');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000013',true);
do $$ begin
 if private.can_read('8ac08858-038c-41df-90a8-4a84f25cb400') then raise exception 'TEST: inactive still has access'; end if;
 begin perform public.hq_team();raise exception 'TEST: non-admin read team';exception when raise_exception then if sqlerrm not like 'HQ administrator%' then raise; end if;end;
end $$;
reset role;
insert into auth.users(id,email,email_confirmed_at) values('10000000-0000-4000-8000-000000000015','new@example.invalid',now());
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000015',true);
select private.claim_invitation();
do $$ begin
 if not exists(select 1 from public.workspace_memberships where user_id='10000000-0000-4000-8000-000000000015' and role='member') then raise exception 'TEST: invitation not claimed';end if;
 if has_function_privilege('anon','public.hq_team()','execute') or has_function_privilege('authenticated','public.hq_relay_config(text)','execute') then raise exception 'TEST: privileged RPC exposed';end if;
 if has_table_privilege('authenticated','private.hq_relay_keys','select') then raise exception 'TEST: key exposed';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select public.hq_manage_user('add','{"email":"revoke@example.invalid","role":"member"}');
do $$ declare inv jsonb;begin
 select value into inv from jsonb_array_elements(public.hq_team()->'invitations') where value->>'email'='revoke@example.invalid';
 perform public.hq_manage_user('revoke_invitation',jsonb_build_object('id',inv->>'id'));
 if exists(select 1 from jsonb_array_elements(public.hq_team()->'invitations') where value->>'email'='revoke@example.invalid') then raise exception 'TEST: revoke failed';end if;
end $$;
reset role;
update public.hq_ad_integrations set enabled=true,page_id='123',form_ids=array['456'] where provider='meta';
set local role service_role;
select public.hq_receive_relay('meta','{"external_id":"backfill-fixture","form_id":"456","page_id":"123","status":"received","submitted_at":"2026-10-01T12:00:00Z","company":"Relay fixture","contact_name":"Fixture","email":"lead@example.invalid","phone":"","attribution":{"transport":"backfill"}}');
select public.hq_receive_relay('meta','{"external_id":"backfill-fixture","form_id":"456","page_id":"123","status":"received","company":"Relay fixture","contact_name":"Fixture","email":"lead@example.invalid","phone":""}');
select public.hq_receive_ad('meta','{"external_id":"provider-fixture","form_id":"456","page_id":"123","status":"received","submitted_at":"2026-10-01T12:00:00Z","company":"Relay fixture","contact_name":"Fixture","email":"lead@example.invalid","phone":""}');
select public.hq_receive_relay('meta','{"external_id":"test-fixture","form_id":"456","page_id":"123","status":"test"}');
do $$ begin
 if (select count(*) from public.hq_accounts where email='lead@example.invalid')<>1 then raise exception 'TEST: duplicate account'; end if;
 if exists(select 1 from public.hq_ad_receipts where external_id='test-fixture' and account_id is not null) then raise exception 'TEST: provider test created account';end if;
 begin perform public.hq_receive_relay('meta','{"external_id":"foreign","form_id":"789","page_id":"123","status":"test"}');raise exception 'TEST: foreign form accepted';exception when raise_exception then if sqlerrm not like 'Form or Page not allowed%' then raise;end if;end;
end $$;
reset role;
rollback;
