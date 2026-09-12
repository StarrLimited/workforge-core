-- Copy from an RLS-scoped snapshot; no direct work-order UPDATE grant is needed.
create or replace function public.copy_demo_field_job(p_workspace_id uuid,p_order_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare source_order public.work_orders; new_id uuid; stamp timestamptz; lines jsonb;
begin
 if auth.uid() is null or not private.can_write(p_workspace_id) then raise exception 'Workspace write access required.';end if;
 if not exists(select 1 from public.workspaces where id=p_workspace_id and is_demo and model='field') then raise exception 'Editable demo copies are available only in a Field demonstration workspace.';end if;
 select * into source_order from public.work_orders where workspace_id=p_workspace_id and id=p_order_id;
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
