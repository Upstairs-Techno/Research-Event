-- Email verification is no longer required. Remove only the restrictive
-- verification policies added in migration 005; ownership/admin RLS policies
-- remain in place.
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

-- Keep the legacy columns and existing data but do not require participants
-- to enter state/city in the registration form.
alter table public.participants
  alter column state set default 'Not provided',
  alter column city set default 'Not provided';

-- A registration success email is emitted only when the registration first
-- transitions to paid. Migration 004's notification trigger writes the email
-- outbox row for delivery by the configured email webhook.
create or replace function public.notify_registration_payment_success()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and old.status is distinct from new.status then
    insert into public.participant_notifications(user_id, kind, title, message)
      values (
        new.user_id,
        'payment_success',
        'Registration successful',
        'Your payment has been verified and your Research Distinction Awards registration is successful. Your payment receipt is available in your account.'
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_registration_payment_success on public.registrations;
create trigger trg_registration_payment_success
  after update of status on public.registrations
  for each row execute function public.notify_registration_payment_success();
