-- Add internal work orders without changing amounts or approval controls.
alter table public.purchase_orders drop constraint purchase_orders_order_kind_check;
alter table public.purchase_orders add constraint purchase_orders_order_kind_check check(order_kind in ('materials','subcontract','internal'));

create or replace function private.guard_field_purchase() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.partners where id=new.partner_id and workspace_id=new.workspace_id and
   ((new.order_kind='materials' and kind='vendor') or (new.order_kind='subcontract' and kind='subcontractor') or (new.order_kind='internal' and kind='crew')))
 then raise exception 'Choose a vendor for materials, a subcontractor for subcontract work, or an internal crew for an internal work order.';end if;
 if new.status in ('ordered','received') and not exists(select 1 from public.work_orders where id=new.work_order_id and workspace_id=new.workspace_id and stage in ('approved','scheduled','in_progress','completed','invoice_ready')) then raise exception 'Approve the customer estimate before issuing purchases or production assignments.';end if;
 if new.status in ('ordered','received') and not exists(select 1 from public.partners where id=new.partner_id and workspace_id=new.workspace_id and status='active') then raise exception 'This partner is on hold or inactive.';end if;
 return new;
end $$;

update public.purchase_orders p set order_kind='internal' from public.partners v
where p.partner_id=v.id and p.workspace_id=v.workspace_id and p.order_kind='subcontract' and v.kind='crew';

-- Save the current form and create the first proposal in one transaction.
-- Existing RPCs retain their row locks, workspace checks, and approval protection.
create function public.save_and_prepare_field_estimate(p_workspace_id uuid,p_order_id uuid,p_expected timestamptz,p_lines jsonb,p_scope text,p_margin numeric,p_discount numeric,p_tax numeric,p_deposit numeric,p_terms text,p_valid_until date)
returns void language plpgsql security invoker set search_path='' as $$
declare current_stage text;
begin
 perform public.save_field_estimate(p_workspace_id,p_order_id,p_expected,p_lines,p_scope,p_margin,p_discount,p_tax,p_deposit,p_terms,p_valid_until);
 select stage into current_stage from public.work_orders where workspace_id=p_workspace_id and id=p_order_id;
 if current_stage='appointment' then
  if not exists(select 1 from public.field_profiles where workspace_id=p_workspace_id and work_order_id=p_order_id and consultation_complete) then raise exception 'Save the completed consultation before creating the proposal.';end if;
  perform public.advance_field_order(p_workspace_id,p_order_id,'appointment','estimated');
 end if;
end $$;
revoke all on function public.save_and_prepare_field_estimate(uuid,uuid,timestamptz,jsonb,text,numeric,numeric,numeric,numeric,text,date) from public,anon;
grant execute on function public.save_and_prepare_field_estimate(uuid,uuid,timestamptz,jsonb,text,numeric,numeric,numeric,numeric,text,date) to authenticated;

-- A fresh copy lets demo users repeat the entire workflow without unlocking or
-- resetting an accepted estimate, its approval, financial records, or history.
create function public.copy_demo_field_job(p_workspace_id uuid,p_order_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare source_order public.work_orders; new_id uuid; stamp timestamptz; lines jsonb;
begin
 if auth.uid() is null or not private.can_write(p_workspace_id) then raise exception 'Workspace write access required.';end if;
 if not exists(select 1 from public.workspaces where id=p_workspace_id and is_demo and model='field') then raise exception 'Editable demo copies are available only in a Field demonstration workspace.';end if;
 select * into source_order from public.work_orders where workspace_id=p_workspace_id and id=p_order_id for share;
 if not found then raise exception 'Work order not found.';end if;
 new_id:=public.create_customer_job(p_workspace_id,source_order.contact_id,'Demo copy · '||left(source_order.title,180),source_order.description);
 select updated_at into stamp from public.work_orders where id=new_id;
 lines:=source_order.estimate_lines;
 if jsonb_array_length(lines)=0 and source_order.labor_cost_cents+source_order.material_cost_cents>0 then
  lines:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'product_id',null,'name',source_order.title,'description',left(source_order.description,3000),'quantity',1,'unit','job','material_cents',source_order.material_cost_cents,'labor_cents',source_order.labor_cost_cents,'unit_price_cents',ceil((source_order.material_cost_cents+source_order.labor_cost_cents)::numeric/(1-source_order.target_margin/100)),'taxable',false));
 end if;
 if jsonb_array_length(lines)>0 then
  perform public.save_field_estimate(p_workspace_id,new_id,stamp,lines,source_order.description,source_order.target_margin,source_order.discount_percent,source_order.tax_rate,source_order.deposit_percent,source_order.terms,null);
 end if;
 insert into public.field_profiles(workspace_id,work_order_id,service,source,sales_owner,job_address)
 select p_workspace_id,new_id,service,source,sales_owner,job_address from public.field_profiles where workspace_id=p_workspace_id and work_order_id=p_order_id;
 return new_id;
end $$;
revoke all on function public.copy_demo_field_job(uuid,uuid) from public,anon;
grant execute on function public.copy_demo_field_job(uuid,uuid) to authenticated;
