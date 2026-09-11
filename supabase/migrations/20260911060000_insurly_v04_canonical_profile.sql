create table if not exists public.customer_profile_facts (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  entity_type text not null,
  entity_id text not null default '',
  field_key text not null,
  value_json jsonb not null,
  source_type text not null,
  source_reference text,
  confidence numeric,
  customer_confirmed boolean not null default false,
  broker_verified boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (customer_id, entity_type, entity_id, field_key)
);

create or replace trigger set_customer_profile_facts_updated_at
before update on public.customer_profile_facts
for each row execute function public.set_updated_at();

alter table public.customer_profile_facts enable row level security;

create policy "agency members manage customer profile facts"
on public.customer_profile_facts for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create index if not exists idx_profile_facts_customer on public.customer_profile_facts (agency_id, customer_id);
create index if not exists idx_profile_facts_entity on public.customer_profile_facts (customer_id, entity_type, entity_id);
