-- The deployed competition_settings table is missing schedule fields that
-- the admin UI and competition views already read and write. Add them without
-- assigning dates or changing existing settings values.
alter table public.competition_settings
  add column if not exists competition_starts_at timestamptz,
  add column if not exists competition_ends_at timestamptz,
  add column if not exists results_announcement_at timestamptz;

notify pgrst, 'reload schema';
