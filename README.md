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

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase + Telegram credentials
pnpm dev
```

Apply database migrations against your Supabase project (order matters —
`0001_init.sql` first, then `0002_rls.sql`):

```bash
supabase db push
# or, against a specific project:
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_rls.sql
```

## Scripts

```bash
pnpm dev         # local dev server
pnpm build       # production build
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest
```

## Project status

Building in milestones (see TZ §16). Each milestone ends in a demoable
result before the next one starts.

- [x] **M0 — Foundation.** Next.js + TS + Tailwind v4, design tokens, base
      UI components, `0001_init.sql` / `0002_rls.sql`, `.env.example`, CI.
- [ ] M1 — Auth (Telegram login + teacher PIN) and org/group/child CRUD
- [ ] M2 — Attendance core (online)
- [ ] M3 — Photos and the evidence chain (hash, signed upload)
- [ ] M4 — Offline (Dexie outbox, sync engine, Service Worker)
- [ ] M5 — State-system comparison and reports (XLSX/PDF)
- [ ] M6 — Telegram notifications
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
