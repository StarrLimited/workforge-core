do $$
declare w uuid; c1 uuid; c2 uuid; c3 uuid; crew uuid; vendor uuid; o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid;
begin
 if exists(select 1 from public.workspaces where name='Juniper Field Services' and is_demo) then return; end if;
 insert into public.workspaces(name,model,is_demo) values('Juniper Field Services','field',true) returning id into w;
 insert into public.contacts(workspace_id,name,email,phone,address) values(w,'Alex Morgan','alex@example.com','719-555-0101','101 Example Lane, Colorado Springs, CO') returning id into c1;
 insert into public.contacts(workspace_id,name,email,phone,address) values(w,'Jordan Lee','jordan@example.com','719-555-0102','202 Sample Court, Colorado Springs, CO') returning id into c2;
 insert into public.contacts(workspace_id,name,email,phone,address) values(w,'Casey Brooks','casey@example.com','303-555-0103','303 Demonstration Drive, Denver, CO') returning id into c3;
 insert into public.partners(workspace_id,name,kind,phone) values(w,'Summit Crew','crew','719-555-0110') returning id into crew;
 insert into public.partners(workspace_id,name,kind,phone) values(w,'Pine Creek Finishers','subcontractor','303-555-0111');
 insert into public.partners(workspace_id,name,kind,phone) values(w,'Frontier Materials — Demo','vendor','719-555-0112') returning id into vendor;
 insert into public.work_orders(workspace_id,title,contact_id,description,stage,labor_cost_cents,material_cost_cents,target_margin,scheduled_at,assigned_partner_id)
 values(w,'Exterior repaint',c1,'Prepare siding, repair minor surface defects, prime exposed substrate and apply two finish coats. Fictional demonstration scope.','scheduled',240000,120000,40,((current_date+1)::timestamp+interval '9 hours') at time zone 'America/Denver',crew) returning id into o1;
 insert into public.work_orders(workspace_id,title,contact_id,description,stage,labor_cost_cents,material_cost_cents,target_margin)
 values(w,'Backyard refresh',c2,'Remove weeds, refresh mulch beds and install a simple planting plan. Fictional demonstration scope.','estimated',180000,90000,40) returning id into o2;
 insert into public.work_orders(workspace_id,title,contact_id,description,stage,labor_cost_cents,material_cost_cents,target_margin,scheduled_at,assigned_partner_id)
 values(w,'Interior living spaces',c3,'Protect floors and furnishings, prepare walls and repaint living areas. Fictional demonstration scope.','in_progress',210000,60000,40,((current_date)::timestamp+interval '8 hours') at time zone 'America/Denver',crew) returning id into o3;
 insert into public.work_orders(workspace_id,title,contact_id,description,stage,labor_cost_cents,material_cost_cents,target_margin)
 values(w,'Fence staining',c1,'Inspect and prepare existing fence before staining. Fictional demonstration scope.','appointment',90000,30000,40) returning id into o4;
 insert into public.work_orders(workspace_id,title,contact_id,description)
 values(w,'Seasonal property care',c2,'Discuss recurring maintenance needs. Fictional demonstration scope.') returning id into o5;
 insert into public.estimate_versions(workspace_id,work_order_id,version,scope,labor_cost_cents,material_cost_cents,margin_percent,price_cents,status,approved_by,approved_at)
 select w,id,1,description,labor_cost_cents,material_cost_cents,target_margin,ceil((labor_cost_cents+material_cost_cents)::numeric/(1-target_margin/100)),
 case when id=o2 then 'draft' else 'approved' end,
 case when id=o1 then 'Alex Morgan (demo)' when id=o3 then 'Casey Brooks (demo)' else null end,
 case when id=o2 then null else now() end from public.work_orders where id in(o1,o2,o3);
 insert into public.appointments(workspace_id,work_order_id,title,starts_at,ends_at) values
 (w,o4,'Fence staining consultation',((current_date+1)::timestamp+interval '13 hours') at time zone 'America/Denver',((current_date+1)::timestamp+interval '14 hours') at time zone 'America/Denver'),
 (w,o5,'Property care walkthrough',((current_date+2)::timestamp+interval '10 hours') at time zone 'America/Denver',((current_date+2)::timestamp+interval '11 hours') at time zone 'America/Denver');
 insert into public.tasks(workspace_id,title,due_on,work_order_id) values
 (w,'Confirm color selection with Alex',current_date,o1),
 (w,'Review the backyard estimate with Jordan',current_date+1,o2),
 (w,'Complete the final room walkthrough',current_date+1,o3),
 (w,'Prepare the fence consultation',current_date+1,o4);
 insert into public.purchase_orders(workspace_id,work_order_id,partner_id,description,cost_cents,status) values
 (w,o1,vendor,'Primer, finish coating and masking supplies',120000,'ordered'),
 (w,o3,vendor,'Interior coating and surface preparation supplies',60000,'received');
end; $$;
