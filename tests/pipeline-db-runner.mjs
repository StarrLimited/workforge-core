// Isolated integration checks against the current schema; no remote data or AI calls.
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import { readFileSync, readdirSync } from 'node:fs';
const db = new PGlite();
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage; create schema vault;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key,name text,bucket_id text,owner_id text);
 alter table storage.objects enable row level security;
 create table vault.decrypted_secrets(id uuid primary key,decrypted_secret text);
 `);
 for (const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
  try { await db.exec(readFileSync('supabase/migrations/'+file,'utf8')); }
  catch(error) { throw new Error(file+': '+error.message,{cause:error}); }
 }
 for (const file of ['pipeline-integration.sql','database-integration.sql','field-integration.sql','demo-workflow-integration.sql','ai-assistance-integration.sql']) {
  await db.exec(readFileSync('tests/'+file,'utf8'));
  console.log('PASS: '+file+' (fixtures rolled back)');
 }
} catch(error) { console.error(JSON.stringify({message:error.message,detail:error.detail,where:error.where,cause:error.cause?.message}));process.exitCode=1; }
finally { await db.close(); }
