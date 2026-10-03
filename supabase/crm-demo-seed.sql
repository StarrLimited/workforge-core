-- Fictional demonstration workspace only. Never imports or copies HQ/customer records.
begin;
do $$
declare w uuid; p uuid; uid uuid; company_ids uuid[]:='{}'; contact_ids uuid[]:='{}'; stage_ids uuid[]; c uuid; item record; i integer; d uuid;
begin
 if exists(select 1 from public.workspaces where model='crm' and name='WorkForge CRM Demo') then return; end if;
 select m.user_id into uid from public.workspace_memberships m join public.workspaces ws on ws.id=m.workspace_id where ws.name='WorkForge HQ' and m.role='owner' and m.is_active limit 1;
 if uid is null then raise exception 'An existing WorkForge owner is required to provision the demo.'; end if;
 insert into public.workspaces(name,model,is_demo,timezone) values('WorkForge CRM Demo','crm',true,'America/Denver') returning id into w;
 insert into public.workspace_memberships(workspace_id,user_id,role,is_active) select w,m.user_id,m.role,true from public.workspace_memberships m join public.workspaces ws on ws.id=m.workspace_id where ws.name='WorkForge HQ' and m.is_active;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 p:=public.crm_create_pipeline(w,'New business');
 select array_agg(id order by position) into stage_ids from public.crm_stages where pipeline_id=p;
 for item in select * from (values ('Summit Property Group','Property management'),('Clearwater Services','Professional services'),('Aspen Ridge Construction','Construction'),('Northstar Commercial','Commercial services')) t(name,industry) loop
  insert into public.crm_companies(workspace_id,name,industry,address) values(w,item.name,item.industry,'Fictional company · demo only') returning id into c;
  company_ids:=array_append(company_ids,c);
 end loop;
 i:=0;
 for item in select * from (values ('Alex Morgan','alex.morgan@example.test','Meta','Operations Director'),('Jordan Lee','jordan.lee@example.test','Referral','Owner'),('Taylor Brooks','taylor.brooks@example.test','Google Ads','General Manager'),('Casey Wilson','casey.wilson@example.test','Website','Project Manager'),('Sam Rivera','sam.rivera@example.test','Meta','Owner'),('Drew Parker','drew.parker@example.test','Outbound','Purchasing Manager'),('Jamie Chen','jamie.chen@example.test','Google organic','Director'),('Riley Bennett','riley.bennett@example.test','Referral','Owner'),('Avery Collins','avery.collins@example.test','Meta','Office Manager'),('Reese Walker','reese.walker@example.test','Website','Managing Partner')) t(name,email,source,title) loop
  i:=i+1;
  insert into public.crm_contacts(workspace_id,name,email,job_title,source,company_id,owner_id,tags,lifecycle) values(w,item.name,item.email,item.title,item.source,company_ids[1+(i-1)%4],uid,array['Demo'],case when i>7 then 'lead' when i>5 then 'customer' else 'qualified' end) returning id into c;
  contact_ids:=array_append(contact_ids,c);
 end loop;
 i:=0;
 for item in select * from (values ('Annual service agreement',1250000,1,1,'Meta',0),('Multi-location rollout',2850000,2,2,'Referral',0),('Commercial maintenance plan',840000,3,2,'Google Ads',0),('Client onboarding package',640000,4,3,'Website',0),('Regional expansion project',1850000,5,3,'Meta',0),('Preferred supplier agreement',3200000,6,4,'Outbound',0),('Operations support package',960000,7,4,'Google organic',0),('Portfolio service renewal',2250000,8,5,'Referral',0),('New customer launch',760000,6,5,'Website',1),('Seasonal support contract',490000,7,3,'Google Ads',2)) t(title,value,contact_n,stage_n,source,closed) loop
  i:=i+1;
  insert into public.crm_deals(workspace_id,pipeline_id,stage_id,contact_id,title,value_cents,owner_id,source,expected_close,status,lost_reason)
  values(w,p,stage_ids[item.stage_n],contact_ids[item.contact_n],item.title,item.value,uid,item.source,current_date+(7+i*2),case item.closed when 1 then 'won' when 2 then 'lost' else 'open' end,case when item.closed=2 then 'Timing — prospect postponed the project.' else '' end) returning id into d;
  if i=1 then update public.crm_activities set due_at=now()-interval '1 day' where deal_id=d;
  elsif i=2 then update public.crm_activities set due_at=now()-interval '3 hours' where deal_id=d;
  elsif i=3 then update public.crm_activities set completed_at=now()-interval '1 hour',outcome='Demo: initial call completed. Schedule a site visit.' where deal_id=d;
  elsif i=4 then update public.crm_activities set kind='meeting',title='Discovery meeting',due_at=now()+interval '2 hours' where deal_id=d;
  end if;
  insert into public.crm_notes(workspace_id,contact_id,deal_id,body,author_id) values(w,contact_ids[item.contact_n],d,'Fictional demo opportunity. Use this record to explore the sales workflow; it is not a real customer.',uid);
 end loop;
end $$;
commit;
