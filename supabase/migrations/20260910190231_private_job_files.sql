create policy no_direct_invitation_access on private.workspace_invitations for all to authenticated using (false) with check (false);
create table public.file_records(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,work_order_id uuid not null,
 name text not null check(length(name) between 1 and 200),object_path text not null unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
 size_bytes integer not null check(size_bytes>0 and size_bytes<=3145728),
 created_at timestamptz not null default now(),
 check(split_part(object_path,'/',1)=workspace_id::text and split_part(object_path,'/',2)=work_order_id::text),
 foreign key(workspace_id,work_order_id) references public.work_orders(workspace_id,id)
);
alter table public.file_records enable row level security;
create policy member_read on public.file_records for select to authenticated using (private.can_read(workspace_id));
create policy member_insert on public.file_records for insert to authenticated with check(private.can_write(workspace_id));
revoke all on public.file_records from anon,authenticated;
grant select on public.file_records to authenticated;
grant insert(workspace_id,work_order_id,name,object_path,mime_type,size_bytes) on public.file_records to authenticated;
create index files_work_order on public.file_records(workspace_id,work_order_id);
create trigger audit_record before insert on public.file_records for each row execute function private.audit_change();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('workforge-files','workforge-files',false,3145728,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
create function private.file_workspace_allowed(path text,writable boolean) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare w uuid; o uuid;
begin
 if auth.uid() is null then return false; end if;
 begin w:=split_part(path,'/',1)::uuid;o:=split_part(path,'/',2)::uuid; exception when invalid_text_representation then return false; end;
 if not exists(select 1 from public.work_orders where workspace_id=w and id=o) then return false; end if;
 return case when writable then private.can_write(w) else private.can_read(w) end;
end; $$;
revoke all on function private.file_workspace_allowed(text,boolean) from public,anon;
grant execute on function private.file_workspace_allowed(text,boolean) to authenticated;
create policy workforge_file_read on storage.objects for select to authenticated using(bucket_id='workforge-files' and private.file_workspace_allowed(name,false));
create policy workforge_file_insert on storage.objects for insert to authenticated with check(bucket_id='workforge-files' and private.file_workspace_allowed(name,true));
create policy workforge_orphan_cleanup on storage.objects for delete to authenticated using(bucket_id='workforge-files' and owner_id=(select auth.uid())::text and private.file_workspace_allowed(name,true) and not exists(select 1 from public.file_records f where f.object_path=name));
