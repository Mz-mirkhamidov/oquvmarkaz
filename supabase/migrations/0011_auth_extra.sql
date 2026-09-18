-- Qalqon — 0011_auth_extra.sql
-- Auth-rebuild-specific tables (TZ v2 §5.2) plus retiring the old,
-- hand-rolled auth schema it replaces (TZ v2, "Ilova — o'tish rejasi").
--
-- `rate_limits` (0003_auth.sql) is reused as-is — same shape TZ v2 §5.2
-- asks for, just now read/written by lib/auth/rate-limit.ts via
-- AUTH_DATABASE_URL instead of the old service-role Supabase client.

-- ---------------------------------------------------------------------------
-- Retire the old auth schema — 0 rows in production (confirmed), so this
-- is a plain drop, not a data migration. `drop table app_users cascade`
-- also drops the six now-dangling FK constraints on groups.teacher_id,
-- children.photo_consent_by, attendance_days.{closed_by,reopened_by},
-- attendance_records.marked_by, state_checks.checked_by, disputes.created_by
-- — those columns stay as plain (unconstrained) uuid columns. Those tables
-- are out of this rebuild's scope (TZ v2 doira); re-pointing them at
-- "user"(id) — now also uuid — is a natural follow-up but deliberately not
-- done here.
-- ---------------------------------------------------------------------------

drop table if exists refresh_tokens;
drop table if exists app_users cascade;

-- ---------------------------------------------------------------------------
-- Botdan yuboriladigan bir martalik kirish tokenlari (TZ v2 §5.2, §7)
-- ---------------------------------------------------------------------------

create table login_tokens (
  id                 uuid primary key default gen_random_uuid(),
  token_hash         text not null unique,
  telegram_id        bigint not null,
  telegram_username  text,
  first_name         text,
  chat_id            bigint not null,
  created_ip         inet,
  expires_at         timestamptz not null,
  consumed_at        timestamptz,
  consumed_ip        inet,
  created_at         timestamptz not null default now()
);

create index idx_login_tokens_tg on login_tokens(telegram_id, created_at desc);
create index idx_login_tokens_cleanup on login_tokens(expires_at);

-- ---------------------------------------------------------------------------
-- Qurilmalar — device_key/localStorage design (0001_init.sql) replaced by
-- a server-issued bind code + secret cookie (TZ v2 §4.3, §5.2)
-- ---------------------------------------------------------------------------

alter table devices drop constraint if exists devices_org_id_device_key_key;
alter table devices drop column if exists device_key;

alter table devices
  add column secret_hash  text,
  add column bind_code    text,
  add column bind_expires timestamptz,
  add column bound_at     timestamptz,
  add column created_by   uuid;

update devices set secret_hash = encode(gen_random_bytes(32), 'hex') where secret_hash is null;
alter table devices alter column secret_hash set not null;
alter table devices add constraint devices_secret_hash_key unique (secret_hash);

create unique index idx_devices_bindcode on devices(bind_code) where bind_code is not null;

drop index if exists idx_app_users_org; -- belt-and-braces; already gone with app_users

-- ---------------------------------------------------------------------------
-- Auth hodisalari — diagnostika uchun (TZ v2 X5, §11.1)
-- ---------------------------------------------------------------------------

create table auth_events (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  code        text not null,
  stage       text not null,
  ok          boolean not null,
  user_id     text,
  org_id      uuid,
  telegram_id bigint,
  device_id   uuid,
  ip          inet,
  user_agent  text,
  detail      jsonb
);

create index idx_auth_events_time on auth_events(at desc);
create index idx_auth_events_code on auth_events(code, at desc);
