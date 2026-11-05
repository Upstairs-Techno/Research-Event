-- Store the location fields collected in the participant details step.
alter table public.participants
  add column if not exists state text not null default '',
  add column if not exists city text not null default '';
-- Keep existing participant records valid while requiring these fields for new submissions.
update public.participants set state = 'Not provided' where btrim(state) = '';
update public.participants set city = 'Not provided' where btrim(city) = '';
alter table public.participants
  add constraint participants_institution_nonempty check (char_length(btrim(institution)) > 0) not valid,
  add constraint participants_qualification_nonempty check (char_length(btrim(qualification)) > 0) not valid,
  add constraint participants_country_nonempty check (char_length(btrim(country)) > 0) not valid,
  add constraint participants_state_nonempty check (char_length(btrim(state)) > 0) not valid,
  add constraint participants_city_nonempty check (char_length(btrim(city)) > 0) not valid,
  add constraint participants_mobile_international check (
    mobile ~ '^\+[1-9][0-9 ()-]{6,18}$'
    and char_length(regexp_replace(mobile, '[^0-9]', '', 'g')) between 8 and 15
  ) not valid;

-- Check the authoritative Auth record in the database, rather than trusting
-- user-editable metadata or a client-side flag.
create or replace function public.account_email_verified() returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and email_confirmed_at is not null
  );
$$;
revoke all on function public.account_email_verified() from public, anon;
grant execute on function public.account_email_verified() to authenticated;

-- Restrictive policies add a verification requirement to the existing ownership
-- policies without changing their access rules for verified accounts.
do $$
declare tab text;
begin
  foreach tab in array array[
    'profiles', 'participants', 'registrations', 'payments', 'submissions',
    'submission_versions', 'submission_activity', 'originality_reports', 'judges',
    'judge_assignments', 'evaluations', 'certificates', 'participant_notifications'
  ] loop
    execute format('drop policy if exists "verified account required" on public.%I', tab);
    execute format(
      'create policy "verified account required" on public.%I as restrictive for all to authenticated using (public.account_email_verified()) with check (public.account_email_verified())',
      tab
    );
  end loop;
end $$;

-- Uploaded competition files also require a verified account.
drop policy if exists "verified account required" on storage.objects;
create policy "verified account required" on storage.objects as restrictive
  for all to authenticated
  using (public.account_email_verified())
  with check (public.account_email_verified());
