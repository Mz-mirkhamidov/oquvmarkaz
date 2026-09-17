-- Qalqon — 0008_storage_buckets.sql
-- Storage buckets from TZ §6.16 (attendance/avatars/reports), all private
-- with a signed URL as the only way to read. Every object path starts
-- with {org_id}/... so the same auth_org_id() folder-prefix check used
-- for `attendance` in 0005_storage.sql applies to all three.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attendance', 'attendance', false, 2097152, array['image/webp', 'image/jpeg']),
  ('avatars', 'avatars', false, 2097152, array['image/webp', 'image/jpeg']),
  ('reports', 'reports', false, 20971520, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ])
on conflict (id) do nothing;

create policy storage_avatars_read on storage.objects for select
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth_org_id()::text
  );

create policy storage_reports_read on storage.objects for select
  using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = auth_org_id()::text
  );

-- Uploads for all three buckets go through server routes using signed
-- upload URLs (service_role), never a direct client INSERT — so no
-- authenticated INSERT policy is added here, mirroring attendance's.
