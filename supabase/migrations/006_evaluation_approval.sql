-- Track administrator rejection feedback without changing the evaluation status
-- constraint. Rejected evaluations return to draft so the assigned judge can revise.
alter table public.evaluations
  add column if not exists rejection_reason text;

create or replace function public.reject_evaluation(p_evaluation uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A rejection reason is required'; end if;

  update public.evaluations
    set status = 'draft', rejection_reason = trim(p_reason), updated_at = now()
    where id = p_evaluation and status = 'submitted' and approved = false;
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'Submitted evaluation not found or already approved'; end if;

  perform public.audit('evaluation.rejected', 'evaluations', p_evaluation::text,
    jsonb_build_object('reason', trim(p_reason)));
end;
$$;

revoke all on function public.reject_evaluation(uuid, text) from public, anon;
grant execute on function public.reject_evaluation(uuid, text) to authenticated;

-- Keep privileged RPCs unavailable to anonymous callers. Each function also
-- checks is_admin() internally; these grants add a second authorization layer.
revoke all on function public.admin_unlock_submission(uuid) from public, anon;
grant execute on function public.admin_unlock_submission(uuid) to authenticated;
revoke all on function public.admin_set_role(text, app_role) from public, anon;
grant execute on function public.admin_set_role(text, app_role) to authenticated;
revoke all on function public.assign_judge(uuid, uuid) from public, anon;
grant execute on function public.assign_judge(uuid, uuid) to authenticated;
revoke all on function public.approve_evaluations(uuid) from public, anon;
grant execute on function public.approve_evaluations(uuid) to authenticated;
revoke all on function public.publish_results() from public, anon;
grant execute on function public.publish_results() to authenticated;
revoke all on function public.issue_certificates() from public, anon;
grant execute on function public.issue_certificates() to authenticated;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
