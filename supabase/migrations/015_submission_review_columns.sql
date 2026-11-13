-- Restore review workflow columns expected by the admin review UI and its
-- existing database functions. Existing submissions start in the pending
-- decision state; all other new review fields remain empty until edited.
alter table public.submissions
  add column if not exists review_decision text not null default 'pending'
    check (review_decision in ('pending', 'approved', 'rejected')),
  add column if not exists rejection_reason text,
  add column if not exists participant_feedback text,
  add column if not exists internal_review_notes text,
  add column if not exists reviewed_at timestamptz;

notify pgrst, 'reload schema';
