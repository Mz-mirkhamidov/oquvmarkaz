# Qalqon

Nodavlat bog'chalar uchun mustaqil davomat va dalil tizimi — an
independent attendance and evidence system for private kindergartens in
Uzbekistan. Full spec: see the project TZ (texnik topshiriq) shared with
this repository.

Qalqon keeps a kindergarten's own tamper-evident attendance record (photo
+ server timestamp + hash per child, per day) that survives even when
`nodavlat-bogcha.uz` (the state subsidy system) is slow, unreachable, or
rejects a submission. It does **not** connect to, scrape, or automate the
state system in any way.

## Stack

- Next.js 16 (App Router), TypeScript (`strict`), React 19
- Tailwind CSS v4 — design tokens in `app/globals.css`, no `tailwind.config.js` theme
- Hand-built shadcn-style UI primitives in `components/ui/` (Radix + CVA)
- Supabase (Postgres 15 + Storage), RLS on every table, own JWT (no Supabase Auth)
- Dexie (IndexedDB) + Service Worker for offline-first sync (from M4 onward)
- `@tanstack/react-query`, `zod`, `grammy` (Telegram bot), `@react-pdf/renderer`, `exceljs`

## Getting started

A dedicated Supabase project ("qalqon", ref `mxxsmgkpdgdexodvdpzb`,
`eu-central-1`) exists with every migration below already applied. To run
against it:

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Fill in `.env.local` from the project's dashboard (Settings → API):

- `NEXT_PUBLIC_SUPABASE_URL` = `https://mxxsmgkpdgdexodvdpzb.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the `anon` legacy key shown there
- `SUPABASE_SERVICE_ROLE_KEY` = the `service_role` key shown there
- `SUPABASE_JWT_SECRET` = Settings → API → JWT Settings → "Legacy JWT
  secret" (enable it there if the project doesn't show one yet — this
  project was created on Supabase's newer per-key signing system, which
  has no shared secret by default, and our own JWT signing needs one so
  PostgREST accepts our tokens for the `authenticated` role. None of
  this is retrievable through the Supabase MCP tools this project was
  built with — it's a one-time manual step in the dashboard.)
- Telegram vars: create a bot via @BotFather for `TELEGRAM_BOT_TOKEN` /
  `TELEGRAM_BOT_USERNAME`

To point at a different Supabase project instead, apply every migration
in `supabase/migrations/` in order:

```bash
supabase db push
# or, against a specific project:
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

`0005_storage.sql` needs Supabase's `storage` schema and so only applies
to a real Supabase project — the RLS test suite (below) skips it and
runs everything else against a bare Postgres instance.

After any migration change, regenerate `lib/db/types.ts` from the live
schema (`mcp__Supabase__generate_typescript_types`, or `supabase gen
types typescript`) rather than hand-editing it.

After each deploy whose URL changed, point Telegram's webhook at it:

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... NEXT_PUBLIC_APP_URL=https://... \
  pnpm telegram:set-webhook
```

`notification_outbox` (parent Telegram messages) is drained by
`POST /api/cron/notifications`, gated by `CRON_SECRET`. `vercel.json`
schedules it every minute via Vercel Cron, which sends `Authorization:
Bearer $CRON_SECRET` automatically when that env var is set on the
project — on a plan whose cron minimum is coarser than a minute, widen
`vercel.json`'s schedule, or call the same route from any other
scheduler that can send that header.

## Scripts

```bash
pnpm dev         # local dev server
pnpm build       # production build
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest — unit tests always run; the RLS suite in
                 # tests/security/ needs a reachable Postgres
                 # (TEST_DATABASE_URL, default postgres://postgres:postgres@127.0.0.1:5432/qalqon_test)
                 # and skips itself with a warning if none is found
```

## Project status

Building in milestones (see TZ §16). Each milestone ends in a demoable
result before the next one starts.

- [x] **M0 — Foundation.** Next.js + TS + Tailwind v4, design tokens, base
      UI components, `0001_init.sql` / `0002_rls.sql`, `.env.example`, CI.
- [x] **M1 — Auth and org setup.** Telegram login (`initData` HMAC) +
      teacher PIN (argon2id, lockout), JWT sessions with refresh
      rotation + theft detection, org registration wizard, group/child/
      teacher CRUD, RLS-backed tenant isolation with a real-Postgres test
      suite in CI (T6-T8, T10, T11).
- [x] **M2 — Attendance core (online).** `/api/sync/push` (idempotent
      `attendance.mark` / `attendance.correct` / `day.close` ops),
      `/api/sync/pull`, `/api/attendance/{today,[date],close,reopen}`,
      the `/davomat` screen (ChildCard, StatusSheet, SyncBar, day-close
      confirmation), append-only corrections via a SECURITY DEFINER
      Postgres function (`supersede_attendance_record`) so a same-day
      re-tap and a past-day correction share one audited path.
- [x] **M3 — Photos and the evidence chain.** `lib/storage/` (a
      `StorageProvider` interface per TZ §11.7a, so the storage backend
      can move to an Uzbekistan-hosted one later without touching call
      sites), `/api/photos/sign` + `/api/photos/attach` (server re-hashes
      the uploaded bytes and rejects on mismatch — TZ §7.7's whole point),
      three private storage buckets with org-scoped read policies,
      `CameraSheet` (getUserMedia capture, front/back switch, "rasmsiz
      belgilash" fallback when the camera's denied), client-side WebP
      compression + SHA-256 hashing before upload.
- [x] **M4 — Offline-first.** `lib/offline/db.ts` (Dexie schema: outbox,
      photos, cached children/groups, local records, meta), a
      write-local-then-queue pattern (`lib/offline/queue.ts`) so
      `/davomat` never blocks on the network, a sync engine
      (`lib/offline/sync.ts`) with exponential backoff shared by real
      network failures and 401/429/500 responses, a sequential (not
      parallel) photo-upload queue, `pullAndCache()`'s conflict rule
      (server truth wins except unsynced local entries), and a
      hand-written vanilla-JS service worker (`public/sw.js` — the
      standard `@serwist/next` webpack plugin doesn't support Turbopack,
      confirmed from its own source) implementing NetworkFirst/
      CacheFirst/NetworkOnly/StaleWhileRevalidate plus an offline
      fallback page, with a user-triggered (never forced) update banner.
- [x] **M5 — State comparison, disputes and reports.** `/hisobot`
      (month hub) and `/hisobot/[sana]` (per-day comparison): the director
      marks each child's state-system verdict against what we recorded
      (`state_checks`, `/api/state/[date]`), and a rejected verdict is the
      mismatch signal the rest of the milestone keys off. Rejected checks
      bundle into a `dispute` (`/api/disputes`), whose evidence — child,
      day, our status, rejection reason, the marking teacher, and the
      photo's SHA-256 as tamper-evidence without embedding the photo
      itself — renders into a PDF via `@react-pdf/renderer`
      (`lib/reports/dispute-pdf.tsx`, `/api/disputes/[id]/pdf`); a
      submitted dispute's bundle is frozen in the `reports` storage
      bucket under a verification `bundle_code`. A monthly attendance
      register (daily summary + a per-child/per-day status grid) exports
      as XLSX via `exceljs` (`/api/reports/monthly`). `0009_dispute_items_
      hardening.sql` closes an RLS gap found while building this: writing
      a `dispute_items` row now also checks that `check_id` belongs to
      the caller's org, not just `dispute_id` — the two-layer defense
      TZ §11.3 asks for everywhere else. `lib/storage/` now takes a
      bucket argument (`storage("reports")`) instead of hardcoding
      `attendance`.
- [x] **M6 — Telegram notifications.** `lib/telegram/bot.ts` (a `grammy`
      bot, one instance per process, no long-polling — webhook only) and
      `/api/telegram/webhook` (the `std/http` framework adapter, gated by
      the `X-Telegram-Bot-Api-Secret-Token` Telegram echoes back). Parent
      linking: the director generates an 8-character one-time code per
      parent (`/sozlama/ota-onalar`, `lib/utils/link-code.ts`) as a
      `t.me/<bot>?start=<code>` deep link; `/start <code>` in the bot
      consumes it, storing the parent's `telegram_chat_id`. Every fresh
      (not re-tapped or corrected) attendance mark enqueues one
      `notification_outbox` row per linked, notification-enabled parent
      of that child (`lib/notifications/enqueue.ts`, called from
      `applyMark`/`closeDay` in `lib/attendance/apply-op.ts`) — arrival
      for `present`, a status note otherwise. `POST /api/cron/notifications`
      (Vercel Cron, `vercel.json`) drains the outbox
      (`lib/notifications/processor.ts`) via `bot.api.sendMessage`,
      sequentially (Telegram is rate-limited per chat), with the same
      attempts/backoff-to-failed shape as the offline sync outbox.
      `notification_outbox` has no `authenticated` INSERT policy at all
      (0002_rls.sql) — both the enqueue and the drain go through
      `service_role`, mirrored by `tests/security/parents.spec.ts`.
- [ ] M7 — Landing page and polish

## Hard rules

- No `any` — `unknown` + Zod at every boundary.
- `SUPABASE_SERVICE_ROLE_KEY` never enters a `'use client'` file.
- `org_id` is read from the JWT only, never from a request parameter.
- `attendance_records` / `attendance_photos` have no `UPDATE`/`DELETE` grants —
  corrections are new rows with `supersedes_id`.
- No automated requests to `nodavlat-bogcha.uz` or its apps — no scraping,
  no credential storage, ever.
- Mobile-first; must work at 360px width and fully offline.
