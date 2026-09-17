-- Qalqon — local development seed data.
-- Not applied in production. Run via `supabase db reset` in local dev.

insert into organizations (id, name, org_type, region, district, capacity, subsidy_enabled, photo_required)
values (
  '00000000-0000-0000-0000-000000000001',
  'Aqlvoy kindergarten',
  'oilaviy',
  'Sirdaryo',
  'Guliston',
  35,
  true,
  true
);

insert into groups (id, org_id, name, sort_order)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Katta guruh',
  1
);
