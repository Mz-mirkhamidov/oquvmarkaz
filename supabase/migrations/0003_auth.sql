-- Qalqon — 0003_auth.sql
-- Tables needed by the auth flow (TZ §7.3-7.4, §7.9, §11.2) that weren't
-- part of the original §6 schema: refresh token storage (with rotation)
-- and a plain-Postgres rate limit counter for the MVP.

create table refresh_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_users(id) on delete cascade,
  device_id     uuid references devices(id) on delete set null,
  token_hash    text not null unique,       -- sha256 of the raw token, never the raw value
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  replaced_by   uuid references refresh_tokens(id),
  created_at    timestamptz not null default now()
);

create index idx_refresh_tokens_user on refresh_tokens(user_id) where revoked_at is null;
create index idx_refresh_tokens_cleanup on refresh_tokens(expires_at);

alter table refresh_tokens enable row level security;
-- No policies: only service_role (server) ever touches this table.
revoke all on refresh_tokens from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Rate limiting (§7.9) — simple fixed-window counter, sufficient for MVP
-- volume. `key` encodes endpoint + identity, e.g. "auth:ip:1.2.3.4" or
-- "sync:org:<uuid>".
-- ---------------------------------------------------------------------------

create table rate_limits (
  key         text not null,
  window_start timestamptz not null,
  count       int not null default 1,
  primary key (key, window_start)
);

alter table rate_limits enable row level security;
revoke all on rate_limits from authenticated, anon;

-- old windows are cheap to keep briefly and cleaned up by a daily job;
-- no separate cleanup index needed beyond the primary key.

-- Atomic fixed-window increment so concurrent requests can't race past
-- the limit. Only service_role calls this (server-side rate limiting).
create or replace function hit_rate_limit(
  p_key text,
  p_window_seconds int,
  p_limit int
) returns boolean
language plpgsql
security definer
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

revoke all on function hit_rate_limit(text, int, int) from public, authenticated, anon;
