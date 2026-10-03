-- HQ-only administration. Privileged helpers always check current membership.
create function private.hq_admin_role() returns text language plpgsql stable security invoker set search_path='' as $$
declare r text;
begin
 select role into r from public.workspace_memberships where workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400' and user_id=auth.uid() and is_active;
 if auth.uid() is null or r is null or r not in ('owner','administrator') then raise exception 'HQ administrator access required.'; end if;
 return r;
end $$;
revoke all on function private.hq_admin_role() from public,anon;
grant execute on function private.hq_admin_role() to authenticated;

create function private.hq_team() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.hq_admin_role();
 return jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role,'is_active',m.is_active) order by lower(u.email)) from public.workspace_memberships m join auth.users u on u.id=m.user_id where m.workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),'[]'),
 'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,'expires_at',i.expires_at) order by i.email) from private.workspace_invitations i where i.workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400' and i.accepted_by is null),'[]'));
end $$;
create function public.hq_team() returns jsonb language sql security invoker set search_path='' as $$ select private.hq_team() $$;

create function private.hq_manage_user(p_action text,p_values jsonb) returns text language plpgsql security definer set search_path='' as $$
declare actor_role text; target_role text; target_id uuid; target_email text; desired_role text:=p_values->>'role'; w constant uuid:='8ac08858-038c-41df-90a8-4a84f25cb400';
begin
 -- Serialize administrative mutations and recheck privileges after the lock.
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 perform private.hq_admin_role();
 perform 1 from public.workspaces where id=w for update;
 actor_role:=private.hq_admin_role();
 if p_action in ('add','update') and (desired_role is null or desired_role not in ('administrator','member','read_only')) then raise exception 'Choose Administrator, Member or Read only.'; end if;
 if desired_role='administrator' and actor_role<>'owner' then raise exception 'Only the owner can appoint administrators.'; end if;
 if p_action='add' then
  target_email:=lower(btrim(p_values->>'email'));
  if target_email is null or length(target_email)>254 or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
  select id into target_id from auth.users where lower(email)=target_email and email_confirmed_at is not null;
  if target_id is not null then
   if exists(select 1 from public.workspace_memberships where workspace_id=w and user_id=target_id) then raise exception 'This person already has a user record. Edit their access below.'; end if;
   insert into public.workspace_memberships(workspace_id,user_id,role) values(w,target_id,desired_role);
   update private.workspace_invitations set accepted_by=target_id where workspace_id=w and lower(email)=target_email;
  else
   if actor_role<>'owner' and exists(select 1 from private.workspace_invitations where workspace_id=w and lower(email)=target_email and role in ('owner','administrator')) then raise exception 'Only the owner can change this invitation.'; end if;
   insert into private.workspace_invitations(workspace_id,email,role,expires_at) values(w,target_email,desired_role,now()+interval '30 days')
   on conflict(workspace_id,email) do update set role=excluded.role,expires_at=excluded.expires_at,accepted_by=null;
  end if;
 elsif p_action='update' then
  target_id:=(p_values->>'user_id')::uuid;
  select role into target_role from public.workspace_memberships where workspace_id=w and user_id=target_id;
  if target_role is null then raise exception 'User not found.'; end if;
  if target_id=auth.uid() or target_role='owner' then raise exception 'Your own access and the owner account are protected.'; end if;
  if target_role='administrator' and actor_role<>'owner' then raise exception 'Only the owner can change administrators.'; end if;
  if jsonb_typeof(p_values->'is_active') is distinct from 'boolean' then raise exception 'Choose an access status.'; end if;
  update public.workspace_memberships set role=desired_role,is_active=(p_values->>'is_active')::boolean where workspace_id=w and user_id=target_id;
 elsif p_action='revoke_invitation' then
  select role into target_role from private.workspace_invitations where id=(p_values->>'id')::uuid and workspace_id=w and accepted_by is null;
  if target_role is null then raise exception 'Invitation no longer pending. Refresh the page.'; end if;
  if target_role in ('owner','administrator') and actor_role<>'owner' then raise exception 'Only the owner can revoke this invitation.'; end if;
  delete from private.workspace_invitations where id=(p_values->>'id')::uuid and workspace_id=w and accepted_by is null;
 else raise exception 'Unknown user action.';
 end if;
 insert into public.audit_events(workspace_id,actor_id,action) values(w,auth.uid(),'HQ user access: '||p_action||' '||coalesce(target_email,target_id::text,p_values->>'id'));
 return case when p_action='add' and target_id is null then 'Access reserved for 30 days. Share the sign-in link with this person.' when p_action='add' then 'User added to WorkForge HQ.' else 'Access updated.' end;
end $$;
create function public.hq_manage_user(p_action text,p_values jsonb) returns text language sql security invoker set search_path='' as $$ select private.hq_manage_user(p_action,p_values) $$;
revoke all on function private.hq_team(),public.hq_team(),private.hq_manage_user(text,jsonb),public.hq_manage_user(text,jsonb) from public,anon;
grant execute on function private.hq_team(),public.hq_team(),private.hq_manage_user(text,jsonb),public.hq_manage_user(text,jsonb) to authenticated;

-- An optional relay for existing GHL workflows; native provider connections remain separate.
create table public.hq_lead_relays (
 provider text primary key references public.hq_ad_integrations(provider),
 workspace_id uuid not null default '8ac08858-038c-41df-90a8-4a84f25cb400' references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 enabled boolean not null default false,default_owner text not null default 'Shawn' check(default_owner in ('Shawn','Neil')),
 form_ids text[] not null default '{}',page_id text not null default '',
 last_received_at timestamptz,last_test_at timestamptz,updated_at timestamptz not null default now()
);
insert into public.hq_lead_relays(provider) values('meta'),('google_ads');
alter table public.hq_lead_relays enable row level security;
revoke all on public.hq_lead_relays from public,anon,authenticated;
grant select on public.hq_lead_relays to authenticated;
grant select,update on public.hq_lead_relays to service_role;
create policy hq_relays_read on public.hq_lead_relays for select to authenticated using(private.can_read(workspace_id));
create table private.hq_relay_keys(provider text primary key references public.hq_lead_relays(provider),key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'));
alter table private.hq_relay_keys enable row level security;
create policy hq_relay_keys_no_direct_access on private.hq_relay_keys for all to authenticated using(false) with check(false);
revoke all on private.hq_relay_keys from public,anon,authenticated;
grant select on private.hq_relay_keys to service_role;
create function private.hq_configure_relay(p_provider text,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.hq_admin_role();
 if p_provider not in ('meta','google_ads') or p_provider is null then raise exception 'Unknown source.'; end if;
 if jsonb_typeof(p_values->'enabled') is distinct from 'boolean' then raise exception 'Choose a connection status.'; end if;
 if (p_values->>'enabled')::boolean then
  if jsonb_typeof(p_values->'form_ids') is distinct from 'array' or jsonb_array_length(p_values->'form_ids')=0 or jsonb_array_length(p_values->'form_ids')>100 then raise exception 'Add allowed form IDs.'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_values->'form_ids') v where v !~ '^[a-zA-Z0-9_-]{1,100}$') then raise exception 'Invalid form ID.'; end if;
  if p_provider='meta' and coalesce(p_values->>'page_id','') !~ '^[0-9]+$' then raise exception 'Add the Facebook Page ID.'; end if;
  if coalesce(p_values->>'key_hash','')<>'' then
   insert into private.hq_relay_keys values(p_provider,p_values->>'key_hash') on conflict(provider) do update set key_hash=excluded.key_hash;
  elsif not exists(select 1 from private.hq_relay_keys where provider=p_provider) then raise exception 'Generate a connection key first.'; end if;
 end if;
 update public.hq_lead_relays set enabled=(p_values->>'enabled')::boolean,default_owner=p_values->>'default_owner',form_ids=array(select jsonb_array_elements_text(p_values->'form_ids')),page_id=coalesce(p_values->>'page_id',''),updated_at=now() where provider=p_provider;
 insert into public.audit_events(workspace_id,actor_id,action) values('8ac08858-038c-41df-90a8-4a84f25cb400',auth.uid(),'Lead relay configuration updated: '||p_provider);
end $$;
create function public.hq_configure_relay(p_provider text,p_values jsonb) returns void language sql security invoker set search_path='' as $$ select private.hq_configure_relay(p_provider,p_values) $$;
revoke all on function private.hq_configure_relay(text,jsonb),public.hq_configure_relay(text,jsonb) from public,anon;
grant execute on function private.hq_configure_relay(text,jsonb),public.hq_configure_relay(text,jsonb) to authenticated;
create function public.hq_relay_config(p_provider text) returns jsonb language sql security invoker set search_path='' as $$ select to_jsonb(c)||to_jsonb(k) from public.hq_lead_relays c join private.hq_relay_keys k using(provider) where c.provider=p_provider and c.enabled $$;
revoke all on function public.hq_relay_config(text) from public,anon,authenticated;
grant execute on function public.hq_relay_config(text) to service_role;

create function private.hq_store_ad(p_provider text,p_lead jsonb,p_owner text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.hq_ad_receipts; account uuid; s text:=p_lead->>'status';
begin
 -- Serialize a provider/form to deduplicate backfills and concurrent deliveries.
 perform pg_advisory_xact_lock(hashtextextended(p_provider||':'||(p_lead->>'form_id'),0));
 insert into public.hq_ad_receipts(provider,external_id,form_id,page_id,status,submitted_at)
 values(p_provider,p_lead->>'external_id',p_lead->>'form_id',coalesce(p_lead->>'page_id',''),'pending',coalesce((p_lead->>'submitted_at')::timestamptz,now()))
 on conflict(provider,external_id) do nothing;
 select * into r from public.hq_ad_receipts where provider=p_provider and external_id=p_lead->>'external_id' for update;
 if r.status in ('received','test') then return jsonb_build_object('status','duplicate'); end if;
 if r.form_id is distinct from p_lead->>'form_id' or r.page_id is distinct from coalesce(p_lead->>'page_id','') then raise exception 'Lead identity mismatch.'; end if;
 if s='pending' then return jsonb_build_object('status','pending'); end if;
 if s='received' then
  -- A connector backfill may lack the provider ID. Match only the same
  -- form, exact submission timestamp and contact, never email alone.
  select a.id into account from public.hq_ad_receipts prior join public.hq_accounts a on a.id=prior.account_id
  where prior.provider=p_provider and prior.form_id=p_lead->>'form_id' and prior.status='received'
   and prior.submitted_at=(p_lead->>'submitted_at')::timestamptz
   and ((nullif(p_lead->>'email','') is not null and lower(a.email)=lower(p_lead->>'email'))
    or (nullif(p_lead->>'phone','') is not null and a.phone=p_lead->>'phone')) limit 1;
  if account is null then
  insert into public.hq_accounts(workspace_id,company,contact_name,email,phone,source,owner,next_action,due_on,scope,notes)
  values('8ac08858-038c-41df-90a8-4a84f25cb400',p_lead->>'company',p_lead->>'contact_name',p_lead->>'email',p_lead->>'phone',case when p_provider='meta' then 'Meta' else 'Google Ads' end,p_owner,
  'Review ad inquiry and contact the lead',(now() at time zone 'America/Denver')::date,coalesce(p_lead->>'scope',''),coalesce(p_lead->>'notes','')) returning id into account;
  end if;
 end if;
 update public.hq_ad_receipts set status=s,account_id=account,attribution=coalesce(p_lead->'attribution','{}'),error_code=left(coalesce(p_lead->>'error_code',''),200),submitted_at=coalesce((p_lead->>'submitted_at')::timestamptz,submitted_at),updated_at=now()
 where provider=p_provider and external_id=r.external_id;
 return jsonb_build_object('status',s);
end $$;

revoke all on function private.hq_store_ad(text,jsonb,text) from public,anon,authenticated;
grant execute on function private.hq_store_ad(text,jsonb,text) to service_role;
create or replace function public.hq_receive_ad(p_provider text,p_lead jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.hq_ad_integrations; result jsonb;
begin
 select * into cfg from public.hq_ad_integrations where provider=p_provider and enabled;
 if not found then raise exception 'Connection disabled.'; end if;
 if not coalesce(p_lead->>'form_id'=any(cfg.form_ids),false) or (p_provider='meta' and p_lead->>'page_id' is distinct from cfg.page_id) then return jsonb_build_object('status','ignored'); end if;
 result:=private.hq_store_ad(p_provider,p_lead,cfg.default_owner);
 update public.hq_ad_integrations set last_received_at=case when result->>'status'='received' then now() else last_received_at end,last_test_at=case when result->>'status'='test' then now() else last_test_at end,last_error=case when result->>'status'='failed' then left(coalesce(p_lead->>'error_code','Delivery failed'),200) else '' end where provider=p_provider;
 return result;
end $$;
create function public.hq_receive_relay(p_provider text,p_lead jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.hq_lead_relays; result jsonb;
begin
 select * into cfg from public.hq_lead_relays where provider=p_provider and enabled;
 if not found then raise exception 'Connection disabled.'; end if;
 if not coalesce(p_lead->>'form_id'=any(cfg.form_ids),false) or (p_provider='meta' and p_lead->>'page_id' is distinct from cfg.page_id) then raise exception 'Form or Page not allowed.'; end if;
 if p_lead->>'status' not in ('received','test') or p_lead->>'status' is null then raise exception 'Invalid relay status.'; end if;
 result:=private.hq_store_ad(p_provider,p_lead,cfg.default_owner);
 update public.hq_lead_relays set last_received_at=case when result->>'status'='received' then now() else last_received_at end,last_test_at=case when result->>'status'='test' then now() else last_test_at end where provider=p_provider;
 return result;
end $$;
revoke all on function public.hq_receive_relay(text,jsonb) from public,anon,authenticated;
grant execute on function public.hq_receive_relay(text,jsonb) to service_role;

-- IDs verified against the WorkForge Page. Configuration remains disabled until
-- an administrator saves credentials and finishes provider-side setup.
update public.hq_ad_integrations set page_id='1288926764310636',form_ids=array['4560800667532229','1796093928178200'] where provider='meta' and not enabled and cardinality(form_ids)=0;
update public.hq_lead_relays set page_id='1288926764310636',form_ids=array['4560800667532229','1796093928178200'] where provider='meta';
