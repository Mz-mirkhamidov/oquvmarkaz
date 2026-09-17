-- Qalqon — 0007_security_hardening.sql
-- Addresses Supabase's security advisor findings after 0001-0006:
--   - function_search_path_mutable: every function needs a pinned
--     search_path so it can't be hijacked by a session that's altered its
--     own search_path before calling in.
--   - extension_in_public: pg_trgm belongs in the dedicated `extensions`
--     schema, not `public`.
-- (rls_enabled_no_policy on rate_limits/refresh_tokens/sync_ops and
-- authenticated_security_definer_function_executable on
-- supersede_attendance_record are both intentional — see their own
-- migrations — and not addressed here.)

create or replace function auth_org_id() returns uuid
language sql stable set search_path = public as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', '')::uuid
$$;

create or replace function auth_user_id() returns uuid
language sql stable set search_path = public as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

create or replace function auth_user_role() returns text
language sql stable set search_path = public as $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'user_role'
$$;

create or replace function is_manager() returns boolean
language sql stable set search_path = public as $$
  select auth_user_role() in ('owner', 'director')
$$;

create or replace function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function refresh_day_counts() returns trigger
language plpgsql set search_path = public as $$
declare
  d uuid := coalesce(new.day_id, old.day_id);
begin
  update attendance_days ad
  set present_count = (
        select count(*) from attendance_records r
        where r.day_id = d and r.is_current and r.status = 'present'),
      absent_count = (
        select count(*) from attendance_records r
        where r.day_id = d and r.is_current and r.status <> 'present'),
      total_count = (
        select count(*) from attendance_records r
        where r.day_id = d and r.is_current)
  where ad.id = d;
  return null;
end $$;

create or replace function guard_closed_day() returns trigger
language plpgsql set search_path = public as $$
declare
  st day_status;
begin
  select status into st from attendance_days where id = new.day_id;
  if st = 'closed' and new.supersedes_id is null then
    raise exception 'DAY_CLOSED' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function hit_rate_limit(
  p_key text,
  p_window_seconds int,
  p_limit int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  current_count int;
begin
  insert into rate_limits (key, window_start, count)
  values (p_key, bucket, 1)
  on conflict (key, window_start)
    do update set count = rate_limits.count + 1
  returning count into current_count;

  return current_count <= p_limit;
end;
$$;

-- pg_trgm out of public, into the dedicated extensions schema. Dropping
-- it cascades to idx_children_name_trgm, which we recreate right after —
-- Supabase's default search_path already includes `extensions`, so the
-- gin_trgm_ops operator class keeps resolving without any app change.
-- `create schema if not exists` makes this portable to a bare Postgres
-- (e.g. the RLS test suite), which doesn't pre-create that schema the
-- way a real Supabase project does.
create schema if not exists extensions;
drop extension if exists pg_trgm cascade;
create extension if not exists pg_trgm with schema extensions;
create index idx_children_name_trgm on children using gin (full_name extensions.gin_trgm_ops);
