-- Pipeline-first sales workflow; tenant boundaries and existing records are preserved.
alter table public.crm_stages
 add column purpose text not null default '' check(length(purpose)<=1000),
 add column checklist text[] not null default '{}' check(cardinality(checklist)<=12 and octet_length(checklist::text)<=6000),
 add column stale_days integer not null default 7 check(stale_days between 1 and 365);
alter table public.crm_deals
 add column priority text not null default 'normal' check(priority in ('low','normal','high')),
 add column need text not null default '' check(length(need)<=5000),
 add column budget text not null default '' check(length(budget)<=1000),
 add column decision_maker text not null default '' check(length(decision_maker)<=1000),
 add column buying_timeline text not null default '' check(length(buying_timeline)<=1000),
 add column proposal_summary text not null default '' check(length(proposal_summary)<=10000),
 add column proposal_url text not null default '' check(length(proposal_url)<=1000 and (proposal_url='' or proposal_url ~* '^https?://[^[:space:]]+$')),
 add column proposal_status text not null default 'draft' check(proposal_status in ('draft','shared','accepted','declined')),
 add column proposal_sent_on date,
 add column proposal_valid_until date,
 add column completed_steps text[] not null default '{}' check(cardinality(completed_steps)<=200 and octet_length(completed_steps::text)<=60000);

-- Expand only the original standard pipeline, leaving custom stage orders intact.
do $$ declare p record; begin
 for p in select pipeline_id,workspace_id from public.crm_stages group by pipeline_id,workspace_id
 having array_agg(name order by position)=array['New lead','Contacted','Qualified','Proposal sent','Negotiation'] loop
  update public.crm_stages set position=position+1 where pipeline_id=p.pipeline_id and position>=2;
  insert into public.crm_stages(workspace_id,pipeline_id,name,position,probability,followup_days)
  values(p.workspace_id,p.pipeline_id,'Discovery',2,30,2);
 end loop;
end $$;
update public.crm_stages set purpose='Review the inquiry, assign an owner, and make the first contact.',checklist=array['Confirm contact information','Assign a deal owner','Make the first contact attempt'],stale_days=2 where name='New lead' and purpose='';
update public.crm_stages set purpose='Outreach has been made. Await a response and book discovery; no conversation or meeting is implied.',checklist=array['Log the outreach outcome','Schedule the next contact attempt','Book a discovery conversation'],stale_days=5 where name='Contacted' and purpose='';
update public.crm_stages set purpose='Understand the problem, buying process, and timing before qualifying the opportunity.',checklist=array['Hold the discovery conversation','Capture needs and budget','Identify the decision maker and timing'],stale_days=7 where name='Discovery' and purpose='';
update public.crm_stages set purpose='Confirm a real fit and agree on the scope to propose.',checklist=array['Confirm the solution fits their needs','Agree on scope and success criteria','Confirm budget and decision process'],stale_days=7 where name='Qualified' and purpose='';
update public.crm_stages set purpose='Record the proposal, confirm it was received, and book a review.',checklist=array['Record proposal details and shared date','Confirm the buyer received the proposal','Schedule a proposal review'],stale_days=7 where name='Proposal sent' and purpose='';
update public.crm_stages set purpose='Resolve objections and agree on a decision date. Close won or record the loss reason.',checklist=array['Resolve open questions and objections','Confirm final amount and decision date','Record a clear won or lost outcome'],stale_days=10 where name='Negotiation' and purpose='';

create or replace function public.crm_create_pipeline(w uuid,p_name text) returns uuid language plpgsql security invoker set search_path='' as $$
declare p uuid;
begin
 insert into public.crm_pipelines(workspace_id,name) values(w,p_name) returning id into p;
 insert into public.crm_stages(workspace_id,pipeline_id,name,position,probability,followup_days,stale_days,purpose,checklist) values
(w,p,'New lead',0,10,0,2,'Review the inquiry, assign an owner, and make the first contact.',array['Confirm contact information','Assign a deal owner','Make the first contact attempt']),
(w,p,'Contacted',1,20,2,5,'Outreach has been made. Await a response and book discovery; no conversation or meeting is implied.',array['Log the outreach outcome','Schedule the next contact attempt','Book a discovery conversation']),
(w,p,'Discovery',2,30,2,7,'Understand the problem, buying process, and timing before qualifying the opportunity.',array['Hold the discovery conversation','Capture needs and budget','Identify the decision maker and timing']),
(w,p,'Qualified',3,40,3,7,'Confirm a real fit and agree on the scope to propose.',array['Confirm the solution fits their needs','Agree on scope and success criteria','Confirm budget and decision process']),
(w,p,'Proposal sent',4,60,3,7,'Record the proposal, confirm it was received, and book a review.',array['Record proposal details and shared date','Confirm the buyer received the proposal','Schedule a proposal review']),
(w,p,'Negotiation',5,80,2,10,'Resolve objections and agree on a decision date. Close won or record the loss reason.',array['Resolve open questions and objections','Confirm final amount and decision date','Record a clear won or lost outcome']);
 return p;
end $$;
create or replace function private.crm_log() returns trigger language plpgsql security definer set search_path='' as $$
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
   if delay_days is not null and not exists(select 1 from public.crm_activities where deal_id=new.id and completed_at is null) then
    insert into public.crm_activities(workspace_id,contact_id,deal_id,owner_id,title,kind,due_at,automatic)
    values(new.workspace_id,new.contact_id,new.id,new.owner_id,'Follow up: '||left(new.title,240),'call',now()+make_interval(days=>delay_days),true);
   end if;
  end if;
 end if;
 return new;
end $$;

-- New contact (optional), opportunity, and first action are a single transaction.
create function public.crm_open_opportunity(w uuid,p jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare cid uuid; did uuid; aid uuid; oid uuid; next_at timestamptz;
begin
 if auth.uid() is null or not private.can_write(w) then raise exception 'CRM write access required.';end if;
 oid:=nullif(p->>'owner_id','')::uuid;
 next_at:=(p->>'next_at')::timestamptz;
 if next_at is null or length(trim(coalesce(p->>'next_title',''))) not between 1 and 300 then raise exception 'Schedule the first activity.';end if;
 cid:=nullif(p->>'contact_id','')::uuid;
 if cid is null then
  insert into public.crm_contacts(workspace_id,name,email,phone,source,owner_id)
  values(w,p->>'contact_name',coalesce(p->>'contact_email',''),coalesce(p->>'contact_phone',''),p->>'source',oid) returning id into cid;
 elsif not exists(select 1 from public.crm_contacts where id=cid and workspace_id=w and lifecycle<>'archived') then raise exception 'Choose an active contact in this workspace.';
 end if;
 insert into public.crm_deals(workspace_id,contact_id,pipeline_id,stage_id,title,value_cents,owner_id,source,expected_close,priority)
 values(w,cid,(p->>'pipeline_id')::uuid,(p->>'stage_id')::uuid,p->>'title',(p->>'value_cents')::bigint,oid,p->>'source',nullif(p->>'expected_close','')::date,coalesce(p->>'priority','normal')) returning id into did;
 select id into aid from public.crm_activities where workspace_id=w and deal_id=did and automatic and completed_at is null order by created_at limit 1;
 if aid is not null then
  update public.crm_activities set title=p->>'next_title',due_at=next_at,automatic=false where id=aid and workspace_id=w;
 else
  insert into public.crm_activities(workspace_id,contact_id,deal_id,owner_id,title,kind,due_at) values(w,cid,did,oid,p->>'next_title','call',next_at);
 end if;
 return did;
end $$;
revoke all on function public.crm_open_opportunity(uuid,jsonb) from public,anon;
grant execute on function public.crm_open_opportunity(uuid,jsonb) to authenticated;

-- Log a touchpoint, complete a selected task, schedule the next step, and optionally
-- advance the first outreach to Contacted. Row locking and version checks avoid lost updates.
create function public.crm_log_touchpoint(w uuid,did uuid,expected timestamptz,p jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare d public.crm_deals; aid uuid; sid uuid; next_at timestamptz; result_text text;
begin
 if auth.uid() is null or not private.can_write(w) then raise exception 'CRM write access required.';end if;
 select * into d from public.crm_deals where id=did and workspace_id=w for update;
 if not found then raise exception 'Deal not found.';end if;
 if expected is null or d.updated_at<>expected then raise exception 'This deal changed. Refresh before logging the activity.';end if;
 result_text:=trim(coalesce(p->>'outcome',''));
 if length(result_text) not between 1 and 3000 then raise exception 'Record the conversation outcome.';end if;
 next_at:=nullif(p->>'next_at','')::timestamptz;
 if d.status='open' and (next_at is null or length(trim(coalesce(p->>'next_title',''))) not between 1 and 300) then raise exception 'Schedule a next step for this open deal.';end if;
 aid:=nullif(p->>'activity_id','')::uuid;
 if aid is not null then
  update public.crm_activities set completed_at=now(),outcome=result_text,kind=p->>'kind'
  where id=aid and workspace_id=w and deal_id=did and completed_at is null;
  if not found then raise exception 'The activity is already complete or belongs to another deal.';end if;
 else
  insert into public.crm_activities(workspace_id,contact_id,deal_id,owner_id,title,kind,due_at,completed_at,outcome)
  values(w,d.contact_id,did,auth.uid(),p->>'title',p->>'kind',now(),now(),result_text);
 end if;
 if next_at is not null then
  insert into public.crm_activities(workspace_id,contact_id,deal_id,owner_id,title,kind,due_at)
  values(w,d.contact_id,did,coalesce(d.owner_id,auth.uid()),p->>'next_title',coalesce(p->>'next_kind','call'),next_at);
 end if;
 if coalesce((p->>'advance_contacted')::boolean,false) and d.status='open' and exists(select 1 from public.crm_stages where id=d.stage_id and name='New lead') then
  select id into sid from public.crm_stages where pipeline_id=d.pipeline_id and name='Contacted' order by position limit 1;
 end if;
 update public.crm_deals set stage_id=coalesce(sid,stage_id),updated_at=now() where id=did and workspace_id=w;
end $$;
revoke all on function public.crm_log_touchpoint(uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.crm_log_touchpoint(uuid,uuid,timestamptz,jsonb) to authenticated;

-- Swap adjacent stages without breaking their identity or moving any opportunities.
create function public.crm_reorder_stage(w uuid,sid uuid,direction integer) returns void language plpgsql security invoker set search_path='' as $$
declare s public.crm_stages; adjacent public.crm_stages;
begin
 if auth.uid() is null or not private.crm_admin(w) then raise exception 'CRM administrator access required.';end if;
 if direction is null or direction not in (-1,1) then raise exception 'Choose a valid direction.';end if;
 select * into s from public.crm_stages where workspace_id=w and id=sid;
 if not found then raise exception 'Stage not found.';end if;
 perform 1 from public.crm_pipelines where workspace_id=w and id=s.pipeline_id for update;
 select * into s from public.crm_stages where workspace_id=w and id=sid;
 if direction=-1 then select * into adjacent from public.crm_stages where pipeline_id=s.pipeline_id and position<s.position order by position desc limit 1;
 else select * into adjacent from public.crm_stages where pipeline_id=s.pipeline_id and position>s.position order by position limit 1;end if;
 if adjacent.id is null then return;end if;
 update public.crm_stages set position=case when id=s.id then adjacent.position else s.position end where workspace_id=w and id in (s.id,adjacent.id);
end $$;
revoke all on function public.crm_reorder_stage(uuid,uuid,integer) from public,anon;
grant execute on function public.crm_reorder_stage(uuid,uuid,integer) to authenticated;
