-- Research Distinction Awards Portal : core schema
create extension if not exists pgcrypto;

create type app_role as enum ('participant', 'judge', 'admin');

create sequence participant_seq start 1;

-- ───────────── profiles ─────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role app_role not null default 'participant',
  created_at timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────── role helpers ─────────────
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function is_judge() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'judge');
$$;

-- block role self-escalation
create or replace function guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    raise exception 'Role can only be changed by an administrator';
  end if;
  return new;
end $$;
create trigger trg_guard_profile_role before update on profiles
  for each row execute function guard_profile_role();

-- ───────────── competition ─────────────
create table competition_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'Research Distinction Awards',
  fee_paise int not null default 49900,
  registration_open boolean not null default true,
  submission_deadline timestamptz,
  results_published boolean not null default false,
  refund_policy text not null default 'Registration fees are non-refundable once payment is verified, except where a duplicate payment was made. Duplicate payments are refunded within 7 working days.',
  rubric jsonb not null default '[
    {"key":"originality","label":"Originality and contribution","weight":25},
    {"key":"methodology","label":"Research methodology","weight":20},
    {"key":"quality","label":"Research quality and accuracy","weight":20},
    {"key":"innovation","label":"Innovation and relevance","weight":15},
    {"key":"presentation","label":"Presentation and references","weight":10},
    {"key":"impact","label":"Practical impact","weight":10}
  ]'::jsonb,
  updated_at timestamptz not null default now()
);

create table research_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  active boolean not null default true
);

-- ───────────── participants / registrations ─────────────
create table participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  participant_code text not null unique default ('RDA-' || lpad(nextval('participant_seq')::text, 5, '0')),
  mobile text not null check (mobile ~ '^[0-9+() -]{7,20}$'),
  institution text not null,
  qualification text not null,
  country text not null,
  created_at timestamptz not null default now()
);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  category_id uuid not null references research_categories(id),
  research_title text not null check (char_length(research_title) between 5 and 300),
  abstract text not null check (char_length(abstract) between 50 and 4000),
  status text not null default 'pending_payment' check (status in ('pending_payment','paid')),
  created_at timestamptz not null default now()
);

create or replace function guard_registration_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and auth.uid() is not null and not is_admin() then
    raise exception 'Registration status can only be changed by payment verification';
  end if;
  return new;
end $$;
create trigger trg_guard_registration_status before update on registrations
  for each row execute function guard_registration_status();

-- ───────────── payments ─────────────
create table payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  amount_paise int not null,
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created','paid','failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- ───────────── submissions ─────────────
create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  registration_id uuid not null unique references registrations(id) on delete cascade,
  title text not null,
  content jsonb,
  word_count int not null default 0,
  status text not null default 'draft' check (status in ('draft','submitted','under_review','evaluated')),
  locked boolean not null default false,
  flagged boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  content jsonb,
  word_count int not null default 0,
  created_at timestamptz not null default now()
);
create index on submission_versions (submission_id, created_at desc);

create table submission_activity (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  event_type text not null check (event_type in ('paste','large_insert','session')),
  char_count int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on submission_activity (submission_id, created_at);

create or replace function touch_submission() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger trg_touch_submission before update on submissions
  for each row execute function touch_submission();

-- lock / status guard
create or replace function guard_submission() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin()
     and coalesce(current_setting('app.bypass', true), '') <> 'on' then
    if old.locked and (new.content is distinct from old.content or new.title is distinct from old.title) then
      raise exception 'Submission is locked and cannot be edited';
    end if;
    if new.locked is distinct from old.locked or new.status is distinct from old.status
       or new.flagged is distinct from old.flagged or new.submitted_at is distinct from old.submitted_at then
      raise exception 'Protected fields cannot be changed directly';
    end if;
  end if;
  return new;
end $$;
create trigger trg_guard_submission before update on submissions
  for each row execute function guard_submission();

-- automatic version history (at most one snapshot every 3 minutes)
create or replace function snapshot_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.content is distinct from old.content then
    if not exists (select 1 from submission_versions v
                   where v.submission_id = new.id and v.created_at > now() - interval '3 minutes') then
      insert into submission_versions (submission_id, content, word_count)
      values (new.id, new.content, new.word_count);
    end if;
  end if;
  return new;
end $$;
create trigger trg_snapshot_version after update on submissions
  for each row execute function snapshot_version();

-- ───────────── originality ─────────────
create table originality_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  kind text not null check (kind in ('plagiarism','ai')),
  score numeric(5,2),
  status text not null default 'completed' check (status in ('pending','completed','failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on originality_reports (submission_id, kind, created_at desc);

-- ───────────── judges / evaluation ─────────────
create table judges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  expertise text,
  created_at timestamptz not null default now()
);

create table judge_assignments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  judge_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (submission_id, judge_id)
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  judge_id uuid not null references profiles(id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  total numeric(5,2) not null default 0 check (total between 0 and 100),
  feedback text not null default '',
  status text not null default 'draft' check (status in ('draft','submitted')),
  approved boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (submission_id, judge_id)
);

-- ───────────── results / certificates / audit ─────────────
create table results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references submissions(id) on delete cascade,
  rank int not null check (rank between 1 and 3),
  prize_inr int not null,
  final_score numeric(5,2) not null,
  winner_name text not null,
  research_title text not null,
  category text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_code text not null unique,
  user_id uuid not null references profiles(id) on delete cascade,
  submission_id uuid not null references submissions(id) on delete cascade,
  holder_name text not null,
  award text not null,
  competition text not null,
  issued_at timestamptz not null default now(),
  unique (submission_id, award)
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
