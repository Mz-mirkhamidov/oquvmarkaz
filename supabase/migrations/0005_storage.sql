-- Qalqon — 0005_storage.sql
-- Storage bucket RLS (TZ §6.16). Split out from 0002_rls.sql: it depends
-- on the `storage` schema that only exists on an actual Supabase project
-- (not on a bare Postgres instance, e.g. the one the RLS test suite runs
-- against), and a multi-statement migration file rolls back as a whole if
-- any statement in it fails.

create policy storage_attendance_read on storage.objects for select
  using (
    bucket_id = 'attendance'
    and (storage.foldername(name))[1] = auth_org_id()::text
  );
