// Install @electric-sql/pglite@0.5.8 in a temporary tools directory; supply its index module via PGLITE_MODULE.
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../', import.meta.url));
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,private to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.workspaces(id uuid primary key,name text,model text,is_demo boolean,timezone text);
create table public.workspace_memberships(workspace_id uuid references public.workspaces(id),user_id uuid references auth.users(id),role text,is_active boolean default true,primary key(workspace_id,user_id));
create table private.workspace_invitations(workspace_id uuid references public.workspaces(id),email text,role text);
create table public.audit_events(id uuid default gen_random_uuid(),workspace_id uuid,work_order_id uuid,actor_id uuid,action text,created_at timestamptz default now());
alter table public.workspace_memberships enable row level security;
create policy own_memberships on public.workspace_memberships for select to authenticated using(user_id=(select auth.uid()));
grant select on public.workspace_memberships to authenticated;
`);
const original=readFileSync(root+'/supabase/migrations/20260910184931_workforge_core_field.sql','utf8');
for(const fn of ['can_read','can_write','audit_change']){
 const start=original.indexOf('create function private.'+fn+'(');
 const end=original.indexOf('$$;',start)+3;
 await db.exec(original.slice(start,end));
}
await db.exec('grant execute on function private.can_read(uuid),private.can_write(uuid) to authenticated;');
await db.exec(readFileSync(root+'/supabase/migrations/20260914043443_workforge_hq.sql','utf8'));
await db.exec(readFileSync(root+'/tests/hq-integration.sql','utf8'));
console.log('PASS: HQ migration, owner writes, idempotent handoff, six tasks, launch gate, frozen scope, read-only role, outsider isolation, RLS, anonymous RPC revocation. Fixtures rolled back.');
await db.close();
