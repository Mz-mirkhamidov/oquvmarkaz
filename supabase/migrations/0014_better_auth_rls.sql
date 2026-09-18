-- Qalqon — 0014_better_auth_rls.sql
-- 0012_app_role.sql's own comment claims RLS is enabled with zero policies
-- on "user"/"session"/"account"/"verification" (TZ v2 §5.3) — it wasn't;
-- only login_tokens/rate_limits/auth_events actually got
-- `enable row level security`. Found while writing A6's A-T19 test
-- ("qalqon_app doesn't bypass RLS"): qalqon_app's blanket
-- `grant select, insert, update, delete on all tables in schema public`
-- (also from 0012, granted before ownership moved to qalqon_auth) gave it
-- unrestricted direct access to these tables — pinHash and telegramId
-- included — with nothing blocking it. qalqon_auth owns all four, so it is
-- unaffected (owners aren't subject to RLS).

alter table "user"         enable row level security;
alter table "session"      enable row level security;
alter table "account"      enable row level security;
alter table "verification" enable row level security;
-- No policies, same as login_tokens/rate_limits/auth_events → qalqon_app
-- (and every other non-owner role) sees zero rows.
