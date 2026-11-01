insert into competition_settings (id) values (1) on conflict do nothing;

insert into research_categories (name, slug) values
  ('Scientific Research', 'scientific'),
  ('Vedic Research', 'vedic')
on conflict do nothing;

-- After you sign up with your own account, promote it to admin:
--   update profiles set role = 'admin' where email = 'you@example.com';
