-- Internal WorkForge workspace. No client or demonstration business data is seeded.
insert into public.workspaces(id,name,model,is_demo,timezone)
values('8ac08858-038c-41df-90a8-4a84f25cb400','WorkForge HQ','executive',false,'America/Denver');

create table public.hq_accounts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 company text not null check(length(trim(company)) between 1 and 200),
 contact_name text not null check(length(trim(contact_name)) between 1 and 200),
 email text not null default '' check(length(email)<=254), phone text not null default '' check(length(phone)<=40),
 source text not null default 'Website' check(source in ('Website','Google Ads','Google LSA','Meta','Print','Referral','Outbound','Other')),
 product text not null default 'undecided' check(product in ('field','core','both','undecided')),
 stage text not null default 'new' check(stage in ('new','discovery','blueprint','proposal','won','lost')),
 owner text not null check(owner in ('Shawn','Neil')),
 next_action text not null check(length(trim(next_action)) between 1 and 300), due_on date not null,
 scope text not null default '' check(length(scope)<=20000), notes text not null default '' check(length(notes)<=20000),
 lost_reason text not null default '' check(length(lost_reason)<=1000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(length(trim(email))>0 or length(trim(phone))>0), unique(workspace_id,id)
);
create table public.hq_implementations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 account_id uuid not null unique,
 status text not null default 'onboarding' check(status in ('onboarding','building','testing','ready','live','on_hold')),
 owner text not null check(owner in ('Shawn','Neil')), target_on date,
 scope_snapshot text not null check(length(trim(scope_snapshot)) between 1 and 20000),
 blocker text not null default '' check(length(blocker)<=3000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id,account_id), foreign key(workspace_id,account_id) references public.hq_accounts(workspace_id,id)
);
create table public.hq_tasks (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 account_id uuid, implementation_id uuid,
 title text not null check(length(trim(title)) between 1 and 300), owner text not null check(owner in ('Shawn','Neil')),
 due_on date not null, completed boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(implementation_id is null or account_id is not null),
 foreign key(workspace_id,account_id) references public.hq_accounts(workspace_id,id),
 foreign key(workspace_id,implementation_id,account_id) references public.hq_implementations(workspace_id,id,account_id)
);
create table public.hq_engagements (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 account_id uuid not null,
 service text not null check(service in ('blueprint','implementation','migration','support')),
 description text not null check(length(trim(description)) between 1 and 500),
 cadence text not null check(cadence in ('one_time','monthly')),
 amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 paid_cents bigint not null default 0 check(paid_cents between 0 and 100000000000),
 status text not null default 'proposed' check(status in ('proposed','agreed','ended')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((cadence='monthly' and paid_cents=0) or (cadence='one_time' and paid_cents<=amount_cents)),
 foreign key(workspace_id,account_id) references public.hq_accounts(workspace_id,id)
);
create table public.hq_events (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 account_id uuid, title text not null check(length(trim(title)) between 1 and 200),
 owner text not null check(owner in ('Shawn','Neil')),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 notes text not null default '' check(length(notes)<=3000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,account_id) references public.hq_accounts(workspace_id,id)
);

create function private.hq_validate_change() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if old.workspace_id<>new.workspace_id then raise exception 'Workspace cannot be changed.'; end if;
  new.updated_at:=clock_timestamp();
 end if;
 if tg_table_name='hq_accounts' then
  if tg_op='UPDATE' and old.stage='won' and new.stage<>'won' then raise exception 'Won accounts must remain linked to their implementation.'; end if;
  if new.stage='lost' and length(trim(new.lost_reason))=0 then raise exception 'Record a reason before closing a lead as lost.'; end if;
  if new.stage='won' and (tg_op='INSERT' or old.stage is distinct from 'won') then
   if length(trim(new.scope))=0 then raise exception 'Record the agreed scope before marking this account won.'; end if;
   if not exists(select 1 from public.hq_engagements where account_id=new.id and workspace_id=new.workspace_id and status='agreed') then
    raise exception 'Add at least one agreed fee before marking this account won.';
   end if;
  end if;
 elsif tg_table_name='hq_implementations' then
  if tg_op='UPDATE' and (old.account_id,old.scope_snapshot) is distinct from (new.account_id,new.scope_snapshot) then
   raise exception 'The original handoff scope is preserved. Record subsequent changes in account notes.';
  end if;
  if new.status='live' then
   if new.target_on is null or length(trim(new.blocker))>0 then raise exception 'Set the launch date and clear blockers before going live.'; end if;
   if exists(select 1 from public.hq_tasks where implementation_id=new.id and not completed) then raise exception 'Complete all implementation tasks before going live.'; end if;
  end if;
 end if;
 return new;
end; $$;

create function private.hq_create_handoff() returns trigger language plpgsql security invoker set search_path='' as $$
declare implementation uuid;
begin
 if new.stage='won' and old.stage<>'won' then
  insert into public.hq_implementations(workspace_id,account_id,owner,scope_snapshot)
  values(new.workspace_id,new.id,new.owner,new.scope) on conflict(account_id) do nothing returning id into implementation;
  if implementation is not null then
   insert into public.hq_tasks(workspace_id,account_id,implementation_id,title,owner,due_on)
   select new.workspace_id,new.id,implementation,title,new.owner,new.due_on
   from unnest(array['Confirm scope and success criteria','Collect access and confirm migration requirements','Configure and review the customer workspace','Complete testing and resolve issues','Train users and confirm handoff','Record customer launch approval']) as title;
  end if;
 end if;
 return new;
end; $$;

do $$ declare t text; begin
 foreach t in array array['hq_accounts','hq_implementations','hq_tasks','hq_engagements','hq_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('create policy hq_read on public.%I for select to authenticated using (private.can_read(workspace_id))',t);
  execute format('create policy hq_insert on public.%I for insert to authenticated with check (private.can_write(workspace_id))',t);
  execute format('create policy hq_update on public.%I for update to authenticated using (private.can_write(workspace_id)) with check (private.can_write(workspace_id))',t);
  execute format('create index %I on public.%I(workspace_id,updated_at desc)',t||'_workspace_updated',t);
  execute format('create trigger hq_validate before insert or update on public.%I for each row execute function private.hq_validate_change()',t);
  execute format('create trigger hq_audit before insert or update on public.%I for each row execute function private.audit_change()',t);
 end loop;
end; $$;
create index hq_tasks_account on public.hq_tasks(workspace_id,account_id);
create index hq_tasks_implementation on public.hq_tasks(workspace_id,implementation_id,account_id);
create index hq_engagements_account on public.hq_engagements(workspace_id,account_id);
create index hq_events_account on public.hq_events(workspace_id,account_id);
create index hq_implementations_account on public.hq_implementations(workspace_id,account_id);
create trigger hq_handoff after update of stage on public.hq_accounts for each row execute function private.hq_create_handoff();

create function public.hq_set_stage(p_account_id uuid,p_expected text,p_stage text,p_lost_reason text default '')
returns void language plpgsql security invoker set search_path='' as $$
declare a public.hq_accounts;
begin
 if auth.uid() is null or not private.can_write('8ac08858-038c-41df-90a8-4a84f25cb400') then raise exception 'WorkForge HQ write access required.'; end if;
 select * into a from public.hq_accounts where id=p_account_id and workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400' for update;
 if not found then raise exception 'Account not found.'; end if;
 if a.stage=p_stage then return; end if;
 if a.stage<>p_expected then raise exception 'This account has changed. Refresh before updating its stage.'; end if;
 update public.hq_accounts set stage=p_stage,lost_reason=case when p_stage='lost' then p_lost_reason else '' end where id=a.id;
end; $$;
revoke all on function private.hq_validate_change(),private.hq_create_handoff() from public,anon,authenticated;
revoke all on function public.hq_set_stage(uuid,text,text,text) from public,anon;
grant execute on function public.hq_set_stage(uuid,text,text,text) to authenticated;

-- Existing owner and previously authorized team member. No invitation email is sent.
insert into public.workspace_memberships(workspace_id,user_id,role)
select '8ac08858-038c-41df-90a8-4a84f25cb400',id,'owner' from auth.users
where lower(email)='shawn@starrlimited.com' and email_confirmed_at is not null;
insert into private.workspace_invitations(workspace_id,email,role)
values('8ac08858-038c-41df-90a8-4a84f25cb400','neil@starrlimited.com','member');
