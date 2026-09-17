-- Qalqon — 0001_init.sql
-- Extensions, enums, core tables, indexes, and triggers.
-- RLS policies live in 0002_rls.sql (kept separate so schema and access
-- control can be reviewed and rolled out independently).

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create type org_type       as enum ('oilaviy', 'dxsh', 'xususiy');
create type user_role      as enum ('owner', 'director', 'teacher');
create type attend_status  as enum ('present', 'absent', 'sick', 'vacation');
create type day_status     as enum ('open', 'closed', 'reopened');
create type state_result   as enum ('pending', 'accepted', 'rejected');
create type reject_reason  as enum ('tizim_qotdi', 'rasm_tanilmadi', 'xatolik', 'boshqa');
create type dispute_status as enum ('draft', 'submitted', 'won', 'lost', 'cancelled');
create type outbox_status  as enum ('pending', 'sent', 'failed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

create table organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) between 2 and 200),
  org_type        org_type not null,
  region          text,
  district        text,
  address         text,
  phone           text,
  capacity        int check (capacity between 1 and 1000),
  subsidy_enabled boolean not null default false,
  photo_required  boolean not null default true,
  work_days       int[] not null default '{1,2,3,4,5}',   -- 1=monday
  day_close_hour  int not null default 10 check (day_close_hour between 6 and 20),
  default_fee     numeric(12,2),
  timezone        text not null default 'Asia/Tashkent',
  plan            text not null default 'trial',
  trial_ends_at   timestamptz not null default now() + interval '14 days',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table app_users (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  full_name         text not null,
  role              user_role not null,
  telegram_id       bigint unique,
  telegram_username text,
  pin_hash          text,                 -- teacher only (argon2id)
  pin_set_at        timestamptz,
  failed_pin_count  int not null default 0,
  locked_until      timestamptz,
  is_active         boolean not null default true,
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint chk_auth_method check (
    (role in ('owner','director') and telegram_id is not null)
    or (role = 'teacher' and pin_hash is not null)
  )
);

create index idx_app_users_org on app_users(org_id) where is_active;

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------

create table devices (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  device_key    text not null,            -- client-generated, stored in localStorage
  label         text,                     -- "Katta guruh planshet"
  user_agent    text,
  last_seen_at  timestamptz,
  is_blocked    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (org_id, device_key)
);

-- ---------------------------------------------------------------------------
-- Groups and children
-- ---------------------------------------------------------------------------

create table groups (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  teacher_id  uuid references app_users(id) on delete set null,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_groups_org on groups(org_id) where is_active;

create table children (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  group_id         uuid references groups(id) on delete set null,
  full_name        text not null check (length(btrim(full_name)) between 2 and 200),
  birth_date       date,
  gender           text check (gender in ('m','f')),

  -- key field for comparison against the state system
  state_system_id  text,

  parent_name      text,
  parent_phone     text,
  monthly_fee      numeric(12,2),
  is_subsidized    boolean not null default false,

  -- consent to take photos (legal requirement)
  photo_consent    boolean not null default false,
  photo_consent_at timestamptz,
  photo_consent_by uuid references app_users(id),

  avatar_path      text,
  enrolled_at      date not null default current_date,
  left_at          date,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_children_org_active on children(org_id) where is_active;
create index idx_children_group on children(group_id) where is_active;
create index idx_children_state_id on children(org_id, state_system_id);
create index idx_children_name_trgm on children using gin (full_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------

-- Day "header": one org, one date
create table attendance_days (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  day_date      date not null,
  status        day_status not null default 'open',
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  closed_by     uuid references app_users(id),
  reopen_reason text,
  reopened_at   timestamptz,
  reopened_by   uuid references app_users(id),

  total_count   int not null default 0,
  present_count int not null default 0,
  absent_count  int not null default 0,

  day_seal      text,      -- rolling hash of every record that day
  sealed_at     timestamptz,

  created_at    timestamptz not null default now(),
  unique (org_id, day_date)
);

create index idx_days_org_date on attendance_days(org_id, day_date desc);

-- One child's state on one day
create table attendance_records (
  id               uuid primary key,   -- CLIENT-generated (idempotency)
  org_id           uuid not null references organizations(id) on delete cascade,
  day_id           uuid not null references attendance_days(id) on delete cascade,
  child_id         uuid not null references children(id) on delete cascade,

  status           attend_status not null,
  marked_at        timestamptz not null default now(),   -- SERVER time — official
  client_marked_at timestamptz,                          -- device time — audit only
  marked_by        uuid references app_users(id),
  device_id        uuid references devices(id),
  note             text,

  -- correction chain: a new record "supersedes" the old one, but the old one stays
  supersedes_id    uuid references attendance_records(id),
  is_current       boolean not null default true,
  correction_note  text,

  created_at       timestamptz not null default now()
);

-- A child has at most one CURRENT record per day
create unique index uq_record_current
  on attendance_records(day_id, child_id) where is_current;

create index idx_records_org_day on attendance_records(org_id, day_id);
create index idx_records_child on attendance_records(child_id, marked_at desc);

-- ---------------------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------------------

create table attendance_photos (
  id            uuid primary key,          -- client-generated
  org_id        uuid not null references organizations(id) on delete cascade,
  record_id     uuid not null references attendance_records(id) on delete cascade,
  child_id      uuid not null references children(id) on delete cascade,

  storage_path  text not null,             -- org_id/YYYY/MM/DD/child_id/uuid.webp
  sha256        text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  bytes         int not null check (bytes between 1 and 2097152),  -- max 2 MB
  width         int,
  height        int,
  taken_at      timestamptz not null,
  uploaded_at   timestamptz not null default now(),

  -- retention policy
  is_thumbnail_only boolean not null default false,
  purge_after       date,

  unique (record_id)
);

create index idx_photos_org_child on attendance_photos(org_id, child_id);
create index idx_photos_purge on attendance_photos(purge_after) where purge_after is not null;

-- ---------------------------------------------------------------------------
-- State system comparison
-- ---------------------------------------------------------------------------

create table state_checks (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  day_id        uuid not null references attendance_days(id) on delete cascade,
  child_id      uuid not null references children(id) on delete cascade,

  our_status    attend_status not null,
  result        state_result not null default 'pending',
  reason        reject_reason,
  note          text,

  checked_at    timestamptz,
  checked_by    uuid references app_users(id),
  created_at    timestamptz not null default now(),

  unique (day_id, child_id)
);

-- mismatch = we say "present", the state system did not accept it
create index idx_state_mismatch on state_checks(org_id, day_id)
  where result = 'rejected';

-- ---------------------------------------------------------------------------
-- Disputes (subsidy claims)
-- ---------------------------------------------------------------------------

create table disputes (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  period_month      date not null,            -- first day of the month
  title             text not null,
  affected_children int not null default 0,
  affected_days     int not null default 0,
  estimated_amount  numeric(14,2),
  status            dispute_status not null default 'draft',
  submitted_at      timestamptz,
  submitted_to      text,
  response_note     text,
  bundle_path       text,                     -- generated PDF
  bundle_code       text,                     -- verification code
  created_by        uuid references app_users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table dispute_items (
  dispute_id  uuid not null references disputes(id) on delete cascade,
  check_id    uuid not null references state_checks(id) on delete cascade,
  primary key (dispute_id, check_id)
);

-- ---------------------------------------------------------------------------
-- Parents and notifications
-- ---------------------------------------------------------------------------

create table parents (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  full_name        text not null,
  phone            text,
  telegram_chat_id bigint,
  link_code        text unique,          -- one-time, 8 characters
  link_code_expires timestamptz,
  linked_at        timestamptz,
  notify_enabled   boolean not null default true,
  created_at       timestamptz not null default now()
);

create index idx_parents_tg on parents(telegram_chat_id) where telegram_chat_id is not null;

create table parent_children (
  parent_id uuid not null references parents(id) on delete cascade,
  child_id  uuid not null references children(id) on delete cascade,
  primary key (parent_id, child_id)
);

create table notification_outbox (
  id          bigserial primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  parent_id   uuid references parents(id) on delete cascade,
  child_id    uuid references children(id) on delete cascade,
  kind        text not null,            -- 'arrival' | 'absent' | 'system'
  payload     jsonb not null,
  status      outbox_status not null default 'pending',
  attempts    int not null default 0,
  last_error  text,
  scheduled_at timestamptz not null default now(),
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_outbox_pending on notification_outbox(scheduled_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create table audit_log (
  id         bigserial primary key,
  org_id     uuid,
  actor_id   uuid,
  actor_role user_role,
  action     text not null,        -- 'record.mark', 'day.close', 'child.update', ...
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  ip         inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_audit_org_time on audit_log(org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Sync log (blocks duplicate requests)
-- ---------------------------------------------------------------------------

create table sync_ops (
  op_id      uuid primary key,        -- client-generated
  org_id     uuid not null,
  device_id  uuid,
  op_type    text not null,
  result     text not null,           -- 'applied' | 'duplicate' | 'rejected'
  reason     text,
  created_at timestamptz not null default now()
);

create index idx_sync_ops_cleanup on sync_ops(created_at);
-- rows older than 30 days are removed by a daily job

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_org_updated before update on organizations
  for each row execute function set_updated_at();
create trigger trg_app_users_updated before update on app_users
  for each row execute function set_updated_at();
create trigger trg_groups_updated before update on groups
  for each row execute function set_updated_at();
create trigger trg_children_updated before update on children
  for each row execute function set_updated_at();
create trigger trg_disputes_updated before update on disputes
  for each row execute function set_updated_at();

-- Refresh day statistics
create or replace function refresh_day_counts() returns trigger
language plpgsql as $$
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

create trigger trg_day_counts
  after insert or update on attendance_records
  for each row execute function refresh_day_counts();

-- Block writes to a closed day
create or replace function guard_closed_day() returns trigger
language plpgsql as $$
declare st day_status;
begin
  select status into st from attendance_days where id = new.day_id;
  if st = 'closed' then
    raise exception 'DAY_CLOSED' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger trg_guard_closed before insert on attendance_records
  for each row execute function guard_closed_day();
