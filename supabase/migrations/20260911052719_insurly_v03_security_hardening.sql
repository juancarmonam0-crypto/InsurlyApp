create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.prevent_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'application_snapshots are immutable';
end;
$$;

create or replace trigger set_agencies_updated_at
before update on public.agencies
for each row execute function public.set_updated_at();

create or replace trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create or replace trigger set_businesses_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

create or replace trigger set_people_updated_at
before update on public.people
for each row execute function public.set_updated_at();

create or replace trigger set_locations_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

create or replace trigger set_vehicles_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

create or replace trigger set_customer_policies_updated_at
before update on public.customer_policies
for each row execute function public.set_updated_at();

create or replace trigger set_loss_history_updated_at
before update on public.loss_history
for each row execute function public.set_updated_at();

create or replace trigger set_applications_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create or replace trigger prevent_application_snapshots_update
before update or delete on public.application_snapshots
for each row execute function public.prevent_snapshot_mutation();

alter table public.agencies enable row level security;
alter table public.agency_users enable row level security;
alter table public.customers enable row level security;
alter table public.businesses enable row level security;
alter table public.people enable row level security;
alter table public.locations enable row level security;
alter table public.vehicles enable row level security;
alter table public.customer_policies enable row level security;
alter table public.loss_history enable row level security;
alter table public.applications enable row level security;
alter table public.application_field_states enable row level security;
alter table public.field_provenance enable row level security;
alter table public.application_conflicts enable row level security;
alter table public.documents enable row level security;
alter table public.application_snapshots enable row level security;

insert into storage.buckets (id, name, public)
values ('insurance-documents', 'insurance-documents', false)
on conflict (id) do nothing;
