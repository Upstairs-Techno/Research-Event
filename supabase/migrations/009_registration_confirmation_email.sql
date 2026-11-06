-- Keep older paid rows valid while newly verified payments use an explicit
-- confirmed registration state. Payment rows remain the payment authority.
alter table public.registrations
  drop constraint if exists registrations_status_check;
alter table public.registrations
  add constraint registrations_status_check
  check (status in ('pending_payment', 'paid', 'confirmed'));

alter table public.participant_notifications
  add column if not exists details jsonb not null default '{}'::jsonb;

create or replace function public.registration_is_paid(reg uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.registrations
    where id = reg and user_id = auth.uid() and status in ('paid', 'confirmed')
  );
$$;

create or replace function public.submit_paper(p_submission uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare s public.submissions; dl timestamptz;
begin
  select * into s from public.submissions where id = p_submission and user_id = auth.uid();
  if not found then raise exception 'Submission not found'; end if;
  if s.locked then raise exception 'Already submitted'; end if;
  if not exists (
    select 1 from public.registrations where id = s.registration_id and status in ('paid', 'confirmed')
  ) then raise exception 'Payment not verified'; end if;
  select submission_deadline into dl from public.competition_settings where id = 1;
  if dl is not null and now() > dl then raise exception 'Submission deadline has passed'; end if;
  if s.word_count < 100 then raise exception 'Paper is too short to submit (minimum 100 words)'; end if;
  perform set_config('app.bypass', 'on', true);
  insert into public.submission_versions (submission_id, content, word_count) values (s.id, s.content, s.word_count);
  update public.submissions set locked = true, status = 'submitted', submitted_at = now() where id = s.id;
  perform public.audit('submission.submitted', 'submissions', s.id::text);
end;
$$;

create or replace function public.registration_confirmation_details(p_registration uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'participant_name', pr.full_name,
    'email', pr.email,
    'registration_id', r.id,
    'participant_code', pt.participant_code,
    'competition_name', coalesce(cs.name, 'Research Distinction Awards'),
    'amount_paise', pay.amount_paise,
    'currency', pay.currency,
    'payment_reference', pay.razorpay_payment_id,
    'confirmation_status', 'CONFIRMED'
  )
  from public.registrations r
  join public.profiles pr on pr.id = r.user_id
  join public.participants pt on pt.id = r.participant_id
  join public.payments pay on pay.registration_id = r.id and pay.user_id = r.user_id and pay.status = 'paid'
  left join public.competition_settings cs on cs.id = 1
  where r.id = p_registration and r.status in ('paid', 'confirmed')
  order by pay.paid_at desc nulls last
  limit 1;
$$;
revoke all on function public.registration_confirmation_details(uuid) from public, anon, authenticated;

create or replace function public.notify_registration_payment_success()
returns trigger
language plpgsql security definer set search_path = public as $$
declare confirmation jsonb;
begin
  if new.status = 'confirmed' and old.status not in ('confirmed', 'paid') then
    confirmation := public.registration_confirmation_details(new.id);
    if confirmation is null then raise exception 'Verified payment details are unavailable'; end if;
    insert into public.participant_notifications(user_id, kind, title, message, details)
    values (
      new.user_id,
      'registration_confirmation',
      'Registration confirmed — Research Distinction Awards',
      'Your payment has been verified and your registration is confirmed. Please keep this email for your records and check your dashboard for competition updates and submission deadlines.',
      confirmation
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_registration_payment_success on public.registrations;
create trigger trg_registration_payment_success
  after update of status on public.registrations
  for each row execute function public.notify_registration_payment_success();

create or replace function public.admin_resend_registration_confirmation(p_registration uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare confirmation jsonb; recipient uuid; notification_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  confirmation := public.registration_confirmation_details(p_registration);
  if confirmation is null then raise exception 'No verified paid registration was found'; end if;
  select user_id into recipient from public.registrations where id = p_registration;
  insert into public.participant_notifications(user_id, kind, title, message, details)
  values (
    recipient,
    'registration_confirmation',
    'Registration confirmed — Research Distinction Awards',
    'Your payment has been verified and your registration is confirmed. Please keep this email for your records and check your dashboard for competition updates and submission deadlines.',
    confirmation
  ) returning id into notification_id;
  perform public.audit('registration.confirmation_resent', 'registrations', p_registration::text,
    jsonb_build_object('notification_id', notification_id));
  return notification_id;
end;
$$;
revoke all on function public.admin_resend_registration_confirmation(uuid) from public, anon;
grant execute on function public.admin_resend_registration_confirmation(uuid) to authenticated;
