-- Email confirmation is disabled for this portal. Migration 005 added a second
-- verification check in RLS, which prevented valid signed-in participants from
-- using protected tables even when Supabase returned an authenticated session.
-- Remove only that restrictive check; the existing ownership and role policies
-- continue to enforce access to each row.
do $$
declare tab text;
begin
  foreach tab in array array[
    'profiles', 'participants', 'registrations', 'payments', 'submissions',
    'submission_versions', 'submission_activity', 'originality_reports', 'judges',
    'judge_assignments', 'evaluations', 'certificates', 'participant_notifications'
  ] loop
    execute format('drop policy if exists "verified account required" on public.%I', tab);
  end loop;
end $$;

drop policy if exists "verified account required" on storage.objects;
drop function if exists public.account_email_verified();
