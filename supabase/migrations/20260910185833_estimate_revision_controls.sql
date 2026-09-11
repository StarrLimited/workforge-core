create function private.save_budget(w uuid,oid uuid,labor bigint,materials bigint,margin numeric,scope_text text) returns void language plpgsql security definer set search_path='' as $$
declare o public.work_orders; v integer;
begin
 if auth.uid() is null or not private.can_write(w) then raise exception 'Workspace write access required.'; end if;
 select * into o from public.work_orders where workspace_id=w and id=oid for update;
 if not found then raise exception 'Work order not found.'; end if;
 if o.stage not in ('lead','appointment','estimated') then raise exception 'An accepted estimate is locked.'; end if;
 if labor is null or materials is null or margin is null or labor<0 or materials<0 or margin<0 or margin>=100 then raise exception 'Invalid cost or margin.'; end if;
 if o.stage='estimated' and labor+materials<=0 then raise exception 'The estimate must have a positive budget.'; end if;
 update public.work_orders set labor_cost_cents=labor,material_cost_cents=materials,target_margin=margin,description=scope_text where id=oid;
 if o.stage='estimated' then
  select coalesce(max(version),0)+1 into v from public.estimate_versions where work_order_id=oid;
  insert into public.estimate_versions(workspace_id,work_order_id,version,scope,labor_cost_cents,material_cost_cents,margin_percent,price_cents)
   values(w,oid,v,scope_text,labor,materials,margin,ceil((labor+materials)::numeric/(1-margin/100)));
 end if;
end; $$;
create function public.save_field_budget(p_workspace_id uuid,p_order_id uuid,p_labor bigint,p_materials bigint,p_margin numeric,p_scope text) returns void language sql security invoker set search_path='' as $$
 select private.save_budget(p_workspace_id,p_order_id,p_labor,p_materials,p_margin,p_scope);
$$;
revoke update on public.work_orders from authenticated;
revoke update(title,description,labor_cost_cents,material_cost_cents,target_margin) on public.work_orders from authenticated;
revoke all on function private.save_budget(uuid,uuid,bigint,bigint,numeric,text) from public,anon;
revoke all on function public.save_field_budget(uuid,uuid,bigint,bigint,numeric,text) from public,anon;
grant execute on function private.save_budget(uuid,uuid,bigint,bigint,numeric,text),public.save_field_budget(uuid,uuid,bigint,bigint,numeric,text) to authenticated;
create index work_order_contact on public.work_orders(workspace_id,contact_id);
create index work_order_partner on public.work_orders(workspace_id,assigned_partner_id);
create index appointments_order on public.appointments(workspace_id,work_order_id);
create index tasks_order on public.tasks(workspace_id,work_order_id);
create index purchases_order on public.purchase_orders(workspace_id,work_order_id);
create index purchases_partner on public.purchase_orders(workspace_id,partner_id);
create index invoice_estimate on public.invoice_handoffs(estimate_id);
