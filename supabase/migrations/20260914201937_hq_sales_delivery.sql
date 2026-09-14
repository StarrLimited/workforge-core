-- Additive customer engagement records; existing intake/account IDs stay intact.
create table public.hq_opportunities (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 account_id uuid not null, title text not null check(length(trim(title)) between 1 and 500), kind text not null check(kind in ('blueprint','implementation','change')),
 stage text not null default 'discovery' check(stage in ('discovery','proposal','won','lost')), owner text not null check(owner in ('Shawn','Neil')),
 next_action text not null check(length(trim(next_action)) between 1 and 500), due_on date not null,
 discovery jsonb not null default '{"answers":{},"open_questions":""}' check(jsonb_typeof(discovery)='object' and octet_length(discovery::text)<150000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(workspace_id,id,account_id),foreign key(workspace_id,account_id) references public.hq_accounts(workspace_id,id)
);
create table public.hq_requirements (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 opportunity_id uuid not null references public.hq_opportunities(id),title text not null check(length(trim(title)) between 1 and 500),
 priority text not null check(priority in ('must','should','later')),actor text not null check(length(trim(actor)) between 1 and 500),
 steps text not null check(length(trim(steps)) between 1 and 20000),expected text not null check(length(trim(expected)) between 1 and 20000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.hq_proposals (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 opportunity_id uuid not null,account_id uuid not null,family_id uuid not null default gen_random_uuid(),revision integer not null default 1 check(revision>0),
 number text not null default ('WF-'||upper(substr(gen_random_uuid()::text,1,8))) unique,
 title text not null check(length(trim(title)) between 1 and 500),status text not null default 'draft' check(status in ('draft','issued','accepted','declined','superseded')),
 valid_until date not null,document jsonb not null default '{}' check(jsonb_typeof(document)='object' and octet_length(document::text)<350000),
 lines jsonb not null default '[]' check(jsonb_typeof(lines)='array' and jsonb_array_length(lines) between 1 and 50),
 deposit_cents bigint not null default 0 check(deposit_cents between 0 and 100000000000),tax_cents bigint not null default 0 check(tax_cents between 0 and 100000000000),
 terms_reviewed boolean not null default false,requirements_snapshot jsonb not null default '[]',discovery_snapshot jsonb not null default '{}',
 accepted_name text not null default '',accepted_on date,evidence text not null default '',accepted_by uuid references auth.users(id),issued_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(family_id,revision),unique(workspace_id,id,account_id),
 foreign key(workspace_id,opportunity_id,account_id) references public.hq_opportunities(workspace_id,id,account_id)
);
create unique index hq_one_accepted_offer on public.hq_proposals(opportunity_id) where status='accepted';
alter table public.hq_implementations drop constraint hq_implementations_account_id_key;
alter table public.hq_implementations add column opportunity_id uuid references public.hq_opportunities(id),add column proposal_id uuid unique references public.hq_proposals(id),
 add column project_kind text not null default 'implementation' check(project_kind in ('blueprint','implementation','change')),
 add column release text not null default '' check(length(release)<=200),add column funding_note text not null default '' check(length(funding_note)<=5000),
 add column approval_name text not null default '',add column approval_on date,add column approval_evidence text not null default '',add column approval_release text not null default '';
alter table public.hq_tasks add column phase text not null default 'general',add column evidence text not null default '' check(length(evidence)<=10000);
alter table public.hq_engagements add column proposal_id uuid references public.hq_proposals(id),add column proposal_line integer;
create unique index hq_agreement_fee_once on public.hq_engagements(proposal_id,proposal_line) where proposal_id is not null;
alter table public.hq_engagements drop constraint hq_engagements_service_check,drop constraint hq_engagements_cadence_check,drop constraint hq_engagements_check;
alter table public.hq_engagements add constraint hq_engagements_service_check check(service in ('blueprint','implementation','migration','software','support')),
 add constraint hq_engagements_cadence_check check(cadence in ('one_time','monthly','annual')),
 add constraint hq_engagements_payment_check check((cadence in ('monthly','annual') and paid_cents=0) or (cadence='one_time' and paid_cents<=amount_cents));
create table public.hq_beta_cases (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 implementation_id uuid not null references public.hq_implementations(id),requirement_id uuid references public.hq_requirements(id),
 title text not null check(length(trim(title)) between 1 and 500),actor text not null check(length(trim(actor)) between 1 and 500),steps text not null check(length(trim(steps)) between 1 and 20000),expected text not null check(length(trim(expected)) between 1 and 20000),mandatory boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(implementation_id,requirement_id),unique(id,implementation_id)
);
create table public.hq_beta_runs (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 test_id uuid not null,implementation_id uuid not null,release text not null check(length(trim(release)) between 1 and 200),
 result text not null check(result in ('passed','failed','blocked')),actual text not null check(length(trim(actual)) between 1 and 20000),
 evidence text not null check(length(trim(evidence)) between 1 and 10000),tester text not null check(length(trim(tester)) between 1 and 500),
 recorded_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default now(),
 foreign key(test_id,implementation_id) references public.hq_beta_cases(id,implementation_id)
);
create table public.hq_defects (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),implementation_id uuid not null references public.hq_implementations(id),
 title text not null check(length(trim(title)) between 1 and 500),detail text not null check(length(trim(detail)) between 1 and 20000),
 severity text not null check(severity in ('critical','high','medium','low')),status text not null default 'open' check(status in ('open','in_progress','resolved','accepted')),
 owner text not null check(owner in ('Shawn','Neil')),due_on date not null,resolution text not null default '' check(length(resolution)<=10000),retest text not null default '' check(length(retest)<=10000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(status not in ('resolved','accepted') or (length(trim(resolution))>0 and length(trim(retest))>0)),check(status<>'accepted' or severity in ('medium','low'))
);
-- Preserve the existing sales/customer history without inventing acceptance.
insert into public.hq_opportunities(account_id,workspace_id,title,kind,stage,owner,next_action,due_on)
select id,workspace_id,company||' — initial engagement','implementation',case when stage in ('won','lost','proposal') then stage else 'discovery' end,owner,next_action,due_on from public.hq_accounts;
update public.hq_implementations i set opportunity_id=o.id from public.hq_opportunities o where o.account_id=i.account_id;

create function private.hq_sales_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.hq_implementations;o public.hq_opportunities;v jsonb;k text;qty numeric;price numeric;discount numeric;amount numeric;total numeric:=0;
begin
 if tg_op='UPDATE' then
  if old.workspace_id is distinct from new.workspace_id then raise exception 'Workspace cannot be changed.'; end if;
  new.updated_at:=clock_timestamp();
 end if;
 if tg_table_name='hq_opportunities' then
  if tg_op='UPDATE' and (old.account_id,old.kind) is distinct from (new.account_id,new.kind) then raise exception 'The customer and engagement type are preserved.'; end if;
  if tg_op='UPDATE' and new.stage='won' and old.stage<>'won' and not exists(select 1 from public.hq_proposals where opportunity_id=new.id and status='accepted') then raise exception 'Record acceptance of an issued agreement first.'; end if;
  if tg_op='INSERT' and new.stage='won' then raise exception 'Create a discovery opportunity first.'; end if;
 elsif tg_table_name='hq_requirements' then
  perform 1 from public.hq_opportunities where id=new.opportunity_id for update;
  if tg_op='UPDATE' and old.opportunity_id<>new.opportunity_id then raise exception 'Requirement links cannot be changed.'; end if;
 elsif tg_table_name='hq_proposals' then
  select * into o from public.hq_opportunities where id=new.opportunity_id for update;
  if not found then raise exception 'Opportunity not found.'; end if;
  if tg_op='INSERT' then
   if new.status<>'draft' then raise exception 'Create a draft estimate first.'; end if;
   if new.revision>1 and not exists(select 1 from public.hq_proposals where family_id=new.family_id and opportunity_id=new.opportunity_id and revision=new.revision-1 and status in ('superseded','declined')) then raise exception 'Revise the preceding issued offer first.';end if;
   new.requirements_snapshot:='[]';new.discovery_snapshot:='{}';new.issued_at:=null;new.accepted_by:=null;new.accepted_name:='';new.accepted_on:=null;new.evidence:='';
  else
   if (old.opportunity_id,old.account_id,old.family_id,old.revision,old.number) is distinct from (new.opportunity_id,new.account_id,new.family_id,new.revision,new.number) then raise exception 'Estimate identity is preserved.'; end if;
   if old.status<>'draft' and (old.document,old.lines,old.title,old.valid_until,old.deposit_cents,old.tax_cents,old.terms_reviewed,old.requirements_snapshot,old.discovery_snapshot,old.issued_at) is distinct from (new.document,new.lines,new.title,new.valid_until,new.deposit_cents,new.tax_cents,new.terms_reviewed,new.requirements_snapshot,new.discovery_snapshot,new.issued_at) then raise exception 'Issued agreements are frozen. Create a revision.'; end if;
   if old.status in ('accepted','declined','superseded') and to_jsonb(old)-'updated_at' is distinct from to_jsonb(new)-'updated_at' then raise exception 'This agreement is closed. Create a new opportunity for additional work.'; end if;
   if old.status='draft' and new.status not in ('draft','issued') then raise exception 'Issue the completed estimate before recording acceptance.'; end if;
   if old.status='issued' and new.status not in ('issued','accepted','declined','superseded') then raise exception 'Create a revision to change this offer.'; end if;
   if old.status=new.status and (old.accepted_name,old.accepted_on,old.evidence,old.accepted_by) is distinct from (new.accepted_name,new.accepted_on,new.evidence,new.accepted_by) then raise exception 'Use Record acceptance to retain customer approval.'; end if;
  end if;
  for v in select value from jsonb_array_elements(new.lines) loop
   if coalesce(v->>'cadence','') not in ('one_time','monthly','annual','usage') or coalesce(v->>'service','') not in ('blueprint','implementation','migration','software','support') or length(trim(coalesce(v->>'description','')))=0 then raise exception 'Complete every estimate line.'; end if;
   qty:=(v->>'quantity_units')::numeric;price:=(v->>'unit_cents')::numeric;discount:=(v->>'discount_cents')::numeric;
   if qty is null or price is null or discount is null or qty<>trunc(qty) or price<>trunc(price) or discount<>trunc(discount) or qty not between 1 and 1000000 or price not between 1 and 100000000 or discount<0 then raise exception 'Invalid estimate quantity or price.'; end if;
   amount:=round(qty*price/100)-discount;
   if amount<=0 or amount>100000000000 then raise exception 'Invalid estimate line total.'; end if;
   if v->>'cadence'='one_time' then total:=total+amount; end if;
  end loop;
  if new.deposit_cents>total+new.tax_cents then raise exception 'The deposit cannot exceed the one-time total.'; end if;
  if new.status='issued' and (tg_op='INSERT' or old.status='draft') then
   if not new.terms_reviewed or new.valid_until<(now() at time zone 'America/Denver')::date then raise exception 'Review the agreement terms and expiry before issuing.'; end if;
   foreach k in array array['seller','customer','objective','scope','exclusions','assumptions','timeline','payment','tax','subscription','support','rights','termination','legal'] loop
    if length(trim(coalesce(new.document->>k,'')))=0 or new.document->>k like '%[Complete%' then raise exception 'Complete the agreement section: %.',k; end if;
   end loop;
   if o.kind<>'blueprint' then
    foreach k in array array['outcomes','people','workflow','roles','systems','migration','rules','automation','security','commercial'] loop
     if coalesce(o.discovery#>>array['answers',k,'status'],'unknown') not in ('confirmed','not_applicable') or length(trim(coalesce(o.discovery#>>array['answers',k,'notes'],'')))=0 then raise exception 'Resolve the discovery section: %.',k; end if;
    end loop;
    if length(trim(coalesce(o.discovery->>'open_questions','')))>0 then raise exception 'Resolve the open discovery questions, or scope a Blueprint first.'; end if;
   end if;
   select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at),'[]') into new.requirements_snapshot from public.hq_requirements r where opportunity_id=o.id and priority<>'later';
   if not exists(select 1 from public.hq_requirements where opportunity_id=o.id and priority='must') then raise exception 'Add at least one must-have deliverable and acceptance test.'; end if;
   if not exists(select 1 from jsonb_array_elements(new.lines) l where l->>'cadence'<>'usage') then raise exception 'Include at least one fixed fee; describe usage charges separately.'; end if;
   new.discovery_snapshot:=o.discovery;new.issued_at:=clock_timestamp();
  end if;
  if new.status='accepted' and old.status='issued' then
   if new.valid_until<(now() at time zone 'America/Denver')::date then raise exception 'This offer has expired. Create and issue a revision.'; end if;
   if length(trim(new.accepted_name))=0 or length(trim(new.evidence))=0 or new.accepted_on is null or new.accepted_on<(new.issued_at at time zone 'America/Denver')::date or new.accepted_on>(now() at time zone 'America/Denver')::date then raise exception 'Record the authorized signer, valid acceptance date and signed-document reference.'; end if;
   new.accepted_by:=auth.uid();
  end if;
 elsif tg_table_name in ('hq_beta_cases','hq_beta_runs','hq_defects') then
  select * into p from public.hq_implementations where id=new.implementation_id for update;
  if p.status='live' then raise exception 'Move this project out of Live before changing beta records; use support for new production issues.'; end if;
  if tg_op='UPDATE' and old.implementation_id<>new.implementation_id then raise exception 'Project links cannot be changed.'; end if;
  if tg_table_name='hq_beta_cases' then
   if tg_op='UPDATE' then
    if old.requirement_id is not null then raise exception 'Contracted tests are preserved. Add a supplementary test for additional checks.'; end if;
   end if;
  end if;
  if tg_table_name='hq_beta_runs' then
   if tg_op='UPDATE' then raise exception 'Test evidence is append-only. Record a new test run.'; end if;
   if p.status not in ('testing','ready') then raise exception 'Move the project into Testing after internal checks before recording beta results.';end if;
   if new.release<>p.release or length(trim(p.release))=0 then raise exception 'Record this project release before running tests.'; end if;
   new.recorded_by:=auth.uid();new.created_at:=clock_timestamp();
  end if;
 end if;
 return new;
end $$;

do $$ declare t text;begin
 foreach t in array array['hq_opportunities','hq_requirements','hq_proposals','hq_beta_cases','hq_beta_runs','hq_defects'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('create policy hq_read on public.%I for select to authenticated using(private.can_read(workspace_id))',t);
  execute format('create policy hq_insert on public.%I for insert to authenticated with check(private.can_write(workspace_id))',t);
  execute format('create policy hq_update on public.%I for update to authenticated using(private.can_write(workspace_id)) with check(private.can_write(workspace_id))',t);
  execute format('create index %I on public.%I(workspace_id,updated_at desc)',t||'_updated',t);
  execute format('create trigger hq_sales_guard before insert or update on public.%I for each row execute function private.hq_sales_guard()',t);
  execute format('create trigger hq_audit before insert or update on public.%I for each row execute function private.audit_change()',t);
 end loop;
end $$;
revoke update on public.hq_beta_runs from authenticated;
create index hq_opportunities_account on public.hq_opportunities(account_id);
create index hq_requirements_opportunity on public.hq_requirements(opportunity_id);
create index hq_proposals_opportunity on public.hq_proposals(opportunity_id);
create index hq_beta_runs_latest on public.hq_beta_runs(test_id,release,created_at desc);
create index hq_defects_project on public.hq_defects(implementation_id);
create index hq_implementations_opportunity on public.hq_implementations(opportunity_id);
create index hq_beta_cases_requirement on public.hq_beta_cases(requirement_id);
create index hq_beta_runs_project on public.hq_beta_runs(implementation_id);
create index hq_beta_runs_recorder on public.hq_beta_runs(recorded_by);
create index hq_proposals_acceptor on public.hq_proposals(accepted_by);

-- Every new inquiry starts a discovery engagement, including webhook intake.
create function private.hq_start_discovery() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.hq_opportunities(workspace_id,account_id,title,kind,stage,owner,next_action,due_on)
 values(new.workspace_id,new.id,left(new.company||' — initial engagement',500),'implementation',case when new.stage in ('lost','proposal') then new.stage else 'discovery' end,new.owner,new.next_action,new.due_on);
 return new;
end $$;
create trigger hq_start_discovery after insert on public.hq_accounts for each row execute function private.hq_start_discovery();
grant select,insert on public.hq_opportunities to service_role;
revoke all on function private.hq_start_discovery() from public,anon,authenticated;

-- Won is now driven by agreement acceptance, not a manually entered fee.
create or replace function private.hq_create_handoff() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.stage='won' and old.stage<>'won' and not exists(select 1 from public.hq_proposals p join public.hq_opportunities o on o.id=p.opportunity_id where p.account_id=new.id and p.status='accepted' and o.kind<>'blueprint') then raise exception 'Accept an issued implementation agreement in Sales & delivery before marking won.';end if;
 return new;
end $$;
create function private.hq_accept_handoff() returns trigger language plpgsql security invoker set search_path='' as $$
declare o public.hq_opportunities;p uuid;v jsonb;idx integer:=0;item text;phase text;
begin
 if old.status<>new.status and new.status='issued' then update public.hq_opportunities set stage='proposal' where id=new.opportunity_id;end if;
 if old.status<>new.status and new.status='accepted' then
  select * into o from public.hq_opportunities where id=new.opportunity_id for update;
  for v in select value from jsonb_array_elements(new.lines) loop
   idx:=idx+1;
   if v->>'cadence'<>'usage' then insert into public.hq_engagements(workspace_id,account_id,service,description,cadence,amount_cents,status,proposal_id,proposal_line)
    values(new.workspace_id,new.account_id,v->>'service',v->>'description',v->>'cadence',round((v->>'quantity_units')::numeric*(v->>'unit_cents')::numeric/100)-(v->>'discount_cents')::bigint,'agreed',new.id,idx);end if;
  end loop;
  if new.tax_cents>0 then insert into public.hq_engagements(workspace_id,account_id,service,description,cadence,amount_cents,status,proposal_id,proposal_line) values(new.workspace_id,new.account_id,'implementation','One-time tax','one_time',new.tax_cents,'agreed',new.id,0);end if;
  insert into public.hq_implementations(workspace_id,account_id,opportunity_id,proposal_id,project_kind,owner,target_on,scope_snapshot)
   values(new.workspace_id,new.account_id,o.id,new.id,o.kind,o.owner,o.due_on,new.document->>'scope') returning id into p;
  if o.kind<>'blueprint' then
  for phase,item in select * from (values
   ('kickoff','Confirm signed scope, funding and success measures'),('kickoff','Collect secure access and customer dependencies'),
   ('build','Review the workflow, roles and system design'),('build','Demonstrate the first complete workflow'),
   ('build','Verify permissions, integrations, failures and calculations'),('build','Reconcile migration and verify recovery; document any exclusions'),
   ('beta','Prepare release, testers, scenarios and beta instructions'),('beta','Complete customer beta tests and retest corrections'),
   ('launch','Deliver training and operating instructions'),('launch','Approve cutover, rollback and final reconciliation'),
   ('launch','Record customer acceptance for this release'),('launch','Confirm support, billing start and follow-up dates')) as x(phase,item) loop
    insert into public.hq_tasks(workspace_id,account_id,implementation_id,title,phase,owner,due_on) values(new.workspace_id,new.account_id,p,item,phase,o.owner,o.due_on);
  end loop;
  end if;
  if o.kind='blueprint' then
   -- Blueprint work is design-only: replace the unsold build checklist with its deliverables.
   insert into public.hq_tasks(workspace_id,account_id,implementation_id,title,phase,owner,due_on)
    select new.workspace_id,new.account_id,p,title,'blueprint',o.owner,o.due_on from unnest(array['Confirm Blueprint scope and inputs','Map workflows, roles and constraints','Assess integration and migration feasibility','Review requirements, acceptance plan and build estimate']) title;
  end if;
  for v in select value from jsonb_array_elements(new.requirements_snapshot) loop
   insert into public.hq_beta_cases(workspace_id,implementation_id,requirement_id,title,actor,steps,expected,mandatory) values(new.workspace_id,p,(v->>'id')::uuid,v->>'title',v->>'actor',v->>'steps',v->>'expected',(v->>'priority')='must');
  end loop;
  update public.hq_opportunities set stage='won',next_action='Start authorized '||o.kind||' work' where id=o.id;
  if o.kind<>'blueprint' then update public.hq_accounts set scope=new.document->>'scope',stage='won' where id=new.account_id;
  elsif exists(select 1 from public.hq_accounts where id=new.account_id and stage<>'won') then update public.hq_accounts set stage='blueprint' where id=new.account_id;end if;
 end if;
 return new;
end $$;
create trigger hq_accept_handoff after update on public.hq_proposals for each row execute function private.hq_accept_handoff();

create function private.hq_delivery_gate() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.hq_implementations;
begin
 if tg_table_name='hq_tasks' then
  select * into p from public.hq_implementations where id=new.implementation_id for update;
  if p.proposal_id is not null and new.completed and length(trim(new.evidence))=0 then raise exception 'Record checklist evidence in Sales & delivery before completing this task.';end if;
 else
  if tg_op='UPDATE' and (old.opportunity_id,old.proposal_id,old.project_kind) is distinct from (new.opportunity_id,new.proposal_id,new.project_kind) then raise exception 'The accepted project links are preserved.';end if;
  if new.proposal_id is null then
   if tg_op='INSERT' then raise exception 'Accept an agreement to create a project.';end if;
   return new;end if;
  if not exists(select 1 from public.hq_proposals where id=new.proposal_id and account_id=new.account_id and opportunity_id=new.opportunity_id and status='accepted') then raise exception 'Project must match its accepted agreement.';end if;
  if tg_op='UPDATE' and new.release<>old.release then new.approval_name:='';new.approval_on:=null;new.approval_evidence:='';new.approval_release:='';end if;
  if new.status in ('building','testing','ready','live') and length(trim(new.funding_note))=0 then raise exception 'Record how the agreed funding condition has been satisfied before starting work.';end if;
  if new.status in ('testing','ready','live') and length(trim(new.release))=0 then raise exception 'Identify the release being tested.';end if;
  if new.status in ('testing','ready','live') and exists(select 1 from public.hq_tasks where implementation_id=new.id and phase in ('kickoff','build') and not completed) then raise exception 'Complete the kickoff and internal build checks before beta.';end if;
  if new.status in ('ready','live') or length(trim(new.approval_name))>0 then
   if not exists(select 1 from public.hq_beta_cases where implementation_id=new.id and mandatory) or exists(select 1 from public.hq_beta_cases c where c.implementation_id=new.id and c.mandatory and coalesce((select result from public.hq_beta_runs r where r.test_id=c.id and r.release=new.release order by created_at desc,id desc limit 1),'missing')<>'passed') then raise exception 'Pass every mandatory acceptance test on this release.';end if;
   if exists(select 1 from public.hq_defects where implementation_id=new.id and status<>'resolved' and (severity in ('critical','high') or status<>'accepted')) then raise exception 'Resolve blocking defects or document customer acceptance of minor exceptions.';end if;
  end if;
  if length(trim(new.approval_name))>0 then
   if new.approval_on is null or new.approval_on>(now() at time zone 'America/Denver')::date or length(trim(new.approval_evidence))=0 or new.approval_release<>new.release then raise exception 'Record the customer approval date, evidence and matching release.';end if;
  end if;
  if new.status='live' and (length(trim(new.approval_name))=0 or new.approval_release<>new.release) then raise exception 'Record customer acceptance of this release before launch.';end if;
 end if;
 return new;
end $$;
create trigger hq_delivery_gate before insert or update on public.hq_implementations for each row execute function private.hq_delivery_gate();
create trigger hq_delivery_gate before insert or update on public.hq_tasks for each row execute function private.hq_delivery_gate();
-- A new test/issue invalidates customer approval; release must be reviewed again.
create function private.hq_invalidate_approval() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.hq_implementations set status=case when status='ready' then 'testing' else status end,approval_name='',approval_on=null,approval_evidence='',approval_release='' where id=new.implementation_id and (approval_name<>'' or status='ready');
 return new;
end $$;
create trigger hq_invalidate_approval after insert on public.hq_beta_runs for each row execute function private.hq_invalidate_approval();
create trigger hq_invalidate_approval after insert or update on public.hq_defects for each row execute function private.hq_invalidate_approval();

-- Revisions clone an issued offer into a new draft without changing the old content.
create function public.hq_revise_proposal(p_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare old public.hq_proposals;n uuid;
begin
 if auth.uid() is null or not private.can_write('8ac08858-038c-41df-90a8-4a84f25cb400') then raise exception 'HQ write access required.';end if;
 select * into old from public.hq_proposals where id=p_id for update;
 if not found or old.status not in ('issued','declined','superseded') then raise exception 'Only an issued or declined offer can be revised.';end if;
 if exists(select 1 from public.hq_proposals where family_id=old.family_id and revision>old.revision) then raise exception 'A newer revision exists. Open that revision.';end if;
 if old.status='issued' then update public.hq_proposals set status='superseded' where id=old.id;end if;
 -- A new draft has its own immutable document number and references the predecessor in its document.
 insert into public.hq_proposals(workspace_id,account_id,opportunity_id,family_id,revision,title,valid_until,document,lines,deposit_cents,tax_cents)
 values(old.workspace_id,old.account_id,old.opportunity_id,old.family_id,old.revision+1,old.title||' (revision)',(now() at time zone 'America/Denver')::date+30,old.document||jsonb_build_object('previous_offer',old.number),old.lines,old.deposit_cents,old.tax_cents) returning id into n;
 return n;
end $$;
revoke all on function public.hq_revise_proposal(uuid) from public,anon;
grant execute on function public.hq_revise_proposal(uuid) to authenticated;
revoke all on function private.hq_sales_guard(),private.hq_accept_handoff(),private.hq_delivery_gate(),private.hq_invalidate_approval() from public,anon,authenticated;
-- Blueprint completion does not activate a software support relationship.
create or replace function private.hq_lifecycle_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and old.account_id is distinct from new.account_id then raise exception 'The linked account cannot be changed.';end if;
 if tg_table_name='hq_tickets' then
  if new.status='resolved' then
   if length(trim(new.resolution))=0 then raise exception 'Record the resolution before closing this ticket.';end if;
   new.resolved_at:=coalesce(new.resolved_at,now());
  else new.resolved_at:=null;end if;
 elsif tg_table_name='hq_implementations' then
  if new.status='live' and new.project_kind<>'blueprint' and not exists(select 1 from public.hq_support_plans where account_id=new.account_id) then raise exception 'Record the support owner, terms and first review date before going live.';end if;
 elsif tg_table_name='hq_subscriptions' then
  if not exists(select 1 from public.hq_accounts where id=new.account_id and stage='won') then raise exception 'Subscriptions require a won customer account.';end if;
 end if;
 return new;
end $$;
create or replace function private.hq_launch_support() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.hq_support_plans;
begin
 if new.status='live' and old.status<>'live' and new.project_kind<>'blueprint' then
  update public.hq_support_plans set launched_at=now() where account_id=new.account_id and launched_at is null returning * into p;
  if p.id is not null then
   insert into public.hq_tasks(workspace_id,account_id,title,owner,due_on) values(new.workspace_id,new.account_id,'Post-launch customer check-in',p.owner,p.next_review_on);
   update public.hq_accounts set next_action='Post-launch customer check-in',owner=p.owner,due_on=p.next_review_on where id=new.account_id;
  end if;
 end if;
 return new;
end $$;
create trigger hq_invalidate_approval after insert or update on public.hq_beta_cases for each row execute function private.hq_invalidate_approval();
create function private.hq_fee_snapshot_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.hq_proposals;v jsonb;
begin
 if tg_op='UPDATE' and (old.proposal_id,old.proposal_line) is distinct from (new.proposal_id,new.proposal_line) then raise exception 'Agreement fee links are preserved.';end if;
 if new.proposal_id is not null then
  select * into p from public.hq_proposals where id=new.proposal_id and account_id=new.account_id and status='accepted';
  if new.proposal_line=0 then
   if p.id is null or (new.service,new.description,new.cadence,new.amount_cents) is distinct from ('implementation','One-time tax','one_time',p.tax_cents) then raise exception 'Accepted tax is preserved.';end if;
   return new;end if;
  v:=p.lines->(new.proposal_line-1);
  if p.id is null or v is null or (new.service,new.description,new.cadence,new.amount_cents) is distinct from (v->>'service',v->>'description',v->>'cadence',(round((v->>'quantity_units')::numeric*(v->>'unit_cents')::numeric/100)-(v->>'discount_cents')::bigint)::bigint) then raise exception 'Accepted agreement fees are preserved. Create a change agreement.';end if;
 end if;
 return new;
end $$;
create trigger hq_fee_snapshot before insert or update on public.hq_engagements for each row execute function private.hq_fee_snapshot_guard();
revoke all on function private.hq_fee_snapshot_guard() from public,anon,authenticated;
