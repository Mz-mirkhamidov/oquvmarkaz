-- Qalqon — 0012_app_role.sql
-- Two roles, two connection strings, two purposes (TZ v2 §3.2, §5.3).
--
-- qalqon_auth — owns the Better Auth tables + login_tokens/rate_limits/
--   auth_events. Table ownership means it bypasses RLS on them by default
--   (Postgres: owners aren't subject to RLS unless FORCE ROW LEVEL SECURITY
--   is set, which we don't set here). Used only by lib/db/auth-pool.ts.
--
-- qalqon_app — RLS-constrained, `nobypassrls`. Used only by
--   lib/db/app-pool.ts (currently: the `devices` table). The blanket grant
--   below still leaves qalqon_app unable to read/write the Better-Auth-only
--   tables, because RLS is enabled on them with zero policies (§5.3).

create role qalqon_app with login password :'qalqon_app_password'
  nosuperuser nocreatedb nocreaterole noinherit nobypassrls;

create role qalqon_auth with login password :'qalqon_auth_password'
  nosuperuser nocreatedb nocreaterole noinherit nobypassrls;

-- Postgres requires the ALTER OWNER'ing role to be a member of the target
-- role; `postgres` isn't automatically a member of a role it just created.
grant qalqon_auth to postgres;

grant usage on schema public to qalqon_app, qalqon_auth;
grant select, insert, update, delete on all tables in schema public to qalqon_app;
grant usage, select on all sequences in schema public to qalqon_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to qalqon_app;

alter table "user" owner to qalqon_auth;
alter table "session" owner to qalqon_auth;
alter table "account" owner to qalqon_auth;
alter table "verification" owner to qalqon_auth;
alter table login_tokens owner to qalqon_auth;
alter table rate_limits owner to qalqon_auth;
alter table auth_events owner to qalqon_auth;

alter table login_tokens enable row level security;
alter table rate_limits  enable row level security;
alter table auth_events  enable row level security;
-- No policies on the three above → qalqon_app cannot see them at all.

-- ---------------------------------------------------------------------------
-- devices: replace the old device_key-era policies (0002_rls.sql) with the
-- manager-only shape TZ v2 §5.3 specifies — device creation/blocking is now
-- server-mediated (POST /api/devices), not client self-registration.
-- ---------------------------------------------------------------------------

drop policy if exists devices_write  on devices;
drop policy if exists devices_update on devices;
drop policy if exists devices_select on devices;

create policy devices_select on devices for select
  using (org_id = auth_org_id());
create policy devices_manage on devices for all
  using (org_id = auth_org_id() and is_manager())
  with check (org_id = auth_org_id() and is_manager());
