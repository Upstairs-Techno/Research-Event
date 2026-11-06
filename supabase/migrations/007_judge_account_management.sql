-- Judge activation is enforced by PostgreSQL as well as Supabase Auth. Keep
-- profile rows and assignment/evaluation history when a judge is deactivated.
alter table public.profiles
  add column if not exists account_active boolean not null default true;

-- Profile self-update policies include every profile column. Extend the
-- existing guard so users cannot reactivate themselves or disable another user.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.account_active is distinct from old.account_active)
     and auth.uid() is not null and not public.is_admin() then
    raise exception 'Role and account status can only be changed by an administrator';
  end if;
  return new;
end;
$$;

create or replace function public.is_active_judge()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'judge' and account_active = true
  );
$$;

create or replace function public.is_judge_account()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'judge')
      or exists (select 1 from public.judges where user_id = auth.uid());
$$;

-- Make assignment helpers honor the persisted account status. Existing
-- permissive RLS policies remain unchanged; these helpers further restrict them.
create or replace function public.judge_has_submission(sub uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_judge() and exists (
    select 1 from public.judge_assignments where submission_id = sub and judge_id = auth.uid()
  );
$$;

create or replace function public.judge_has_registration(reg uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_judge() and exists (
    select 1 from public.submissions s
    join public.judge_assignments a on a.submission_id = s.id
    where s.registration_id = reg and a.judge_id = auth.uid()
  );
$$;

-- Restrictive guards stop inactive judge JWTs from using judge-scoped reads or
-- writes even while an already-issued access token remains unexpired.
do $$
declare tab text;
begin
  foreach tab in array array[
    'judges', 'judge_assignments', 'evaluations'
  ] loop
    execute format('drop policy if exists "active judge account required" on public.%I', tab);
    execute format(
      'create policy "active judge account required" on public.%I as restrictive for all to authenticated using (not public.is_judge_account() or public.is_active_judge() or public.is_admin()) with check (not public.is_judge_account() or public.is_active_judge() or public.is_admin())',
      tab
    );
  end loop;
end $$;

revoke all on function public.is_active_judge() from public, anon;
grant execute on function public.is_active_judge() to authenticated;
revoke all on function public.is_judge_account() from public, anon;
grant execute on function public.is_judge_account() to authenticated;
