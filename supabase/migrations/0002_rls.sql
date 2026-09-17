-- Qalqon — 0002_rls.sql
-- Row Level Security. Every table gets RLS enabled — none is left without it.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function auth_org_id() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', '')::uuid
$$;

create or replace function auth_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

create or replace function auth_user_role() returns text
language sql stable as $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'user_role'
$$;

create or replace function is_manager() returns boolean
language sql stable as $$
  select auth_user_role() in ('owner', 'director')
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table organizations      enable row level security;
alter table app_users          enable row level security;
alter table devices            enable row level security;
alter table groups             enable row level security;
alter table children           enable row level security;
alter table attendance_days    enable row level security;
alter table attendance_records enable row level security;
alter table attendance_photos  enable row level security;
alter table state_checks       enable row level security;
alter table disputes           enable row level security;
alter table dispute_items      enable row level security;
alter table parents            enable row level security;
alter table parent_children    enable row level security;
alter table notification_outbox enable row level security;
alter table audit_log          enable row level security;
alter table sync_ops           enable row level security;

-- ---------------------------------------------------------------------------
-- Organizations: only sees itself, only a manager edits it
-- ---------------------------------------------------------------------------

create policy org_select on organizations for select
  using (id = auth_org_id());
create policy org_update on organizations for update
  using (id = auth_org_id() and is_manager())
  with check (id = auth_org_id());

-- ---------------------------------------------------------------------------
-- Users, devices
-- ---------------------------------------------------------------------------

create policy app_users_select on app_users for select
  using (org_id = auth_org_id());
create policy app_users_write on app_users for insert
  with check (org_id = auth_org_id() and is_manager());
create policy app_users_update on app_users for update
  using (org_id = auth_org_id() and is_manager())
  with check (org_id = auth_org_id());

create policy devices_select on devices for select
  using (org_id = auth_org_id());
create policy devices_write on devices for insert
  with check (org_id = auth_org_id());
create policy devices_update on devices for update
  using (org_id = auth_org_id() and is_manager())
  with check (org_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- Groups: manager only
-- ---------------------------------------------------------------------------

create policy groups_select on groups for select
  using (org_id = auth_org_id());
create policy groups_write on groups for all
  using (org_id = auth_org_id() and is_manager())
  with check (org_id = auth_org_id() and is_manager());

-- ---------------------------------------------------------------------------
-- Children: manager sees all, teacher only their own group
-- ---------------------------------------------------------------------------

create policy children_select on children for select
  using (
    org_id = auth_org_id()
    and (is_manager() or group_id in (
      select id from groups where teacher_id = auth_user_id()
    ))
  );
create policy children_write on children for all
  using (org_id = auth_org_id() and is_manager())
  with check (org_id = auth_org_id() and is_manager());

-- ---------------------------------------------------------------------------
-- Attendance days
-- ---------------------------------------------------------------------------

create policy days_select on attendance_days for select
  using (org_id = auth_org_id());
create policy days_insert on attendance_days for insert
  with check (org_id = auth_org_id());
create policy days_update on attendance_days for update
  using (org_id = auth_org_id())
  with check (org_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- Attendance records: read — own org; write — INSERT only
-- ---------------------------------------------------------------------------

create policy records_select on attendance_records for select
  using (org_id = auth_org_id());
create policy records_insert on attendance_records for insert
  with check (org_id = auth_org_id());
-- UPDATE and DELETE policies are DELIBERATELY not created → nobody can change them

-- ---------------------------------------------------------------------------
-- Photos: same as records
-- ---------------------------------------------------------------------------

create policy photos_select on attendance_photos for select
  using (org_id = auth_org_id());
create policy photos_insert on attendance_photos for insert
  with check (org_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- State checks, disputes
-- ---------------------------------------------------------------------------

create policy state_checks_select on state_checks for select
  using (org_id = auth_org_id());
create policy state_checks_write on state_checks for all
  using (org_id = auth_org_id() and is_manager())
  with check (org_id = auth_org_id() and is_manager());

create policy disputes_select on disputes for select
  using (org_id = auth_org_id());
create policy disputes_write on disputes for all
  using (org_id = auth_org_id() and is_manager())
  with check (org_id = auth_org_id() and is_manager());

create policy dispute_items_select on dispute_items for select
  using (
    dispute_id in (select id from disputes where org_id = auth_org_id())
  );
create policy dispute_items_write on dispute_items for all
  using (
    is_manager()
    and dispute_id in (select id from disputes where org_id = auth_org_id())
  )
  with check (
    dispute_id in (select id from disputes where org_id = auth_org_id())
  );

-- ---------------------------------------------------------------------------
-- Parents, notifications: manager only
-- ---------------------------------------------------------------------------

create policy parents_select on parents for select
  using (org_id = auth_org_id() and is_manager());
create policy parents_write on parents for all
  using (org_id = auth_org_id() and is_manager())
  with check (org_id = auth_org_id() and is_manager());

create policy parent_children_select on parent_children for select
  using (
    parent_id in (select id from parents where org_id = auth_org_id() and is_manager())
  );
create policy parent_children_write on parent_children for all
  using (
    parent_id in (select id from parents where org_id = auth_org_id() and is_manager())
  )
  with check (
    parent_id in (select id from parents where org_id = auth_org_id())
  );

create policy outbox_select on notification_outbox for select
  using (org_id = auth_org_id() and is_manager());

-- ---------------------------------------------------------------------------
-- Audit: read-only, manager only
-- ---------------------------------------------------------------------------

create policy audit_select on audit_log for select
  using (org_id = auth_org_id() and is_manager());

-- sync_ops has no policies for authenticated/anon — only service_role (which
-- bypasses RLS) writes and reads it, from /api/sync/push.

-- ---------------------------------------------------------------------------
-- Extra protection at the grant level
-- ---------------------------------------------------------------------------

revoke update, delete on attendance_records from authenticated, anon;
revoke update, delete on attendance_photos  from authenticated, anon;
revoke update, delete on audit_log          from authenticated, anon;
revoke all on sync_ops from authenticated, anon;

-- service_role bypasses RLS, so its key stays server-only; the grant
-- restrictions above stay in force even where server code uses it.

-- The storage.objects policy lives in 0005_storage.sql, not here: it's
-- deliberately split out so a problem with Supabase's storage schema
-- (e.g. applying this against a bare Postgres, as the RLS test suite
-- does) can never take the tenant-isolation policies above down with it
-- — pg's simple-query protocol runs a whole multi-statement file as one
-- implicit transaction, so one failing statement rolls back everything
-- before it in the same file.
