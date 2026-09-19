# Deploy checklist (TZ v2 §17)

Run through this after **every** deploy that touches auth (`lib/auth/**`,
`app/(auth)/**`, `supabase/migrations/00{10,11,12,13,14}_*.sql`, or any
Vercel env var). It exists to stop X7/X9 (silent env drift, stale webhook)
from recurring.

There are three ways in, and a deploy can break one without touching the
others: the bot (steps 6-8), email and password (steps 11-13), and a
teacher's PIN on a bound device (`/kirish/pin`, not covered here because it
needs a physical bound tablet).

```
[ ] 1. Env vars are set in Vercel's "Production" scope (not just Preview/Dev)
[ ] 2. Vars were added BEFORE the deploy that's live now (a redeploy is
       required after adding/changing any — Vercel doesn't retro-apply them)
[ ] 3. /api/auth/selftest?key=<SELFTEST_KEY> opens and "problems": [] is empty
[ ] 4. selftest's TELEGRAM_BOT_TOKEN fingerprint matches BotFather's token
       (locally: echo -n "<token>" | sha256sum | tail -c 7)
[ ] 5. setWebhook was re-run, getWebhookInfo's url is correct,
       last_error_message is empty, pending_update_count = 0
[ ] 6. Sent /kirish to the bot -> got the button back
[ ] 7. Tapped the button -> logged in in the browser
[ ] 8. Reused the same link -> TOKEN_INVALID
[ ] 9. Migrations applied (selftest: db.migrations.last, or check
       supabase_migrations.schema_migrations directly)
[ ] 10. A LOGIN_OK row appeared in auth_events for that login
[ ] 11. /kirish/email -> registered a throwaway account -> landed on
        /sozlash (NOT bounced back to /kirish)
[ ] 12. Signed out, signed back in with the same address -> got in
[ ] 13. Tried to register tg-1@telegram.local -> refused with
        EMAIL_RESERVED (the account-takeover guard; see below)
```

Steps 11-13 need no extra env vars — email sign-in rides on the same
`BETTER_AUTH_*`/`AUTH_DATABASE_URL` the bot flow already uses, and the
`account` table `0010_better_auth.sql` creates already has the `password`
column. **13 is not optional.** Telegram accounts are keyed by a synthetic
`tg-<telegramId>@telegram.local` address and a Telegram ID is public, so
if that guard ever stops firing, anyone can claim a Telegram user's
account before they first sign in and keep the password to it.

**If the bot token was rotated:** steps 1 -> 2 -> 5 are mandatory again.
Rotating the token breaks the webhook silently — nothing else reminds you.

## Env vars this module needs in Production

Pre-existing (do not lose these when adding the ones below):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`,
`TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, `APP_TIMEZONE`,
`CRON_SECRET`, `STORAGE_PROVIDER`.

Added by the Better Auth rebuild (A0-A6):
`BETTER_AUTH_SECRET` (>=32 chars), `BETTER_AUTH_URL` (the deployed origin,
e.g. `https://qalqon.uz`), `AUTH_DATABASE_URL` (`qalqon_auth` role),
`DATABASE_URL` (`qalqon_app` role), `SELFTEST_KEY` (>=16 chars).

`lib/env.ts` validates the *entire* schema as one Zod object — if even one
unrelated var is missing, every route that imports `lib/auth/index.ts`
(which most routes do, transitively via `lib/auth/guard.ts`) fails at
Next.js's page-data-collection step during `next build`, not just at
runtime. A missing var is a **build-breaking** error here, not a soft
runtime failure — treat any "Invalid environment configuration" build log
line as this checklist's item 1, not a code bug.

## Migration order this module depends on

`0010_better_auth.sql` (core tables) -> `0011_auth_extra.sql` (drops
`app_users`/`refresh_tokens`, adds `login_tokens`/`auth_events`, alters
`devices`) -> `0012_app_role.sql` (`qalqon_app`/`qalqon_auth` roles,
ownership, `devices` policies) -> `0013_user_fk.sql` (restores the FKs
that `0011`'s `drop table app_users cascade` silently dropped, now
pointing at `"user"(id)`) -> `0014_better_auth_rls.sql` (enables RLS with
zero policies on `"user"`/`"session"`/`"account"`/`"verification"` — without
this, `qalqon_app`'s blanket grant from `0012` gives it unrestricted direct
read/write access to those tables, PIN hashes included).

`0012`'s `create role ... password :'qalqon_app_password'` /
`:'qalqon_auth_password'` are **psql `-v` placeholders**, not valid SQL on
their own — apply this migration via `psql -v qalqon_app_password=... -v
qalqon_auth_password=...` (or the Supabase SQL editor with the values
substituted by hand), never by piping the file straight into `execute_sql`.
The real passwords live only in Vercel's `AUTH_DATABASE_URL`/`DATABASE_URL`
values, never in git.
