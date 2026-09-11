create extension if not exists pgcrypto;

create table if not exists public.agencies (
  id text primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.agency_users (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (agency_id, user_id)
);

create table if not exists public.customers (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  type text not null,
  display_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.businesses (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  legal_name text not null,
  dba_name text,
  entity_type text not null,
  state_of_formation text,
  annual_revenue numeric,
  naics_code text,
  employee_count integer,
  years_in_business integer,
  fein text,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (customer_id)
);

create table if not exists public.people (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  first_name text,
  last_name text,
  dob date,
  role text,
  email text,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.locations (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  label text,
  address_line_1 text,
  city text,
  state text,
  postal_code text,
  occupancy text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.vehicles (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  year integer,
  make text,
  model text,
  vin text,
  usage text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_policies (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  carrier_name text,
  effective_date date,
  expiration_date date,
  limits text,
  premium numeric,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (customer_id)
);

create table if not exists public.loss_history (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  loss_date date,
  description text,
  amount numeric,
  status text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.applications (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete restrict,
  definition_id text not null,
  definition_version integer not null,
  line_of_business text not null,
  status text not null,
  customer_name text,
  completion integer not null default 0,
  missing_fields_json jsonb not null default '[]'::jsonb,
  customer_confirmed boolean not null default false,
  broker_verified boolean not null default false,
  broker_notes_json jsonb not null default '[]'::jsonb,
  generated_at timestamptz,
  profile_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.application_field_states (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  application_id text not null references public.applications(id) on delete cascade,
  field_key text not null,
  value_json jsonb,
  selected_source text,
  customer_confirmed boolean not null default false,
  broker_verified boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (application_id, field_key)
);

create table if not exists public.field_provenance (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  application_id text not null references public.applications(id) on delete cascade,
  field_key text not null,
  value_json jsonb not null,
  source_type text not null,
  source_reference text,
  confidence numeric,
  created_at timestamptz not null default timezone('utc', now()),
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists public.application_conflicts (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  application_id text not null references public.applications(id) on delete cascade,
  field_key text not null,
  conflict_type text,
  blocking boolean not null default true,
  status text not null,
  payload_json jsonb not null default '{}'::jsonb,
  resolution_action text,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.documents (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  application_id text references public.applications(id) on delete set null,
  storage_path text not null,
  filename text not null,
  mime_type text,
  document_type text,
  status text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.application_snapshots (
  id text primary key,
  agency_id text not null references public.agencies(id) on delete cascade,
  application_id text not null references public.applications(id) on delete cascade,
  application_definition_id text not null,
  application_definition_version integer not null,
  snapshot_json jsonb not null,
  snapshot_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by text not null
);

create index if not exists idx_customers_agency_id on public.customers (agency_id);
create index if not exists idx_people_customer_id on public.people (customer_id);
create index if not exists idx_locations_customer_id on public.locations (customer_id);
create index if not exists idx_vehicles_customer_id on public.vehicles (customer_id);
create index if not exists idx_loss_history_customer_id on public.loss_history (customer_id);
create index if not exists idx_documents_agency_application on public.documents (agency_id, application_id);
create index if not exists idx_applications_agency_customer on public.applications (agency_id, customer_id);
create index if not exists idx_field_states_app_field on public.application_field_states (application_id, field_key);
create index if not exists idx_field_provenance_app_field on public.field_provenance (application_id, field_key, created_at desc);
create index if not exists idx_application_conflicts_app_field on public.application_conflicts (application_id, field_key);
create index if not exists idx_application_snapshots_app_created on public.application_snapshots (application_id, created_at desc);
