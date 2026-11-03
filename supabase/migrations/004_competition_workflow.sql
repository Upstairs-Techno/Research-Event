-- Competition schedule, participant notifications, and formal paper decisions.
alter table competition_settings
  add column if not exists competition_starts_at timestamptz not null default '2026-11-08 00:00:00+05:30',
  add column if not exists competition_ends_at timestamptz not null default '2026-11-22 23:59:59+05:30',
  add column if not exists results_announcement_at timestamptz not null default '2026-12-01 00:00:00+05:30';
update competition_settings set submission_deadline = competition_ends_at where id = 1 and submission_deadline is null;

alter table submissions
  add column if not exists review_decision text not null default 'pending' check (review_decision in ('pending','approved','rejected')),
  add column if not exists rejection_reason text,
  add column if not exists participant_feedback text,
  add column if not exists internal_review_notes text,
  add column if not exists reviewed_at timestamptz;

create or replace function guard_submission() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin()
     and coalesce(current_setting('app.bypass', true), '') <> 'on' then
    if old.locked and (new.content is distinct from old.content or new.title is distinct from old.title) then
      raise exception 'Submission is locked and cannot be edited';
    end if;
    if new.locked is distinct from old.locked or new.status is distinct from old.status
       or new.flagged is distinct from old.flagged or new.submitted_at is distinct from old.submitted_at
       or new.review_decision is distinct from old.review_decision
       or new.rejection_reason is distinct from old.rejection_reason
       or new.participant_feedback is distinct from old.participant_feedback
       or new.internal_review_notes is distinct from old.internal_review_notes
       or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'Protected submission fields cannot be changed directly';
    end if;
  end if;
  return new;
end $$;

create table if not exists participant_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  submission_id uuid references submissions(id) on delete cascade,
  kind text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table participant_notifications enable row level security;
create policy "notifications own read" on participant_notifications for select using (user_id = auth.uid() or is_admin());

create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references participant_notifications(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table email_outbox enable row level security;
create policy "email outbox admin read" on email_outbox for select using (is_admin());

create or replace function enqueue_notification_email() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into email_outbox(notification_id) values (new.id) on conflict (notification_id) do nothing;
  return new;
end $$;
create trigger trg_enqueue_notification_email after insert on participant_notifications for each row execute function enqueue_notification_email();

do $$ begin
  alter publication supabase_realtime add table participant_notifications;
exception when duplicate_object then null;
end $$;

create or replace function notify_account_registration() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into participant_notifications(user_id, kind, title, message)
    values (new.id, 'registration', 'Welcome to Research Distinction Awards', 'Your account is registered. Complete your participant details and payment to enter the competition.');
  return new;
end $$;
create trigger trg_notify_account_registration after insert on profiles for each row execute function notify_account_registration();

create or replace function admin_review_submission(
  p_submission uuid, p_decision text, p_rejection_reason text default null,
  p_feedback text default null, p_internal_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare s submissions; msg text; heading text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
  if p_decision = 'rejected' and nullif(trim(p_rejection_reason), '') is null then
    raise exception 'A rejection reason is required';
  end if;
  select * into s from submissions where id = p_submission and locked = true for update;
  if not found then raise exception 'Submitted paper not found'; end if;
  update submissions set review_decision = p_decision,
    rejection_reason = case when p_decision = 'rejected' then trim(p_rejection_reason) else null end,
    participant_feedback = nullif(trim(p_feedback), ''),
    internal_review_notes = nullif(trim(p_internal_notes), ''), reviewed_at = now()
    where id = p_submission;
  heading := case when p_decision = 'approved' then 'Research paper approved' else 'Research paper update' end;
  msg := case when p_decision = 'approved'
    then coalesce(nullif(trim(p_feedback), ''), 'Your research paper has been approved for the competition.')
    else 'Thank you for participating in Research Distinction Awards. Unfortunately, your research paper was not selected for this competition. Better luck next time! Reason: ' || trim(p_rejection_reason) end;
  insert into participant_notifications(user_id, submission_id, kind, title, message)
    values (s.user_id, s.id, p_decision, heading, msg);
  perform audit('submission.' || p_decision, 'submissions', s.id::text,
    jsonb_build_object('reason', case when p_decision = 'rejected' then p_rejection_reason else null end,
                       'feedback', p_feedback, 'internal_notes', p_internal_notes));
end $$;

revoke all on function admin_review_submission(uuid,text,text,text,text) from public, anon;
grant execute on function admin_review_submission(uuid,text,text,text,text) to authenticated;

-- Submitted papers receive a durable in-dashboard notification.
create or replace function notify_submission() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.locked and not old.locked then
    insert into participant_notifications(user_id, submission_id, kind, title, message)
      values (new.user_id, new.id, 'submitted', 'Paper submitted', 'Your research paper was submitted successfully and is awaiting review.');
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_submission on submissions;
create trigger trg_notify_submission after update of locked on submissions for each row execute function notify_submission();

create or replace function notify_published_results() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.results_published and not old.results_published then
    for r in select distinct user_id from registrations loop
      insert into participant_notifications(user_id, kind, title, message)
        values (r.user_id, 'results', 'Competition results are published', 'Research Distinction Awards results are now available in your participant dashboard.');
    end loop;
    insert into participant_notifications(user_id, submission_id, kind, title, message)
      select s.user_id, s.id, 'award', 'You received a Research Distinction Award', 'Congratulations! Your research paper has been selected as an award winner.'
      from results x join submissions s on s.id = x.submission_id where x.published;
  end if;
  return new;
end $$;
create trigger trg_notify_published_results after update of results_published on competition_settings for each row execute function notify_published_results();

create or replace function admin_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'participants', (select count(*) from registrations),
    'paid', (select count(*) from payments where status = 'paid'),
    'failed_payments', (select count(*) from payments where status = 'failed'),
    'revenue_paise', coalesce((select sum(amount_paise) from payments where status = 'paid'), 0),
    'submitted', (select count(*) from submissions where locked),
    'drafts', (select count(*) from submissions where not locked),
    'approved', (select count(*) from submissions where review_decision = 'approved'),
    'rejected', (select count(*) from submissions where review_decision = 'rejected'),
    'email_failed', (select count(*) from email_outbox where status = 'failed'),
    'pending_review', (select count(*) from submissions where locked and review_decision = 'pending'),
    'flagged', (select count(*) from submissions where flagged),
    'pending_evals', (select count(*) from judge_assignments a where not exists
      (select 1 from evaluations e where e.submission_id = a.submission_id and e.judge_id = a.judge_id and e.status = 'submitted')),
    'completed_evals', (select count(*) from evaluations where status = 'submitted'),
    'competition_status', case when now() < (select competition_starts_at from competition_settings where id=1) then 'upcoming'
      when now() < (select competition_ends_at from competition_settings where id=1) then 'in_progress' else 'closed' end,
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'count', x.cnt))
      from research_categories c left join lateral (select count(*) cnt from registrations r where r.category_id = c.id) x on true), '[]'::jsonb)
  );
end $$;

create or replace function submit_paper(p_submission uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s submissions; dl timestamptz; starts_at timestamptz; ends_at timestamptz; actual_words int;
begin
  select * into s from submissions where id = p_submission and user_id = auth.uid();
  if not found then raise exception 'Submission not found'; end if;
  if s.locked then raise exception 'Already submitted'; end if;
  if not exists (select 1 from registrations where id = s.registration_id and status = 'paid') then raise exception 'Payment not verified'; end if;
  select submission_deadline, competition_starts_at, competition_ends_at into dl, starts_at, ends_at from competition_settings where id = 1;
  if now() < starts_at then raise exception 'The competition has not started yet'; end if;
  if now() > least(coalesce(dl, ends_at), ends_at) then raise exception 'Submission deadline has passed'; end if;
  with recursive nodes(value) as (
    select s.content
    union all
    select child.value from nodes cross join lateral jsonb_array_elements(
      case when jsonb_typeof(nodes.value->'content') = 'array' then nodes.value->'content' else '[]'::jsonb end
    ) child(value)
  ), text_content as (
    select string_agg(value->>'text', ' ') as body from nodes where value->>'type' = 'text'
  )
  select count(*) into actual_words from text_content,
    lateral regexp_split_to_table(coalesce(body, ''), '\s+') token where token <> '';
  if actual_words < 750 then raise exception 'Paper must be at least 3 pages (about 750 words) before submission'; end if;
  perform set_config('app.bypass', 'on', true);
  update submissions set word_count = actual_words where id = s.id;
  insert into submission_versions (submission_id, content, word_count) values (s.id, s.content, s.word_count);
  update submissions set locked = true, status = 'submitted', submitted_at = now() where id = s.id;
  perform audit('submission.submitted', 'submissions', s.id::text);
end $$;
revoke all on function submit_paper(uuid) from public, anon;
grant execute on function submit_paper(uuid) to authenticated;

-- Keep the results page private until the administrator publishes.
drop policy if exists "results public read" on results;
create policy "results read after publication" on results for select using
  (is_admin() or (published and exists (select 1 from competition_settings where id = 1 and results_published)));
