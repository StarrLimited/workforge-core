create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.workspaces (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 200),
 model text not null check(model in ('field','build','supply','federal','executive')),
 is_demo boolean not null default false, timezone text not null default 'America/Denver',
 created_at timestamptz not null default now()
);
create table public.workspace_memberships (
 workspace_id uuid not null references public.workspaces(id), user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','administrator','member','read_only')),
 is_active boolean not null default true, primary key(workspace_id,user_id)
);
create index memberships_user on public.workspace_memberships(user_id,workspace_id);
create table private.workspace_invitations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 email text not null, role text not null check(role in ('owner','administrator','member','read_only')),
 expires_at timestamptz not null default now()+interval '30 days', accepted_by uuid references auth.users(id),
 unique(workspace_id,email)
);
alter table private.workspace_invitations enable row level security;
create function private.can_read(w uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.workspace_memberships m where m.workspace_id=w and m.user_id=(select auth.uid()) and m.is_active);
$$;
create function private.can_write(w uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.workspace_memberships m where m.workspace_id=w and m.user_id=(select auth.uid()) and m.is_active and m.role in ('owner','administrator','member'));
$$;
create function private.claim_invitation() returns void language plpgsql security definer set search_path='' as $$
declare e text; r record; uid uuid := auth.uid();
begin
 if uid is null then raise exception 'Sign in first.'; end if;
 select lower(email) into e from auth.users where id=uid and email_confirmed_at is not null;
 if e is null then return; end if;
 for r in select * from private.workspace_invitations where lower(email)=e and accepted_by is null and expires_at>now() for update loop
  insert into public.workspace_memberships(workspace_id,user_id,role) values(r.workspace_id,uid,r.role) on conflict do nothing;
  update private.workspace_invitations set accepted_by=uid where id=r.id;
 end loop;
end; $$;
create function public.accept_workspace_invitation() returns void language sql security invoker set search_path='' as $$ select private.claim_invitation(); $$;
create table public.contacts (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), name text not null check(length(name) between 1 and 200),
 email text not null default '' check(length(email)<=254), phone text not null default '' check(length(phone)<=40), address text not null default '' check(length(address)<=400),
 created_at timestamptz not null default now(), unique(workspace_id,id)
);
create table public.partners (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), name text not null check(length(name) between 1 and 200),
 kind text not null check(kind in ('crew','subcontractor','vendor')), phone text not null default '', unique(workspace_id,id)
);
create table public.work_orders (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), number bigint generated always as identity unique,
 title text not null check(length(title) between 1 and 200), contact_id uuid not null, description text not null default '',
 stage text not null default 'lead' check(stage in ('lead','appointment','estimated','approved','scheduled','in_progress','completed','invoice_ready')),
 scheduled_at timestamptz, assigned_partner_id uuid,
 material_cost_cents bigint not null default 0 check(material_cost_cents between 0 and 100000000000),
 labor_cost_cents bigint not null default 0 check(labor_cost_cents between 0 and 100000000000),
 target_margin numeric(5,2) not null default 40 check(target_margin>=0 and target_margin<100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 foreign key(workspace_id,contact_id) references public.contacts(workspace_id,id),
 foreign key(workspace_id,assigned_partner_id) references public.partners(workspace_id,id)
);
create table public.estimate_versions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, work_order_id uuid not null,
 version integer not null check(version>0), scope text not null, labor_cost_cents bigint not null, material_cost_cents bigint not null,
 margin_percent numeric(5,2) not null check(margin_percent>=0 and margin_percent<100), price_cents bigint not null check(price_cents>0),
 status text not null default 'draft' check(status in ('draft','approved')), approved_by text, approved_at timestamptz,
 created_at timestamptz not null default now(), unique(work_order_id,version),
 foreign key(workspace_id,work_order_id) references public.work_orders(workspace_id,id)
);
create table public.appointments (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, work_order_id uuid not null, title text not null check(length(title) between 1 and 200),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 foreign key(workspace_id,work_order_id) references public.work_orders(workspace_id,id)
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), title text not null check(length(title) between 1 and 300),
 due_on date, completed boolean not null default false, work_order_id uuid,
 foreign key(workspace_id,work_order_id) references public.work_orders(workspace_id,id)
);
create table public.purchase_orders (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, work_order_id uuid not null, partner_id uuid not null,
 description text not null check(length(description) between 1 and 500), cost_cents bigint not null check(cost_cents>0 and cost_cents<=100000000000),
 status text not null default 'planned' check(status in ('planned','ordered','received')),
 foreign key(workspace_id,work_order_id) references public.work_orders(workspace_id,id),
 foreign key(workspace_id,partner_id) references public.partners(workspace_id,id)
);
create table public.invoice_handoffs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, work_order_id uuid not null unique, estimate_id uuid not null references public.estimate_versions(id),
 amount_cents bigint not null check(amount_cents>0), status text not null default 'prepared' check(status in ('prepared','sent','failed')),
 created_at timestamptz not null default now(), foreign key(workspace_id,work_order_id) references public.work_orders(workspace_id,id)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), work_order_id uuid,
 actor_id uuid, action text not null, created_at timestamptz not null default now()
);
create index audits_workspace_date on public.audit_events(workspace_id,created_at desc);
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare order_id uuid;
begin
 if tg_op='UPDATE' and old.workspace_id is distinct from new.workspace_id then raise exception 'Workspace cannot be changed.'; end if;
 if tg_table_name='work_orders' then
  order_id := new.id;
  if tg_op='UPDATE' then
   if old.stage in ('approved','scheduled','in_progress','completed','invoice_ready') and (old.labor_cost_cents,old.material_cost_cents,old.target_margin,old.description) is distinct from (new.labor_cost_cents,new.material_cost_cents,new.target_margin,new.description) then
    raise exception 'The accepted estimate is locked. A change-order workflow is required.';
   end if;
   new.updated_at:=now();
  end if;
 else order_id := (to_jsonb(new)->>'work_order_id')::uuid;
 end if;
 insert into public.audit_events(workspace_id,work_order_id,actor_id,action) values(new.workspace_id,order_id,auth.uid(),
 case when tg_table_name='work_orders' and tg_op='UPDATE' then 'Work order updated' else initcap(replace(tg_table_name,'_',' '))||' '||lower(tg_op) end);
 return new;
end; $$;
do $$
declare t text;
begin
 foreach t in array array['contacts','partners','work_orders','estimate_versions','appointments','tasks','purchase_orders','invoice_handoffs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy member_read on public.%I for select to authenticated using (private.can_read(workspace_id))',t);
  execute format('create policy member_insert on public.%I for insert to authenticated with check (private.can_write(workspace_id))',t);
  execute format('create policy member_update on public.%I for update to authenticated using (private.can_write(workspace_id)) with check (private.can_write(workspace_id))',t);
  execute format('create index %I on public.%I(workspace_id)',t||'_workspace',t);
  execute format('create trigger audit_record before insert or update on public.%I for each row execute function private.audit_change()',t);
 end loop;
end; $$;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.audit_events enable row level security;
create policy own_memberships on public.workspace_memberships for select to authenticated using (user_id=(select auth.uid()));
create policy workspace_read on public.workspaces for select to authenticated using (private.can_read(id));
create policy audit_read on public.audit_events for select to authenticated using (private.can_read(workspace_id));
revoke all on all tables in schema public from anon,authenticated;
grant select on public.workspaces,public.workspace_memberships,public.contacts,public.partners,public.work_orders,public.estimate_versions,public.appointments,public.tasks,public.purchase_orders,public.invoice_handoffs,public.audit_events to authenticated;
grant insert(workspace_id,name,email,phone,address) on public.contacts to authenticated;
grant insert(workspace_id,name,kind,phone) on public.partners to authenticated;
grant insert(workspace_id,work_order_id,title,starts_at,ends_at) on public.appointments to authenticated;
grant insert(workspace_id,title,due_on,work_order_id) on public.tasks to authenticated;
grant insert(workspace_id,work_order_id,partner_id,description,cost_cents) on public.purchase_orders to authenticated;
grant update(completed) on public.tasks to authenticated;
grant update(status) on public.purchase_orders to authenticated;
grant update(title,description,labor_cost_cents,material_cost_cents,target_margin) on public.work_orders to authenticated;
create function private.create_lead(w uuid,contact_name text,email text,phone text,address text,title text,description text) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; oid uuid;
begin
 if auth.uid() is null or not private.can_write(w) then raise exception 'Workspace write access required.'; end if;
 if not exists(select 1 from public.workspaces where id=w and model='field') then raise exception 'Field module required.'; end if;
 if length(trim(contact_name))<1 or length(trim(title))<1 then raise exception 'Contact and job name are required.'; end if;
 insert into public.contacts(workspace_id,name,email,phone,address) values(w,trim(contact_name),email,phone,address) returning id into cid;
 insert into public.work_orders(workspace_id,contact_id,title,description) values(w,cid,trim(title),description) returning id into oid;
 return oid;
end; $$;
create or replace function public.create_field_lead(p_workspace_id uuid,p_contact_name text,p_email text,p_phone text,p_address text,p_title text,p_description text) returns uuid language sql security invoker set search_path='' as $$
 select private.create_lead(p_workspace_id,p_contact_name,p_email,p_phone,p_address,p_title,p_description);
$$;
create function private.advance_order(w uuid,oid uuid,expected text,next_stage text,approver text) returns void language plpgsql security definer set search_path='' as $$
declare o public.work_orders; q public.estimate_versions; stages text[]:=array['lead','appointment','estimated','approved','scheduled','in_progress','completed','invoice_ready']; v integer; price bigint;
begin
 if auth.uid() is null or not private.can_write(w) then raise exception 'Workspace write access required.'; end if;
 select * into o from public.work_orders where id=oid and workspace_id=w for update;
 if not found then raise exception 'Work order not found.'; end if;
 if o.stage=next_stage then return; end if;
 if o.stage<>expected then raise exception 'This job has changed. Refresh before continuing.'; end if;
 if array_position(stages,next_stage) is null or array_position(stages,next_stage)<>array_position(stages,o.stage)+1 then raise exception 'Complete the preceding workflow step first.'; end if;
 if next_stage='appointment' and not exists(select 1 from public.appointments where work_order_id=oid and workspace_id=w) then raise exception 'Add a consultation appointment first.'; end if;
 if next_stage='estimated' then
  if o.labor_cost_cents+o.material_cost_cents<=0 then raise exception 'Enter the labor and material budget first.'; end if;
  price:=ceil((o.labor_cost_cents+o.material_cost_cents)::numeric/(1-o.target_margin/100));
  select coalesce(max(version),0)+1 into v from public.estimate_versions where work_order_id=oid;
  insert into public.estimate_versions(workspace_id,work_order_id,version,scope,labor_cost_cents,material_cost_cents,margin_percent,price_cents)
   values(w,oid,v,o.description,o.labor_cost_cents,o.material_cost_cents,o.target_margin,price);
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
create function public.advance_field_order(p_workspace_id uuid,p_order_id uuid,p_expected text,p_next text,p_approver text default '') returns void language sql security invoker set search_path='' as $$
 select private.advance_order(p_workspace_id,p_order_id,p_expected,p_next,p_approver);
$$;
create function private.schedule_order(w uuid,oid uuid,starts timestamptz,partner uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.work_orders;
begin
 if auth.uid() is null or not private.can_write(w) then raise exception 'Workspace write access required.'; end if;
 select * into o from public.work_orders where workspace_id=w and id=oid for update;
 if not found then raise exception 'Job not found.'; end if;
 if o.stage not in ('approved','scheduled') then raise exception 'Approve the estimate before production scheduling.'; end if;
 if starts is null or not exists(select 1 from public.partners where id=partner and workspace_id=w and kind in ('crew','subcontractor')) then raise exception 'Choose a valid date and crew.'; end if;
 update public.work_orders set scheduled_at=starts,assigned_partner_id=partner where id=oid;
end; $$;
create function public.schedule_field_order(p_workspace_id uuid,p_order_id uuid,p_starts_at timestamptz,p_partner_id uuid) returns void language sql security invoker set search_path='' as $$
 select private.schedule_order(p_workspace_id,p_order_id,p_starts_at,p_partner_id);
$$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.accept_workspace_invitation(),public.create_field_lead(uuid,text,text,text,text,text,text),public.advance_field_order(uuid,uuid,text,text,text),public.schedule_field_order(uuid,uuid,timestamptz,uuid) from public,anon;
grant execute on function private.can_read(uuid),private.can_write(uuid),private.claim_invitation(),private.create_lead(uuid,text,text,text,text,text,text),private.advance_order(uuid,uuid,text,text,text),private.schedule_order(uuid,uuid,timestamptz,uuid) to authenticated;
grant execute on function public.accept_workspace_invitation(),public.create_field_lead(uuid,text,text,text,text,text,text),public.advance_field_order(uuid,uuid,text,text,text),public.schedule_field_order(uuid,uuid,timestamptz,uuid) to authenticated;
