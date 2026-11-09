-- Auditable judge assignment history and final judge decisions.
alter table public.judge_assignments
  add column if not exists status text not null default 'active'
    check (status in ('active','removed','reassigned')),
  add column if not exists assigned_by uuid references public.profiles(id),
  add column if not exists removed_by uuid references public.profiles(id),
  add column if not exists removed_at timestamptz;

alter table public.judge_assignments drop constraint if exists judge_assignments_submission_id_judge_id_key;
create unique index if not exists judge_assignments_one_active_pair
  on public.judge_assignments(submission_id, judge_id) where status = 'active';
create index if not exists judge_assignments_judge_status on public.judge_assignments(judge_id,status);

alter table public.evaluations
  add column if not exists decision text not null default 'pending'
    check (decision in ('pending','accepted','rejected')),
  add column if not exists improvement_suggestions text not null default '',
  add column if not exists criterion_remarks jsonb not null default '{}'::jsonb,
  add column if not exists evaluated_at timestamptz;

create or replace function public.judge_has_submission(sub uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from judge_assignments a
    join profiles p on p.id = a.judge_id
    where a.submission_id = sub and a.judge_id = auth.uid() and a.status = 'active'
      and p.role = 'judge' and p.account_active = true)
$$;

drop policy if exists "assign read" on public.judge_assignments;
create policy "assign read" on public.judge_assignments for select
  using ((judge_id = auth.uid() and status = 'active') or is_admin());
drop policy if exists "eval judge read" on public.evaluations;
create policy "eval judge read" on public.evaluations for select using (
  (judge_id = auth.uid() and judge_has_submission(submission_id)) or is_admin()
  or (approved and owns_submission(submission_id)));
drop policy if exists "eval judge update" on public.evaluations;
create policy "eval judge update" on public.evaluations for update
  using ((judge_id = auth.uid() and status = 'draft' and judge_has_submission(submission_id)) or is_admin())
  with check ((judge_id = auth.uid() and not approved and judge_has_submission(submission_id)) or is_admin());

create or replace function public.admin_manage_judge_assignment(
  p_action text, p_submission uuid, p_judge uuid, p_assignment uuid default null, p_new_judge uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_assignment uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_action = 'assign' then
    if not exists (select 1 from submissions where id=p_submission and locked and review_decision='approved') then
      raise exception 'Only submitted papers approved for competitive judging can be assigned';
    end if;
    if not exists (select 1 from profiles where id=p_judge and role='judge' and account_active) then
      raise exception 'Select an active judge';
    end if;
    insert into judge_assignments(submission_id,judge_id,assigned_by)
      values(p_submission,p_judge,auth.uid()) on conflict (submission_id,judge_id) where status='active' do nothing
      returning id into v_assignment;
    if v_assignment is null then raise exception 'This judge is already actively assigned to this paper'; end if;
    update submissions set status='under_review' where id=p_submission and status='submitted';
    perform audit('judge.assigned','judge_assignments',v_assignment::text,jsonb_build_object('submission',p_submission,'judge',p_judge));
    return v_assignment;
  elsif p_action = 'remove' then
    update judge_assignments set status='removed',removed_by=auth.uid(),removed_at=now()
      where id=p_assignment and submission_id=p_submission and status='active' returning id into v_assignment;
    if v_assignment is null then raise exception 'Active assignment not found'; end if;
    if exists(select 1 from evaluations where submission_id=p_submission and judge_id=p_judge and status='submitted') then
      raise exception 'A finalized evaluation cannot be removed from its assignment';
    end if;
    perform audit('judge.assignment_removed','judge_assignments',v_assignment::text,jsonb_build_object('submission',p_submission,'judge',p_judge));
    return v_assignment;
  elsif p_action = 'reassign' then
    if not exists(select 1 from profiles where id=p_new_judge and role='judge' and account_active) then raise exception 'Select an active judge'; end if;
    if exists(select 1 from evaluations e join judge_assignments a on a.submission_id=e.submission_id and a.judge_id=e.judge_id
      where a.id=p_assignment and e.status='submitted') then raise exception 'A finalized evaluation cannot be reassigned'; end if;
    update judge_assignments set status='reassigned',removed_by=auth.uid(),removed_at=now()
      where id=p_assignment and submission_id=p_submission and status='active' returning id into v_assignment;
    if v_assignment is null then raise exception 'Active assignment not found'; end if;
    insert into judge_assignments(submission_id,judge_id,assigned_by) values(p_submission,p_new_judge,auth.uid()) returning id into v_assignment;
    perform audit('judge.assignment_reassigned','judge_assignments',v_assignment::text,jsonb_build_object('submission',p_submission,'from',p_judge,'to',p_new_judge));
    return v_assignment;
  end if;
  raise exception 'Unknown assignment action';
end $$;

create or replace function public.save_judge_evaluation(
  p_submission uuid, p_decision text, p_scores jsonb, p_total numeric, p_feedback text,
  p_rejection_reason text, p_improvement_suggestions text, p_criterion_remarks jsonb, p_draft boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_existing evaluations;
begin
  if auth.uid() is null or not judge_has_submission(p_submission) then raise exception 'Active assignment required'; end if;
  if not exists(select 1 from profiles where id=auth.uid() and role='judge' and account_active) then raise exception 'Active judge account required'; end if;
  select * into v_existing from evaluations where submission_id=p_submission and judge_id=auth.uid();
  if found and v_existing.status='submitted' then raise exception 'Finalized evaluations cannot be changed'; end if;
  if not p_draft then
    if p_decision not in ('accepted','rejected') then raise exception 'Choose accept or reject'; end if;
    if p_feedback is null or length(trim(p_feedback))=0 then raise exception 'Detailed feedback is required'; end if;
    if p_decision='rejected' and (p_rejection_reason is null or length(trim(p_rejection_reason))=0) then raise exception 'A rejection reason is required'; end if;
  end if;
  insert into evaluations(submission_id,judge_id,scores,total,feedback,status,approved,rejection_reason,decision,improvement_suggestions,criterion_remarks,evaluated_at,updated_at)
  values(p_submission,auth.uid(),coalesce(p_scores,'{}'),coalesce(p_total,0),coalesce(p_feedback,''),case when p_draft then 'draft' else 'submitted' end,false,
    case when p_draft then null else nullif(trim(p_rejection_reason),'') end,case when p_draft then 'pending' else p_decision end,
    coalesce(p_improvement_suggestions,''),coalesce(p_criterion_remarks,'{}'),case when p_draft then null else now() end,now())
  on conflict(submission_id,judge_id) do update set scores=excluded.scores,total=excluded.total,feedback=excluded.feedback,status=excluded.status,
    rejection_reason=excluded.rejection_reason,decision=excluded.decision,improvement_suggestions=excluded.improvement_suggestions,
    criterion_remarks=excluded.criterion_remarks,evaluated_at=excluded.evaluated_at,updated_at=now()
  returning id into v_id;
  perform audit(case when p_draft then 'evaluation.draft_saved' else 'evaluation.submitted' end,'evaluations',v_id::text,
    jsonb_build_object('submission',p_submission,'decision',case when p_draft then 'pending' else p_decision end,'total',p_total));
  return v_id;
end $$;

create or replace function public.admin_reopen_judge_evaluation(p_evaluation uuid,p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_reason is null or length(trim(p_reason))=0 then raise exception 'Reopening reason is required'; end if;
  update evaluations set status='draft',approved=false,decision='pending',evaluated_at=null,updated_at=now() where id=p_evaluation;
  if not found then raise exception 'Evaluation not found'; end if;
  perform audit('evaluation.reopened','evaluations',p_evaluation::text,jsonb_build_object('reason',trim(p_reason)));
end $$;

create or replace function public.participant_judging_status(p_submission uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_result jsonb; v_eval evaluations; v_assigned boolean; v_has_submitted boolean;
begin
  if auth.uid() is null or not owns_submission(p_submission) then raise exception 'forbidden'; end if;
  select exists(select 1 from judge_assignments a where a.submission_id=p_submission and a.status='active'),
    exists(select 1 from evaluations e where e.submission_id=p_submission and e.status='submitted')
    into v_assigned,v_has_submitted;
  select * into v_eval from evaluations e where e.submission_id=p_submission and e.status='submitted' and e.approved
    order by e.evaluated_at desc nulls last limit 1;
  v_result := jsonb_build_object(
    'status',case when v_eval.id is not null then v_eval.decision when v_has_submitted then 'under_review'
      when v_assigned then 'assigned' else 'awaiting_assignment' end,
    'decision',v_eval.decision,'total',v_eval.total,'feedback',v_eval.feedback,
    'rejection_reason',v_eval.rejection_reason,'improvement_suggestions',v_eval.improvement_suggestions,'evaluated_at',v_eval.evaluated_at);
  return v_result;
end $$;

grant execute on function public.admin_manage_judge_assignment(text,uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.save_judge_evaluation(uuid,text,jsonb,numeric,text,text,text,jsonb,boolean) to authenticated;
grant execute on function public.admin_reopen_judge_evaluation(uuid,text) to authenticated;
grant execute on function public.participant_judging_status(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.judge_assignments;
exception when duplicate_object then null; when undefined_object then null; end $$;
