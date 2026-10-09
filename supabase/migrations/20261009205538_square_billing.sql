-- Server-only payment integration. Browser sessions cannot modify verified payment records.
create table public.square_billing_customers (
 id text primary key, scope text not null, environment text not null check(environment in ('sandbox','production')),
 location_id text not null, customer_id text not null, square_customer_id text not null,
 created_at timestamptz not null default now(),
 unique(scope,environment,location_id,customer_id)
);
create table public.square_billing_records (
 id uuid primary key default gen_random_uuid(), scope text not null,
 environment text not null check(environment in ('sandbox','production')), location_id text not null,
 source_id text not null, mode text not null check(mode in ('invoice','monthly')),
 request jsonb not null, created_by text not null,
 square_customer_id text, square_invoice_id text, square_subscription_id text, square_plan_variation_id text,
 subscription_version bigint not null default -1,
 status text not null default 'PREPARING', canceled_date date, charged_through_date date, last_error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(scope,environment,location_id,source_id,mode),
 unique(scope,environment,location_id,square_invoice_id),
 unique(scope,environment,location_id,square_subscription_id)
);
create index square_billing_records_recent on public.square_billing_records(scope,environment,location_id,created_at desc);
create table public.square_billing_invoices (
 record_id uuid not null references public.square_billing_records(id),
 invoice_id text not null, version bigint not null check(version>=0), status text not null,
 public_url text, amount_cents bigint not null check(amount_cents>=0), paid_cents bigint not null check(paid_cents>=0),
 due_cents bigint not null check(due_cents>=0), due_date date, requests jsonb not null default '[]',
 updated_at timestamptz not null default now(),
 primary key(record_id,invoice_id)
);
create table public.square_billing_events (
 event_id text primary key, scope text not null, event_type text not null,
 processed_at timestamptz not null default now()
);
alter table public.square_billing_customers enable row level security;
alter table public.square_billing_records enable row level security;
alter table public.square_billing_invoices enable row level security;
alter table public.square_billing_events enable row level security;
revoke all on public.square_billing_customers,public.square_billing_records,public.square_billing_invoices,public.square_billing_events from public,anon,authenticated;
grant select,insert,update on public.square_billing_customers,public.square_billing_records,public.square_billing_invoices,public.square_billing_events to service_role;

-- Serialization and provider version checks prevent delayed callbacks from reverting payment status.
create function public.square_store_invoice(p_record_id uuid,p_snapshot jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.square_billing_records; saved_version bigint;
begin
 select * into r from public.square_billing_records where id=p_record_id for update;
 if not found then raise exception 'Unknown billing record'; end if;
 if r.mode='invoice' and r.square_invoice_id is distinct from p_snapshot->>'invoice_id' then raise exception 'Invoice mismatch'; end if;
 insert into public.square_billing_invoices(record_id,invoice_id,version,status,public_url,amount_cents,paid_cents,due_cents,due_date,requests)
 values(r.id,p_snapshot->>'invoice_id',(p_snapshot->>'version')::bigint,p_snapshot->>'status',p_snapshot->>'public_url',
 (p_snapshot->>'amount_cents')::bigint,(p_snapshot->>'paid_cents')::bigint,(p_snapshot->>'due_cents')::bigint,(p_snapshot->>'due_date')::date,coalesce(p_snapshot->'requests','[]'::jsonb))
 on conflict(record_id,invoice_id) do update set
 version=excluded.version,status=excluded.status,public_url=excluded.public_url,amount_cents=excluded.amount_cents,
 paid_cents=excluded.paid_cents,due_cents=excluded.due_cents,due_date=excluded.due_date,requests=excluded.requests,updated_at=now()
 where square_billing_invoices.version<=excluded.version
 returning version into saved_version;
 if saved_version is not null then
   update public.square_billing_records set status=case when mode='invoice' then p_snapshot->>'status' else status end,last_error=null,updated_at=now() where id=r.id;
 end if;
end; $$;
revoke all on function public.square_store_invoice(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.square_store_invoice(uuid,jsonb) to service_role;
