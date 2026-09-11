create or replace function public.is_agency_member(target_agency_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.agency_users
    where agency_users.agency_id = target_agency_id
      and agency_users.user_id = auth.uid()
  );
$$;

revoke execute on function public.is_agency_member(text) from public, anon;
grant execute on function public.is_agency_member(text) to authenticated;

create or replace function public.is_valid_insurance_document_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select
    coalesce(array_length(storage.foldername(object_name), 1), 0) = 4
    and nullif((storage.foldername(object_name))[1], '') is not null
    and nullif((storage.foldername(object_name))[2], '') is not null
    and nullif((storage.foldername(object_name))[3], '') is not null
    and public.is_agency_member((storage.foldername(object_name))[1]);
$$;

revoke execute on function public.is_valid_insurance_document_path(text) from public, anon;
grant execute on function public.is_valid_insurance_document_path(text) to authenticated;

create policy "agency members read agencies"
on public.agencies for select
using (public.is_agency_member(id));

create policy "agency members read their membership"
on public.agency_users for select
using (public.is_agency_member(agency_id));

create policy "agency members manage customers"
on public.customers for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members manage businesses"
on public.businesses for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members manage people"
on public.people for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members manage locations"
on public.locations for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members manage vehicles"
on public.vehicles for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members manage customer policies"
on public.customer_policies for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members manage loss history"
on public.loss_history for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members manage applications"
on public.applications for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members manage application field states"
on public.application_field_states for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members manage field provenance"
on public.field_provenance for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members manage application conflicts"
on public.application_conflicts for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members manage documents"
on public.documents for all
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

create policy "agency members read snapshots"
on public.application_snapshots for select
using (public.is_agency_member(agency_id));

create policy "agency members insert snapshots"
on public.application_snapshots for insert
with check (public.is_agency_member(agency_id));

create policy "agency members read private insurance documents"
on storage.objects for select
using (
  bucket_id = 'insurance-documents'
  and public.is_valid_insurance_document_path(name)
);

create policy "agency members upload private insurance documents"
on storage.objects for insert
with check (
  bucket_id = 'insurance-documents'
  and public.is_valid_insurance_document_path(name)
);

create policy "agency members update private insurance documents"
on storage.objects for update
using (
  bucket_id = 'insurance-documents'
  and public.is_valid_insurance_document_path(name)
)
with check (
  bucket_id = 'insurance-documents'
  and public.is_valid_insurance_document_path(name)
);
