-- Row Level Security, helper functions, RPCs, storage

-- ───────────── helper functions (security definer avoids RLS recursion) ─────────────
create or replace function owns_submission(sub uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from submissions where id = sub and user_id = auth.uid());
$$;

create or replace function judge_has_submission(sub uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from judge_assignments where submission_id = sub and judge_id = auth.uid());
$$;

create or replace function judge_has_registration(reg uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from submissions s join judge_assignments a on a.submission_id = s.id
    where s.registration_id = reg and a.judge_id = auth.uid());
$$;

create or replace function registration_is_paid(reg uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from registrations where id = reg and user_id = auth.uid() and status = 'paid');
$$;

-- ───────────── enable RLS everywhere ─────────────
alter table profiles enable row level security;
alter table competition_settings enable row level security;
alter table research_categories enable row level security;
alter table participants enable row level security;
alter table registrations enable row level security;
alter table payments enable row level security;
alter table submissions enable row level security;
alter table submission_versions enable row level security;
alter table submission_activity enable row level security;
alter table originality_reports enable row level security;
alter table judges enable row level security;
alter table judge_assignments enable row level security;
alter table evaluations enable row level security;
alter table results enable row level security;
alter table certificates enable row level security;
alter table audit_logs enable row level security;

-- profiles
create policy "profiles self read" on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles self update" on profiles for update using (id = auth.uid() or is_admin());

-- settings & categories: public read, admin write
create policy "settings read" on competition_settings for select using (true);
create policy "settings admin write" on competition_settings for all using (is_admin()) with check (is_admin());
create policy "categories read" on research_categories for select using (true);
create policy "categories admin write" on research_categories for all using (is_admin()) with check (is_admin());

-- participants
create policy "participants own read" on participants for select using (user_id = auth.uid() or is_admin());
create policy "participants own insert" on participants for insert with check (user_id = auth.uid());
create policy "participants own update" on participants for update using (user_id = auth.uid() or is_admin());

-- registrations
create policy "reg own read" on registrations for select
  using (user_id = auth.uid() or is_admin() or judge_has_registration(id));
create policy "reg own insert" on registrations for insert
  with check (user_id = auth.uid() and status = 'pending_payment');
create policy "reg own update" on registrations for update
  using ((user_id = auth.uid() and status = 'pending_payment') or is_admin());

-- payments: read only (writes via Edge Functions with service role)
create policy "payments own read" on payments for select using (user_id = auth.uid() or is_admin());

-- submissions
create policy "sub own read" on submissions for select
  using (user_id = auth.uid() or is_admin() or judge_has_submission(id));
create policy "sub own insert" on submissions for insert
  with check (user_id = auth.uid() and registration_is_paid(registration_id));
create policy "sub own update" on submissions for update
  using ((user_id = auth.uid() and not locked) or is_admin());

-- versions
create policy "versions read" on submission_versions for select
  using (owns_submission(submission_id) or is_admin());

-- activity
create policy "activity read" on submission_activity for select
  using (owns_submission(submission_id) or judge_has_submission(submission_id) or is_admin());
create policy "activity insert" on submission_activity for insert
  with check (owns_submission(submission_id));

-- originality reports (written by service role)
create policy "reports read" on originality_reports for select
  using (owns_submission(submission_id) or judge_has_submission(submission_id) or is_admin());

-- judges
create policy "judges read" on judges for select using (user_id = auth.uid() or is_admin());
create policy "judges admin write" on judges for all using (is_admin()) with check (is_admin());

-- assignments
create policy "assign read" on judge_assignments for select using (judge_id = auth.uid() or is_admin());
create policy "assign admin write" on judge_assignments for all using (is_admin()) with check (is_admin());

-- evaluations
create policy "eval judge read" on evaluations for select
  using (judge_id = auth.uid() or is_admin()
         or (status = 'submitted' and approved and owns_submission(submission_id)
             and exists (select 1 from competition_settings where id = 1 and results_published)));
create policy "eval judge insert" on evaluations for insert
  with check (judge_id = auth.uid() and judge_has_submission(submission_id) and status in ('draft','submitted') and not approved);
create policy "eval judge update" on evaluations for update
  using ((judge_id = auth.uid() and status = 'draft') or is_admin())
  with check ((judge_id = auth.uid() and not approved) or is_admin());

-- results: public once published
create policy "results public read" on results for select using (published or is_admin());

-- certificates
create policy "certs own read" on certificates for select using (user_id = auth.uid() or is_admin());

-- audit logs
create policy "audit admin read" on audit_logs for select using (is_admin());

-- ───────────── RPCs ─────────────
create or replace function audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_details);
$$;
revoke execute on function audit(text, text, text, jsonb) from public, anon, authenticated;

-- participant: final submission (locks the paper)
create or replace function submit_paper(p_submission uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s submissions; dl timestamptz;
begin
  select * into s from submissions where id = p_submission and user_id = auth.uid();
  if not found then raise exception 'Submission not found'; end if;
  if s.locked then raise exception 'Already submitted'; end if;
  if not exists (select 1 from registrations where id = s.registration_id and status = 'paid') then
    raise exception 'Payment not verified';
  end if;
  select submission_deadline into dl from competition_settings where id = 1;
  if dl is not null and now() > dl then raise exception 'Submission deadline has passed'; end if;
  if s.word_count < 100 then raise exception 'Paper is too short to submit (minimum 100 words)'; end if;

  perform set_config('app.bypass', 'on', true);
  insert into submission_versions (submission_id, content, word_count) values (s.id, s.content, s.word_count);
  update submissions set locked = true, status = 'submitted', submitted_at = now() where id = s.id;
  perform audit('submission.submitted', 'submissions', s.id::text);
end $$;

-- admin: unlock a submission (formal resubmission)
create or replace function admin_unlock_submission(p_submission uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update submissions set locked = false, status = 'draft', submitted_at = null where id = p_submission;
  perform audit('submission.unlocked', 'submissions', p_submission::text);
end $$;

-- admin: change a user's role
create or replace function admin_set_role(p_email text, p_role app_role) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select id into uid from profiles where lower(email) = lower(p_email);
  if uid is null then raise exception 'No user with that email (they must sign up first)'; end if;
  update profiles set role = p_role where id = uid;
  if p_role = 'judge' then
    insert into judges (user_id) values (uid) on conflict do nothing;
  end if;
  perform audit('user.role_changed', 'profiles', uid::text, jsonb_build_object('role', p_role, 'email', p_email));
end $$;

-- admin: assign judge
create or replace function assign_judge(p_submission uuid, p_judge uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from profiles where id = p_judge and role = 'judge') then
    raise exception 'User is not a judge';
  end if;
  insert into judge_assignments (submission_id, judge_id) values (p_submission, p_judge) on conflict do nothing;
  update submissions set status = 'under_review' where id = p_submission and status = 'submitted';
  perform audit('judge.assigned', 'submissions', p_submission::text, jsonb_build_object('judge', p_judge));
end $$;

-- admin: approve final scores for a submission
create or replace function approve_evaluations(p_submission uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update evaluations set approved = true where submission_id = p_submission and status = 'submitted';
  update submissions set status = 'evaluated' where id = p_submission;
  perform audit('evaluation.approved', 'submissions', p_submission::text);
end $$;

-- admin: publish top-3 results from approved evaluations
create or replace function publish_results() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  delete from results;
  insert into results (submission_id, rank, prize_inr, final_score, winner_name, research_title, category)
  select t.submission_id, t.rnk,
         case t.rnk when 1 then 15000 when 2 then 10000 else 5000 end,
         round(t.avg_total, 2), p.full_name, s.title, c.name
  from (
    select e.submission_id, avg(e.total) avg_total,
           row_number() over (order by avg(e.total) desc) rnk
    from evaluations e where e.status = 'submitted' and e.approved
    group by e.submission_id
  ) t
  join submissions s on s.id = t.submission_id
  join profiles p on p.id = s.user_id
  join registrations r on r.id = s.registration_id
  left join research_categories c on c.id = r.category_id
  where t.rnk <= 3;
  get diagnostics n = row_count;
  update competition_settings set results_published = true, updated_at = now() where id = 1;
  perform audit('results.published', 'results', null, jsonb_build_object('winners', n));
  return n;
end $$;

-- admin: issue participation + winner certificates
create or replace function issue_certificates() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; comp text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select name into comp from competition_settings where id = 1;

  insert into certificates (certificate_code, user_id, submission_id, holder_name, award, competition)
  select 'RDA-' || upper(encode(gen_random_bytes(5), 'hex')), s.user_id, s.id, p.full_name,
         'Certificate of Participation', comp
  from submissions s join profiles p on p.id = s.user_id
  where s.locked
  on conflict (submission_id, award) do nothing;
  get diagnostics n = row_count;

  insert into certificates (certificate_code, user_id, submission_id, holder_name, award, competition)
  select 'RDA-' || upper(encode(gen_random_bytes(5), 'hex')), s.user_id, s.id, r.winner_name,
         case r.rank when 1 then 'First Prize' when 2 then 'Second Prize' else 'Third Prize' end, comp
  from results r join submissions s on s.id = r.submission_id
  on conflict (submission_id, award) do nothing;

  perform audit('certificates.issued', 'certificates', null, jsonb_build_object('participation', n));
  return n;
end $$;

-- public: verify a certificate by code
create or replace function verify_certificate(p_code text)
returns table (certificate_code text, holder_name text, award text, competition text, issued_at timestamptz)
language sql stable security definer set search_path = public as $$
  select certificate_code, holder_name, award, competition, issued_at
  from certificates where upper(certificate_code) = upper(trim(p_code));
$$;
grant execute on function verify_certificate(text) to anon, authenticated;

-- admin: dashboard statistics
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
    'flagged', (select count(*) from submissions where flagged),
    'pending_evals', (select count(*) from judge_assignments a
        where not exists (select 1 from evaluations e where e.submission_id = a.submission_id
                          and e.judge_id = a.judge_id and e.status = 'submitted')),
    'completed_evals', (select count(*) from evaluations where status = 'submitted'),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'count', x.cnt))
        from research_categories c
        left join lateral (select count(*) cnt from registrations r where r.category_id = c.id) x on true), '[]'::jsonb)
  );
end $$;

-- ───────────── storage (private bucket for paper images) ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submission-assets', 'submission-assets', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "assets own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'submission-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets own read" on storage.objects for select to authenticated
  using (bucket_id = 'submission-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'submission-assets' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────── audit triggers for direct admin edits ─────────────
create or replace function audit_settings_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'settings.updated', 'competition_settings', '1',
          jsonb_build_object('fee_paise', new.fee_paise, 'deadline', new.submission_deadline,
                             'registration_open', new.registration_open));
  return new;
end $$;
create trigger trg_audit_settings after update on competition_settings
  for each row execute function audit_settings_change();
