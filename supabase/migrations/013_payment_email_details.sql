-- Include the submitted project title and verified payment timestamp in the
-- durable payment confirmation notification.
create or replace function public.registration_confirmation_details(p_registration uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'participant_name', pr.full_name,
    'email', pr.email,
    'registration_id', r.id,
    'participant_code', pt.participant_code,
    'competition_name', coalesce(cs.name, 'Research Distinction Awards'),
    'project_title', r.research_title,
    'amount_paise', pay.amount_paise,
    'currency', pay.currency,
    'payment_reference', pay.razorpay_payment_id,
    'paid_at', pay.paid_at,
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
    -- Queueing an email must not roll back a payment already verified by the
    -- server. A failed queue is logged and may be retried by an administrator.
    begin
      confirmation := public.registration_confirmation_details(new.id);
      if confirmation is null then raise exception 'Verified payment details are unavailable'; end if;
      insert into public.participant_notifications(user_id, kind, title, message, details)
      values (
        new.user_id,
        'registration_confirmation',
        'Research Awards — Payment Successful & Registration Confirmed',
        'Your payment has been verified and your registration is confirmed. Please keep this email for your records and check your dashboard for competition updates and submission deadlines.',
        confirmation
      );
    exception when others then
      raise warning 'Could not queue payment confirmation for registration %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;
