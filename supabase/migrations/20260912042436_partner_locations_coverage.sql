alter table public.partners
 add column primary_region text not null default '' check(length(primary_region)<=200),
 add column coverage_area text not null default '' check(length(coverage_area)<=2000);
grant update(primary_region,coverage_area) on public.partners to authenticated;

create table public.partner_locations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 partner_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 200),
 address text not null check(length(trim(address)) between 1 and 400),
 city text not null default '' check(length(city)<=100),
 region text not null default '' check(length(region)<=100),
 postal_code text not null default '' check(length(postal_code)<=20),
 contact_name text not null default '' check(length(contact_name)<=200),
 phone text not null default '' check(length(phone)<=40),
 notes text not null default '' check(length(notes)<=2000),
 foreign key(workspace_id,partner_id) references public.partners(workspace_id,id)
);
create index partner_locations_workspace_partner on public.partner_locations(workspace_id,partner_id);
alter table public.partner_locations enable row level security;
create policy member_read on public.partner_locations for select to authenticated using(private.can_read(workspace_id));
create policy member_insert on public.partner_locations for insert to authenticated with check(private.can_write(workspace_id));
create policy member_update on public.partner_locations for update to authenticated using(private.can_write(workspace_id)) with check(private.can_write(workspace_id));
create policy member_delete on public.partner_locations for delete to authenticated using(private.can_write(workspace_id));
revoke all on public.partner_locations from public,anon,authenticated;
grant select,delete on public.partner_locations to authenticated;
grant insert(workspace_id,partner_id,name,address,city,region,postal_code,contact_name,phone,notes) on public.partner_locations to authenticated;
grant update(name,address,city,region,postal_code,contact_name,phone,notes) on public.partner_locations to authenticated;

create function private.guard_partner_location() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.partners where workspace_id=new.workspace_id and id=new.partner_id and kind='vendor') then
  raise exception 'Choose a vendor in this workspace for the location.';
 end if;
 return new;
end $$;
revoke all on function private.guard_partner_location() from public,anon,authenticated;
create trigger guard_partner_location before insert or update on public.partner_locations for each row execute function private.guard_partner_location();
