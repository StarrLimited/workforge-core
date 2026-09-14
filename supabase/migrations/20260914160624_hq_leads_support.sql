-- Complete the internal lead → implementation → support handoff.
create table public.hq_support_plans (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 account_id uuid not null unique, owner text not null check(owner in ('Shawn','Neil')),
 terms text not null check(length(trim(terms)) between 1 and 5000),
 next_review_on date not null, launched_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,account_id) references public.hq_accounts(workspace_id,id)
);
create table public.hq_tickets (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 account_id uuid not null, title text not null check(length(trim(title)) between 1 and 300),
 description text not null default '' check(length(description)<=20000),
 priority text not null check(priority in ('urgent','high','normal','low')),
 status text not null default 'open' check(status in ('open','in_progress','waiting_customer','resolved')),
 owner text not null check(owner in ('Shawn','Neil')), response_due_at timestamptz not null,
 first_response_at timestamptz, resolution text not null default '' check(length(resolution)<=10000), resolved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,account_id) references public.hq_accounts(workspace_id,id)
);
create table public.hq_subscriptions (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 account_id uuid not null, plan text not null check(length(trim(plan)) between 1 and 200),
 service text not null check(service in ('software','support')),
 cadence text not null check(cadence in ('monthly','annual')), amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 status text not null check(status in ('pending','trial','active','paused','cancelled')),
 starts_on date not null, renews_on date not null, ends_on date,
 payment_status text not null default 'unknown' check(payment_status in ('unknown','current','past_due')),
 notes text not null default '' check(length(notes)<=10000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(renews_on>starts_on), check(ends_on is null or ends_on>=starts_on),
 check(status<>'cancelled' or ends_on is not null),
 foreign key(workspace_id,account_id) references public.hq_accounts(workspace_id,id)
);
do $$ declare t text; begin
 foreach t in array array['hq_support_plans','hq_tickets','hq_subscriptions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('create policy hq_read on public.%I for select to authenticated using(private.can_read(workspace_id))',t);
  execute format('create policy hq_insert on public.%I for insert to authenticated with check(private.can_write(workspace_id))',t);
  execute format('create policy hq_update on public.%I for update to authenticated using(private.can_write(workspace_id)) with check(private.can_write(workspace_id))',t);
  execute format('create index %I on public.%I(workspace_id,account_id)',t||'_account',t);
  execute format('create trigger hq_validate before insert or update on public.%I for each row execute function private.hq_validate_change()',t);
  execute format('create trigger hq_audit before insert or update on public.%I for each row execute function private.audit_change()',t);
 end loop;
end $$;

-- Additional gates apply at the database boundary, including direct API writes.
create function private.hq_lifecycle_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and old.account_id is distinct from new.account_id then raise exception 'The linked account cannot be changed.'; end if;
 if tg_table_name='hq_tickets' then
  if new.status='resolved' then
   if length(trim(new.resolution))=0 then raise exception 'Record the resolution before closing this ticket.'; end if;
   new.resolved_at:=coalesce(new.resolved_at,now());
  else new.resolved_at:=null; end if;
 elsif tg_table_name='hq_implementations' then
  if new.status='live' and not exists(select 1 from public.hq_support_plans where account_id=new.account_id) then
   raise exception 'Record the support owner, terms and first review date before going live.';
  end if;
 elsif tg_table_name='hq_subscriptions' then
  if not exists(select 1 from public.hq_accounts where id=new.account_id and stage='won') then raise exception 'Subscriptions require a won customer account.'; end if;
 end if;
 return new;
end $$;
create trigger hq_lifecycle before insert or update on public.hq_tickets for each row execute function private.hq_lifecycle_guard();
create trigger hq_lifecycle before insert or update on public.hq_subscriptions for each row execute function private.hq_lifecycle_guard();
create trigger hq_lifecycle before insert or update on public.hq_support_plans for each row execute function private.hq_lifecycle_guard();
create trigger hq_zz_lifecycle before insert or update on public.hq_implementations for each row execute function private.hq_lifecycle_guard();

create function private.hq_launch_support() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.hq_support_plans;
begin
 if new.status='live' and old.status<>'live' then
  update public.hq_support_plans set launched_at=now() where account_id=new.account_id and launched_at is null returning * into p;
  if p.id is not null then
   insert into public.hq_tasks(workspace_id,account_id,title,owner,due_on)
   values(new.workspace_id,new.account_id,'Post-launch customer check-in',p.owner,p.next_review_on);
   update public.hq_accounts set next_action='Post-launch customer check-in',owner=p.owner,due_on=p.next_review_on where id=new.account_id;
  end if;
 end if;
 return new;
end $$;
create trigger hq_support_handoff after update of status on public.hq_implementations for each row execute function private.hq_launch_support();
revoke all on function private.hq_lifecycle_guard(),private.hq_launch_support() from public,anon,authenticated;

create function private.hq_task_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare stage text;
begin
 if tg_op='UPDATE' and old.implementation_id is not null and (old.implementation_id,old.account_id) is distinct from (new.implementation_id,new.account_id) then raise exception 'Implementation checklist links cannot be changed.'; end if;
 if new.implementation_id is not null then
  select status into stage from public.hq_implementations where id=new.implementation_id for update;
  if stage='live' and not new.completed then raise exception 'Move the implementation out of Live before reopening its checklist. Use an account task for ongoing support.'; end if;
 end if;
 return new;
end $$;
create trigger hq_task_link_guard before insert or update on public.hq_tasks for each row execute function private.hq_task_guard();
revoke all on function private.hq_task_guard() from public,anon,authenticated;

-- Non-secret connection status is readable only by HQ staff.
create table public.hq_ad_integrations (
 provider text primary key check(provider in ('google_ads','meta')),
 workspace_id uuid not null default '8ac08858-038c-41df-90a8-4a84f25cb400' references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 enabled boolean not null default false, default_owner text not null default 'Shawn' check(default_owner in ('Shawn','Neil')),
 page_id text not null default '', form_ids text[] not null default '{}',
 last_received_at timestamptz, last_test_at timestamptz, last_error text not null default '', updated_at timestamptz not null default now()
);
insert into public.hq_ad_integrations(provider) values('google_ads'),('meta');
alter table public.hq_ad_integrations enable row level security;
revoke all on public.hq_ad_integrations from public,anon,authenticated;
grant select on public.hq_ad_integrations to authenticated;
grant select,update on public.hq_ad_integrations to service_role;
create policy hq_ad_read on public.hq_ad_integrations for select to authenticated using(private.can_read(workspace_id));
create table private.hq_ad_credentials (
 provider text primary key references public.hq_ad_integrations(provider),
 key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'),
 app_secret text not null default '', page_token text not null default '', graph_version text not null default ''
);
revoke all on private.hq_ad_credentials from public,anon,authenticated;
grant select on private.hq_ad_credentials to service_role;
create table public.hq_ad_receipts (
 provider text not null references public.hq_ad_integrations(provider), external_id text not null check(length(external_id) between 1 and 200),
 workspace_id uuid not null default '8ac08858-038c-41df-90a8-4a84f25cb400' check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 account_id uuid, form_id text not null, page_id text not null default '',
 status text not null check(status in ('pending','received','failed','test','ignored')), error_code text not null default '',
 attribution jsonb not null default '{}' check(jsonb_typeof(attribution)='object' and octet_length(attribution::text)<=16000),
 submitted_at timestamptz not null default now(), received_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(provider,external_id), foreign key(workspace_id,account_id) references public.hq_accounts(workspace_id,id)
);
alter table public.hq_ad_receipts enable row level security;
revoke all on public.hq_ad_receipts from public,anon,authenticated;
grant select on public.hq_ad_receipts to authenticated;
grant select,insert,update on public.hq_ad_receipts to service_role;
create policy hq_ad_receipt_read on public.hq_ad_receipts for select to authenticated using(private.can_read(workspace_id));
create index hq_ad_receipts_account on public.hq_ad_receipts(workspace_id,account_id);
create index hq_ad_receipts_recent on public.hq_ad_receipts(workspace_id,updated_at desc);

-- Privileged helper only for configuring private secrets; checks actual membership.
create function private.hq_configure_ads(p_provider text,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.workspace_memberships where workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400' and user_id=auth.uid() and is_active and role in ('owner','administrator')) then raise exception 'HQ administrator access required.'; end if;
 if p_provider not in ('google_ads','meta') then raise exception 'Unknown connection.'; end if;
 if (p_values->>'enabled')::boolean and p_provider='meta' and (coalesce(p_values->>'page_id','') !~ '^[0-9]+$' or coalesce(p_values->>'app_secret','')='' or coalesce(p_values->>'page_token','')='' or coalesce(p_values->>'graph_version','') !~ '^v[0-9]+\.[0-9]+$') then raise exception 'Complete Meta Page ID, app secret, page token and Graph API version.'; end if;
 if (p_values->>'enabled')::boolean and coalesce(jsonb_array_length(p_values->'form_ids'),0)=0 then raise exception 'Add the allowed lead form IDs.'; end if;
 if coalesce(p_values->>'key_hash','')<>'' then
  insert into private.hq_ad_credentials(provider,key_hash,app_secret,page_token,graph_version)
  values(p_provider,p_values->>'key_hash',coalesce(p_values->>'app_secret',''),coalesce(p_values->>'page_token',''),coalesce(p_values->>'graph_version',''))
  on conflict(provider) do update set key_hash=excluded.key_hash,app_secret=excluded.app_secret,page_token=excluded.page_token,graph_version=excluded.graph_version;
 elsif (p_values->>'enabled')::boolean then raise exception 'Generate a new connection key.'; end if;
 update public.hq_ad_integrations set enabled=(p_values->>'enabled')::boolean,default_owner=p_values->>'default_owner',page_id=coalesce(p_values->>'page_id',''),
 form_ids=array(select jsonb_array_elements_text(p_values->'form_ids')),last_received_at=null,last_test_at=null,last_error='',updated_at=now() where provider=p_provider;
 insert into public.audit_events(workspace_id,actor_id,action) values('8ac08858-038c-41df-90a8-4a84f25cb400',auth.uid(),'Ad lead connection updated');
end $$;
revoke all on function private.hq_configure_ads(text,jsonb) from public,anon;
grant execute on function private.hq_configure_ads(text,jsonb) to authenticated;
create function public.hq_configure_ads(p_provider text,p_values jsonb) returns void language sql security invoker set search_path='' as $$ select private.hq_configure_ads(p_provider,p_values) $$;
revoke all on function public.hq_configure_ads(text,jsonb) from public,anon;
grant execute on function public.hq_configure_ads(text,jsonb) to authenticated;

create function public.hq_ad_config(p_provider text) returns jsonb language sql security invoker set search_path='' as $$
 select to_jsonb(i)||to_jsonb(c) from public.hq_ad_integrations i join private.hq_ad_credentials c using(provider) where i.provider=p_provider and i.enabled;
$$;
revoke all on function public.hq_ad_config(text) from public,anon,authenticated;
grant execute on function public.hq_ad_config(text) to service_role;

-- Called only after provider authentication in the Edge Function. Pending Meta
-- receipts retain the lead ID so a failed Graph fetch can be retried from HQ.
create function public.hq_receive_ad(p_provider text,p_lead jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.hq_ad_integrations; r public.hq_ad_receipts; account uuid; s text:=p_lead->>'status';
begin
 select * into cfg from public.hq_ad_integrations where provider=p_provider and enabled;
 if not found then raise exception 'Connection disabled.'; end if;
 if not coalesce(p_lead->>'form_id'=any(cfg.form_ids),false) or (p_provider='meta' and p_lead->>'page_id' is distinct from cfg.page_id) then return jsonb_build_object('status','ignored'); end if;
 insert into public.hq_ad_receipts(provider,external_id,form_id,page_id,status,submitted_at)
 values(p_provider,p_lead->>'external_id',p_lead->>'form_id',coalesce(p_lead->>'page_id',''),'pending',coalesce((p_lead->>'submitted_at')::timestamptz,now()))
 on conflict(provider,external_id) do nothing;
 select * into r from public.hq_ad_receipts where provider=p_provider and external_id=p_lead->>'external_id' for update;
 if r.status in ('received','test') then return jsonb_build_object('status','duplicate'); end if;
 if r.form_id is distinct from p_lead->>'form_id' or r.page_id is distinct from coalesce(p_lead->>'page_id','') then raise exception 'Lead identity mismatch.'; end if;
 if s='pending' then return jsonb_build_object('status','pending'); end if;
 if s='received' then
  insert into public.hq_accounts(workspace_id,company,contact_name,email,phone,source,owner,next_action,due_on,scope,notes)
  values(cfg.workspace_id,p_lead->>'company',p_lead->>'contact_name',p_lead->>'email',p_lead->>'phone',case when p_provider='meta' then 'Meta' else 'Google Ads' end,cfg.default_owner,
  'Review ad inquiry and contact the lead',(now() at time zone 'America/Denver')::date,coalesce(p_lead->>'scope',''),coalesce(p_lead->>'notes','')) returning id into account;
 end if;
 update public.hq_ad_receipts set status=s,account_id=account,attribution=coalesce(p_lead->'attribution','{}'),error_code=left(coalesce(p_lead->>'error_code',''),200),submitted_at=coalesce((p_lead->>'submitted_at')::timestamptz,submitted_at),updated_at=now()
 where provider=p_provider and external_id=r.external_id;
 update public.hq_ad_integrations set last_received_at=case when s='received' then now() else last_received_at end,last_test_at=case when s='test' then now() else last_test_at end,
 last_error=case when s='failed' then left(coalesce(p_lead->>'error_code','Delivery failed'),200) else '' end where provider=p_provider;
 return jsonb_build_object('status',s);
end $$;
revoke all on function public.hq_receive_ad(text,jsonb) from public,anon,authenticated;
grant execute on function public.hq_receive_ad(text,jsonb) to service_role;
