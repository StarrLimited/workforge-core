-- Standalone CRM. Separate records from HQ and Field OS; shared, verified workspace identity.
alter table public.workspaces drop constraint workspaces_model_check;
alter table public.workspaces add constraint workspaces_model_check check(model in ('field','build','supply','federal','executive','crm'));
create function private.crm_admin(w uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.workspace_memberships where workspace_id=w and user_id=(select auth.uid()) and is_active and role in ('owner','administrator'));
$$;
revoke all on function private.crm_admin(uuid) from public,anon;
grant execute on function private.crm_admin(uuid) to authenticated;
create table public.crm_companies (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 name text not null check(length(trim(name)) between 1 and 200), website text not null default '' check(length(website)<=500),
 phone text not null default '' check(length(phone)<=40), industry text not null default '' check(length(industry)<=100),
 address text not null default '' check(length(address)<=500), created_at timestamptz not null default now(), unique(workspace_id,id)
);
create table public.crm_contacts (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), company_id uuid,
 name text not null check(length(trim(name)) between 1 and 200), email text not null default '' check(length(email)<=254), phone text not null default '' check(length(phone)<=40),
 job_title text not null default '' check(length(job_title)<=150), source text not null default 'Manual' check(length(source)<=100),
 lifecycle text not null default 'lead' check(lifecycle in ('lead','qualified','customer','archived')),
 tags text[] not null default '{}', owner_id uuid, do_not_contact boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,company_id) references public.crm_companies(workspace_id,id),
 foreign key(workspace_id,owner_id) references public.workspace_memberships(workspace_id,user_id)
);
create unique index crm_contact_email on public.crm_contacts(workspace_id,lower(trim(email))) where trim(email)<>'';
create table public.crm_pipelines (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), name text not null check(length(trim(name)) between 1 and 100),
 created_at timestamptz not null default now(), unique(workspace_id,id)
);
create table public.crm_stages (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, pipeline_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 100), position integer not null check(position between 0 and 100),
 probability integer not null default 20 check(probability between 0 and 100), followup_days integer check(followup_days between 0 and 365),
 unique(workspace_id,pipeline_id,id), unique(workspace_id,id), unique(pipeline_id,position) deferrable initially deferred,
 foreign key(workspace_id,pipeline_id) references public.crm_pipelines(workspace_id,id)
);
create table public.crm_deals (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, pipeline_id uuid not null, stage_id uuid not null, contact_id uuid not null,
 title text not null check(length(trim(title)) between 1 and 200), value_cents bigint not null default 0 check(value_cents between 0 and 100000000000),
 status text not null default 'open' check(status in ('open','won','lost')), lost_reason text not null default '' check(length(lost_reason)<=1000),
 owner_id uuid, source text not null default 'Manual' check(length(source)<=100), expected_close date, closed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), stage_entered_at timestamptz not null default now(),
 unique(workspace_id,id), check(status<>'lost' or length(trim(lost_reason))>0),
 foreign key(workspace_id,pipeline_id,stage_id) references public.crm_stages(workspace_id,pipeline_id,id),
 foreign key(workspace_id,contact_id) references public.crm_contacts(workspace_id,id),
 foreign key(workspace_id,owner_id) references public.workspace_memberships(workspace_id,user_id)
);
create table public.crm_activities (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), contact_id uuid, deal_id uuid, owner_id uuid,
 title text not null check(length(trim(title)) between 1 and 300), kind text not null default 'task' check(kind in ('task','call','email','meeting')),
 due_at timestamptz not null, duration_minutes integer not null default 30 check(duration_minutes between 5 and 1440),
 completed_at timestamptz, outcome text not null default '' check(length(outcome)<=3000), automatic boolean not null default false,
 created_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,contact_id) references public.crm_contacts(workspace_id,id),
 foreign key(workspace_id,deal_id) references public.crm_deals(workspace_id,id),
 foreign key(workspace_id,owner_id) references public.workspace_memberships(workspace_id,user_id)
);
create table public.crm_notes (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), contact_id uuid, deal_id uuid,
 body text not null check(length(trim(body)) between 1 and 10000), author_id uuid not null default auth.uid(), created_at timestamptz not null default now(),
 check(contact_id is not null or deal_id is not null),
 foreign key(workspace_id,contact_id) references public.crm_contacts(workspace_id,id),
 foreign key(workspace_id,deal_id) references public.crm_deals(workspace_id,id)
);
create table public.crm_history (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), entity text not null, record_id uuid not null,
 description text not null, actor_id uuid, created_at timestamptz not null default now()
);
create index crm_history_record on public.crm_history(workspace_id,record_id,created_at desc);
create index crm_deals_board on public.crm_deals(workspace_id,pipeline_id,status,stage_id);
create index crm_activities_due on public.crm_activities(workspace_id,due_at) where completed_at is null;
create index crm_activities_deal on public.crm_activities(workspace_id,deal_id);
create index crm_activities_contact on public.crm_activities(workspace_id,contact_id);
create index crm_notes_deal on public.crm_notes(workspace_id,deal_id);
create index crm_notes_contact on public.crm_notes(workspace_id,contact_id);
create function private.crm_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.workspace_id<>old.workspace_id or new.id<>old.id) then raise exception 'Record identity cannot be changed.'; end if;
 if not exists(select 1 from public.workspaces where id=new.workspace_id and model='crm') then raise exception 'CRM workspace required.'; end if;
 if tg_table_name in ('crm_contacts','crm_deals','crm_activities') then
 if new.owner_id is not null and not exists(select 1 from public.crm_team(new.workspace_id) t where t.user_id=new.owner_id and t.is_active and t.role<>'read_only') then raise exception 'Choose an active team member.'; end if;
 end if;
 if tg_table_name in ('crm_contacts','crm_deals') then new.updated_at:=now(); end if;
 if tg_table_name='crm_deals' then
  if tg_op='UPDATE' and new.stage_id<>old.stage_id then new.stage_entered_at:=now(); end if;
  if new.status='open' then new.closed_at:=null; elsif tg_op='INSERT' then new.closed_at:=now(); elsif new.status<>old.status then new.closed_at:=now(); end if;
 end if;
 if tg_table_name in ('crm_activities','crm_notes') then
 if new.deal_id is not null then
  if new.contact_id is not null and not exists(select 1 from public.crm_deals where id=new.deal_id and workspace_id=new.workspace_id and contact_id=new.contact_id) then raise exception 'Contact must match the selected deal.'; end if;
 end if; end if;
 if tg_table_name='crm_notes' and auth.uid() is not null then new.author_id:=auth.uid(); end if;
 return new;
end $$;
-- Team directory is privileged because auth.users and other users' membership rows are private.
create function private.crm_team(w uuid) returns table(user_id uuid,email text,role text,is_active boolean) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.can_read(w) then raise exception 'Workspace access required.'; end if;
 return query select m.user_id,u.email::text,m.role,m.is_active from public.workspace_memberships m join auth.users u on u.id=m.user_id where m.workspace_id=w;
end $$;
create function public.crm_team(w uuid) returns table(user_id uuid,email text,role text,is_active boolean) language sql stable security invoker set search_path='' as $$ select * from private.crm_team(w) $$;
revoke all on function private.crm_team(uuid),public.crm_team(uuid) from public,anon;
grant execute on function private.crm_team(uuid),public.crm_team(uuid) to authenticated;
create function private.crm_log() returns trigger language plpgsql security definer set search_path='' as $$
declare label text; description text; delay_days integer;
begin
 label:=coalesce(to_jsonb(new)->>'title',to_jsonb(new)->>'name',left(to_jsonb(new)->>'body',100),'Record');
 if tg_op='UPDATE' and to_jsonb(new)-'updated_at' is not distinct from to_jsonb(old)-'updated_at' then return new; end if;
 description:=case when tg_op='INSERT' then 'Added: ' else 'Updated: ' end||label;
 if tg_table_name='crm_deals' then
  description:=case when tg_op='INSERT' then 'Deal created: '||label when new.status<>old.status then 'Deal marked '||new.status||': '||label when new.stage_id<>old.stage_id then 'Moved to '||(select name from public.crm_stages where id=new.stage_id)||': '||label else 'Deal updated: '||label end;
 end if;
 insert into public.crm_history(workspace_id,entity,record_id,description,actor_id) values(new.workspace_id,tg_table_name,new.id,description,auth.uid());
 if tg_table_name='crm_deals' then
  if new.status='open' and (tg_op='INSERT' or new.stage_id is distinct from old.stage_id) then
   select followup_days into delay_days from public.crm_stages where id=new.stage_id;
   if delay_days is not null and not exists(select 1 from public.crm_activities where deal_id=new.id and completed_at is null and automatic) then
    insert into public.crm_activities(workspace_id,contact_id,deal_id,owner_id,title,kind,due_at,automatic)
    values(new.workspace_id,new.contact_id,new.id,new.owner_id,'Follow up: '||left(new.title,240),'call',now()+make_interval(days=>delay_days),true);
   end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.crm_guard(),private.crm_log() from public,anon,authenticated;
do $$ declare t text; admin_table boolean; begin
 foreach t in array array['crm_companies','crm_contacts','crm_pipelines','crm_stages','crm_deals','crm_activities','crm_notes','crm_history'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy crm_read on public.%I for select to authenticated using (private.can_read(workspace_id))',t);
  execute format('create index %I on public.%I(workspace_id)',t||'_workspace',t);
  if t<>'crm_history' then
   admin_table:=t in ('crm_pipelines','crm_stages');
   execute format('grant insert on public.%I to authenticated',t);
   execute format('create policy crm_insert on public.%I for insert to authenticated with check (private.%I(workspace_id))',t,case when admin_table then 'crm_admin' else 'can_write' end);
   if t<>'crm_notes' then
    execute format('grant update on public.%I to authenticated',t);
    execute format('create policy crm_update on public.%I for update to authenticated using (private.%I(workspace_id)) with check (private.%I(workspace_id))',t,case when admin_table then 'crm_admin' else 'can_write' end,case when admin_table then 'crm_admin' else 'can_write' end);
   end if;
   execute format('create trigger crm_guard before insert or update on public.%I for each row execute function private.crm_guard()',t);
   execute format('create trigger crm_log after insert or update on public.%I for each row execute function private.crm_log()',t);
  end if;
 end loop;
end $$;
-- Atomic pipeline creation: no empty pipelines if any stage fails validation.
create function public.crm_create_pipeline(w uuid,p_name text) returns uuid language plpgsql security invoker set search_path='' as $$
declare p uuid;
begin
 insert into public.crm_pipelines(workspace_id,name) values(w,p_name) returning id into p;
 insert into public.crm_stages(workspace_id,pipeline_id,name,position,probability,followup_days) values
 (w,p,'New lead',0,10,0),(w,p,'Contacted',1,20,2),(w,p,'Qualified',2,40,3),(w,p,'Proposal sent',3,60,3),(w,p,'Negotiation',4,80,2);
 return p;
end $$;
revoke all on function public.crm_create_pipeline(uuid,text) from public,anon;
grant execute on function public.crm_create_pipeline(uuid,text) to authenticated;
create function public.crm_import_contacts(w uuid,rows jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb; inserted integer:=0; affected integer;
begin
 if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>500 then raise exception 'Import up to 500 contacts at a time.'; end if;
 for r in select value from jsonb_array_elements(rows) loop
  insert into public.crm_contacts(workspace_id,name,email,phone,job_title,source,tags,owner_id)
  values(w,r->>'name',coalesce(r->>'email',''),coalesce(r->>'phone',''),coalesce(r->>'job_title',''),coalesce(r->>'source','Import'),
   array(select jsonb_array_elements_text(coalesce(r->'tags','[]'))),auth.uid()) on conflict(workspace_id,lower(trim(email))) where trim(email)<>'' do nothing;
  get diagnostics affected=row_count; inserted:=inserted+affected;
 end loop;
 return jsonb_build_object('inserted',inserted,'skipped',jsonb_array_length(rows)-inserted);
end $$;
revoke all on function public.crm_import_contacts(uuid,jsonb) from public,anon;
grant execute on function public.crm_import_contacts(uuid,jsonb) to authenticated;
create function private.crm_add_member(w uuid,p_email text,p_role text) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if auth.uid() is null or not private.crm_admin(w) or not exists(select 1 from public.workspaces where id=w and model='crm') then raise exception 'CRM administrator access required.'; end if;
 if p_role is null or p_role not in ('member','read_only','administrator') then raise exception 'Choose a valid role.'; end if;
 if p_role='administrator' and not exists(select 1 from public.workspace_memberships where workspace_id=w and user_id=auth.uid() and role='owner' and is_active) then raise exception 'Only the owner can appoint administrators.'; end if;
 p_email:=lower(trim(p_email));
 if p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email.'; end if;
 perform 1 from public.workspaces where id=w for update;
 if exists(select 1 from private.workspace_invitations where workspace_id=w and email=p_email and accepted_by is null and expires_at>now()) then raise exception 'This person already has pending access.'; end if;
 select id into uid from auth.users where lower(email)=p_email and email_confirmed_at is not null;
 if uid is not null then
  if exists(select 1 from public.workspace_memberships where workspace_id=w and user_id=uid) then raise exception 'This person already has a workspace membership.'; end if;
  insert into public.workspace_memberships(workspace_id,user_id,role) values(w,uid,p_role);
  return 'Access added. No invitation email was sent.';
 end if;
 insert into private.workspace_invitations(workspace_id,email,role) values(w,p_email,p_role) on conflict(workspace_id,email) do update set role=excluded.role,accepted_by=null,expires_at=now()+interval '30 days';
 return 'Access reserved for 30 days. Share the sign-in link with this person. No email was sent.';
end $$;
create function public.crm_add_member(w uuid,p_email text,p_role text) returns text language sql security invoker set search_path='' as $$ select private.crm_add_member(w,p_email,p_role) $$;
revoke all on function private.crm_add_member(uuid,text,text),public.crm_add_member(uuid,text,text) from public,anon;
grant execute on function private.crm_add_member(uuid,text,text),public.crm_add_member(uuid,text,text) to authenticated;
