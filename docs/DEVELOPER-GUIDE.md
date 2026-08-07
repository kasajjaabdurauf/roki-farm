# Roki Farm Platform — Developer Guide

> Written so that a developer who has never seen this repo (memory-loss test) can run it, understand it, and
> safely change it. Read this before touching anything.

---

## 1 · What this is

A **Progressive Web App** for Roki Fruit & Vegetables Ltd (Uganda): farmer registration surveys, harvest logs,
production forecasting, export supply planning, farmer scoring (Tier 1/2/3), rule-based validation (zero AI),
bulk Excel/CSV import, inline-editing data grid, dedup & merge, multi-language farmer screens, PDF reports,
Sentry monitoring, and a $0 ops stack (Supabase free tier + GitHub Actions keep-alive + nightly backup email).

## 2 · Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 3 (custom palette: forest/ochre/cream in `tailwind.config.ts`) |
| UI | Custom components in `src/components/ui.tsx` + lucide-react icons |
| Tables | TanStack Table (`@tanstack/react-table`) |
| Excel | SheetJS (`xlsx`) — parsing in the browser, export to CSV/XLSX |
| PDF | jsPDF + jspdf-autotable (dynamic import — never in the main bundle) |
| Backend | Supabase (`@supabase/supabase-js`) — auth + Postgres + RLS |
| Storage | localStorage (offline-first store) synced to Supabase via an outbox |
| Monitoring | Sentry (optional DSN) + `/api/health` for uptime monitors |
| CI/CD | Vercel (deploy), GitHub Actions (keep-alive + nightly backup) |

## 3 · Running it

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # production build (must pass before any release)
npm run start      # serve the production build
node scripts/verify.ts   # 92 deterministic checks (needs npx tsx or esbuild)
```

**Environment:** copy `.env.example`. Leave Supabase vars empty → **preview mode** (sample data, no login).
Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` → **production mode** (login required,
cloud sync). `NEXT_PUBLIC_SENTRY_DSN` enables error reporting. **Never** put the Supabase `service_role` key
or `RESEND_API_KEY` in the browser bundle — GitHub secrets only.

## 4 · Architecture (read this first)

```
UI (pages/components) ──► src/lib/db.ts (the ONLY store the UI talks to)
                              ├─ localStorage cache (offline-first)
                              ├─ outbox queue of mutations
                              └─ src/lib/remote.ts (the ONLY Supabase client)
                                    ├─ auth (email/password, magic link, reset)
                                    ├─ fetchAll / pushOp / team management
                                    └─ row mapping (snake_case DB ⇄ camelCase app)
```

- **The UI never calls Supabase directly.** Everything goes through `db.ts` (synchronous store, instant UI) and
  syncs in the background. This is what makes the app feel instant and work offline.
- **Mutations** go through `mutate(fn)` which clones the snapshot (so `useSyncExternalStore` re-renders) and
  pushes the outbox automatically when production mode is on.
- **Session flow:** `AuthGate` (wraps the app in `layout.tsx`) → `validateSession()` (server-checked) →
  `bootstrapRemote()` (pull cloud data, adopt role) → mandatory-survey gate for farmers.
- **Farmer identity:** accounts ARE farmers. Signup (trigger in Supabase) creates the account's own
  `RFV-UG-XXXXX` farmer record. Uploads match rows by ID → phone → email. Signup claims an existing record by
  email/phone instead of duplicating.

## 5 · Data model (key fields)

`Farmer` — id (RFV-UG-XXXXX), fullName, email, phone (+256), district/subCounty/village, acreage,
primaryCrops, irrigationType, scaleTier, rokiTier (1/2/3), gender, refugeeStatus, ageGroup, landOwnership,
householdSize, plannedProductions[], plantingHistory[], survey (full 15-section questionnaire), flags[].

`ProduceLog` — id (RFV-LOG-XXXXX), farmerId, cropType, quantityKg, qualityGrade, harvestDate, batchId,
storageLocation, status (VERIFIED/NEEDS_AUDIT/FLAGGED), auditNotes[], yieldScore, source, createdAt.

`DbMeta` — role, demoFarmerId, outbox[], nextFarmerSeq/nextLogSeq, agentCodeHash, language.

## 6 · The rule engine (`src/lib/rules.ts`) — deterministic, zero AI

- Yield ceiling: `quantityKg > acreage × maxPerAcreKg` → **NEEDS AUDIT** (per-crop thresholds in Settings).
- Duplicate guard: same farmer + crop + harvest date within 24 h → **FLAGGED**.
- Scale tier: <2 ac Micro · 2–10 Mid · >10 Large. Roki tier: 1 = ≥3 ac + ≥6 logs + Grade-A verified in 180d;
  2 = ≥1.5 ac + ≥3 logs; 3 = else. Yield score: Low/Expected/Bumper vs per-crop median.
- Thresholds are admin-editable in Settings; edits re-run the engine over existing logs.

## 7 · Upload pipeline (`src/lib/sheet.ts`)

parse → auto-detect columns (synonym tables + guards: company headers never become names) → stage rows
(validation + warnings; multi-phone cells keep the first valid number) → user fixes inline in the staging
grid (tap-to-edit cells, dropdowns) → import (link by ID/phone/email, create records, build planting
history) → rule engine runs on every imported log. Rows with errors are never imported silently.

## 8 · i18n (`src/lib/i18n.ts`)

Farmer screens support en/lg/rn/sw. Add keys to `STRINGS` (all four languages) and call `t(lang, key, vars)`.
The language is stored in `DbMeta.language`, set from the survey's preferred language, switchable in Account.

## 9 · THE RULES (breaking any of these breaks production)

1. **React hooks before any conditional return.** An early return between hooks causes error #300 and a white
   screen on navigation. We've been burned twice — audit your component.
2. **Never call Supabase from a page/component.** Use `db.ts`; add new store functions there.
3. **Never silently drop user data** in the upload engine. Unknown columns stay visible in the mapper; weird
   values become warnings, not deletions.
4. **Migrations are numbered** (`supabase/schema.sql` is the fresh-install baseline; `migration_v2..v15.sql`
   apply on top, in order; `wipe_everything.sql` is the factory reset; `fresh_start.sql` + `migration_combined.sql`
   bundle the set and are idempotent). Every schema change ships a numbered migration AND is mirrored into
   `schema.sql` AND (if applicable) appended to `fresh_start.sql`/`migration_combined.sql`.
5. **Docs move with code.** Any user-facing change updates `docs/ROKI-USER-MANUAL.md` (manual) and
   `docs/CHANGELOG.md` (history). The walkthrough + audit get refreshed too. This is a requirement, not a
   nicety.
6. **Tests must pass before release:** `npx tsx scripts/verify.ts` (114 checks) and `npm run build`.
7. **Secrets:** `service_role`, `RESEND_API_KEY`, DB password → GitHub secrets/password manager only.
   `NEXT_PUBLIC_*` are public by design.
8. **Version stamp:** bump `APP_VERSION` in `src/lib/format.ts` + SW cache in `public/sw.js` on every release
   so phones pick up the new build.

## 10 · Release checklist (every release)

- [ ] `npm ci && npm run build` green
- [ ] `npx tsx scripts/verify.ts` green (114 checks)
- [ ] Bump `APP_VERSION` + SW cache (`roki-cache-vN`)
- [ ] Add entry to `docs/CHANGELOG.md`
- [ ] Update `docs/ROKI-USER-MANUAL.md` (features, troubleshooting, version log)
- [ ] Update `docs/ROKI-AUDIT-AND-ROADMAP.md` (tick done, adjust P0/P1)
- [ ] Update `docs/ROKI-SETUP-WALKTHROUGH.md` if setup changed (new migrations!)
- [ ] Push → Vercel auto-deploys → hard-refresh a phone to verify

## 11 · Known gotchas / troubleshooting

- **"Application error"** → check the error screen's Copy error button; usually hooks ordering or a stale SW
  (bump the cache). Rarely a missing dependency in the pushed `package.json` (Vercel says "up to date" while
  the repo lacks it) — re-copy `package.json` + `package-lock.json`.
- **User bounced to login on flaky network** → fixed in 2.9: transient failures keep the cached session.
- **Farmer stuck on "Setting up your farmer profile"** → the gate must never block `/survey` itself (2.4).
- **Duplicates from uploads + signups** → admin `/duplicates` merge tool.
- **Supabase free-tier pause** → the keep-alive workflow pings every 3 days; run it manually from Actions if
  the DB paused anyway, then unpause from the dashboard.
- **Migrations must run in order** v2→v3→v4→v5→v6→…→v15 (each is idempotent-ish; v5/v6 replace the trigger).
- **Agent names / `logged_by`:** the one source of the "who is on this device" identity is `src/lib/agent.ts`
  (`getAgentName`/`setAgentName`, key `roki-agent-name`; `normalizeAgentName` maps "none"/"n/a"/"-" → "None"
  so a skipped credit is never silent). Since v3.3 the name is **captured mandatorily inside the survey**
  (Step 1 amber box, blocks completion) and on uploads (Import disabled without a stamp or an Agent Name
  column); the banner only displays "Working as …". It is passed into `importStaging(st, agentStamp, dbOverride?)`.
  The upload sheet parser maps an **Agent Name / Enumerator** column to the new `agentName` stage field
  (`"Enumerator ID"` headers are deliberately ignored). `createFarmer`/`updateFarmer` MUST copy `loggedBy`
  (that was the v3.2 root-cause bug). Remote mapping lives in `remote.ts` (`logged_by` ↔ `loggedBy`); the
  Agents page (`/agents`) groups by `f.loggedBy ?? f.survey?.enumeratorName`.

## 12 · Where things live (map)

```
src/app/            pages: / (dashboards) /survey /farmers(+new,/[id]) /logs /upload /grid /forecast
                    /supply /duplicates /settings /account /help /login /reset-password
src/components/     ui.tsx (kit) · layout.tsx (shell, nav, live-refresh) · auth.tsx (gate)
                    brand.tsx · badges.tsx · farmers/FarmerForm.tsx (15-section wizard)
src/lib/            types.ts · db.ts (store+sync) · remote.ts (Supabase) · rules.ts (engine)
                    sheet.ts (upload) · dedup.ts · i18n.ts · report.ts (PDFs) · export.ts · phone.ts
                    seed.ts (preview sample data) · reference.ts (crops/districts) · format.ts
supabase/           schema.sql + migration_v2..v6.sql + wipe_everything.sql
.github/workflows/  keep_alive.yml · daily_backup.yml
scripts/            daily-backup.js (Resend email) · verify.ts (92 checks) · role-test.ts
simulations/        1000-farmer + log workbooks + generator
docs/               this guide · CHANGELOG.md · README.md (index) · ROKI-USER-MANUAL.md
                    ROKI-SETUP-WALKTHROUGH.md · ROKI-AUDIT-AND-ROADMAP.md
```
