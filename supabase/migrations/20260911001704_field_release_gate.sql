-- Stage the richer workflow without breaking the existing 0.1 interface.
-- Existing workspaces retain v1 completion behavior until the v2 app is live.
alter table public.workspaces add column field_workflow_version integer not null default 1 check(field_workflow_version in (1,2));
-- Newly provisioned workspaces use the new workflow from the start.
alter table public.workspaces alter column field_workflow_version set default 2;
create or replace function private.guard_field_order() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.stage in ('approved','scheduled','in_progress','completed','invoice_ready') and (old.estimate_lines,old.discount_percent,old.tax_rate,old.deposit_percent,old.terms,old.valid_until) is distinct from (new.estimate_lines,new.discount_percent,new.tax_rate,new.deposit_percent,new.terms,new.valid_until) then raise exception 'The accepted estimate is locked.';end if;
 if new.stage is distinct from old.stage then
  if exists(select 1 from public.field_profiles where work_order_id=new.id and sales_status='lost') then raise exception 'Reopen this opportunity before advancing.';end if;
  if new.stage='approved' and new.valid_until<(select (now() at time zone timezone)::date from public.workspaces where id=new.workspace_id) then raise exception 'The estimate expired. Save a new validity date and revision.';end if;
  if new.stage='completed' and (select field_workflow_version from public.workspaces where id=new.workspace_id)>=2 and not exists(select 1 from public.field_profiles where work_order_id=new.id and walkthrough_complete) then raise exception 'Record the completed customer walkthrough first.';end if;
 end if;
 if new.assigned_partner_id is distinct from old.assigned_partner_id and not exists(select 1 from public.partners where id=new.assigned_partner_id and workspace_id=new.workspace_id and status='active') then raise exception 'Choose an active crew.';end if;
 return new;
end $$;
