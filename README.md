# Roki Fruit & Vegetables — Farm & Supply Platform 🌱

Farmer registration **surveys**, **production forecasting** and **export supply planning** for Roki Fruit & Vegetables Ltd — built for 1,000+ farmers in Uganda.

**Zero AI.** Every validation, score and aggregate is produced by fast, deterministic, rule-based algorithms.

| | |
|---|---|
| **Platform** | PWA — web, tablet & mobile (installable, offline-first) |
| **Stack** | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · TanStack Table · SheetJS (xlsx) · Lucide icons |
| **Storage** | Offline-first localStorage repository (`src/lib/db.ts`) — single swap point for Supabase/PostgreSQL |
| **Deploy** | Vercel (drag & drop, GitHub import, or `vercel` CLI) |

---

## ✨ What's inside

### 1 · Farmer Registration Survey (official 15-section questionnaire)
Registration follows Roki's official **"Digital Farmer Registration, Profiling and Production Planning Questionnaire"** (Nakivale Refugee Settlement & Host Communities project), as a 9-step wizard:

1. **Section 1 — Identification & bio-data** — enumerator name/ID, full name, gender, age (years), primary + alternative phone, district / sub-county / parish / village, GPS coordinates
2. **Section 2 — Refugee & host community status** — refugee vs host, country of origin (South Sudan, DRC, Burundi, Somalia, Rwanda…), year arrived, settlement, refugee household number, adults/children, vulnerability characteristics (female-headed, youth, disability, elderly)
3. **Section 3 — Farming experience & history** — years farming, farming types, crops produced before (years + average area), commercial sales history + channels
4. **Section 4 — Land & farm assets** — land access, ownership status (own / family / rented / allocated settlement land / other), total acreage, land under cultivation, expansion land
5. **Sections 5–6 — Current activities & capacity** — current crops (area, expected harvest date, quantity), production season, production system, current vs future production capacity, production constraints
6. **Sections 7–8 — Inputs & management** — input sources, improved seed, extension support, irrigation, record keeping, digital records adoption
7. **Sections 9–10 — Market & Roki interest** — who they sell to, average prices, selling challenges, interest in supplying Roki, crops to supply, and the **expected production plan for Roki** (crop × area × harvest period × quantity) which powers the forecast
8. **Sections 11–13 — Contract, finance & climate** — Roki specification/export standard/forward-purchase willingness, financial access, climate challenges and climate-smart practices
9. **Sections 14–15 — Consent, enumerator assessment & review** — digital consent (with date), land availability / production potential / recommended category, and a full review before submit

Every farmer gets a system ID (`RFV-UG-XXXXX`) and a profile page showing the complete survey record, production plan and scoring.

### 2 · Farmer Dashboard
- Total registered farmers
- **Refugee vs host** community breakdown
- **Gender distribution** (women / men split)
- **Location mapping** (district-level)
- Farmer scoring distribution (Tier 1 / 2 / 3)

### 3 · Production Forecast Dashboard
Built from every farmer's survey production plans:

| Crop | Farmers producing | Expected volume | Harvest period |
|---|---|---|---|
| Tomato | 250 | 150 t | Sep–Nov |
| Onion | 300 | 200 t | Oct–Dec |

Export to CSV / Excel with one click.

### 4 · Export Supply Planning
Roki knows **who has what crop, where farms are, expected harvest dates, and available volumes**:
- Filter by crop, district, tier and free-text search
- Every supply line links to the farmer's full profile
- One-click CSV / Excel export of the filtered supply list

### 5 · Farmer Scoring System (rule-based, zero AI)
- **Tier 1 · Export-ready** — ≥ 3 acres, ≥ 6 harvest logs, verified Grade-A volume in the last 180 days
- **Tier 2 · Developing commercial** — ≥ 1.5 acres, ≥ 3 harvest logs
- **Tier 3 · New farmers requiring support** — everyone else

Tiers recalculate automatically as farmers log harvests (or when logs are edited/deleted).

### 6 · Harvest Logs, Bulk Upload, Data Grid, Rule Engine (kept from the demo)
- Harvest entry with unit conversion + instant rule checks (anomaly ceiling, duplicate guard, yield scoring)
- Drag-and-drop Excel/CSV upload with column auto-mapping and a validation staging grid
- Inline-editing data grid with bulk delete/reassign and CSV/XLSX exports (includes new survey columns: gender, community, age, land ownership, tier)
- Deterministic rule engine with admin-editable thresholds in Settings

### Backend, auth & $0 operations
- **Supabase** backend with **auth** (email/password + magic link), **row-level security** (schema in `supabase/schema.sql`), and an offline-first **sync engine** (local store + outbox → cloud push)
- **Keep-alive GitHub Action** (`.github/workflows/keep_alive.yml`) pings Supabase every 3 days so the free database never pauses
- **Nightly backup** (`.github/workflows/daily_backup.yml` + `scripts/daily-backup.js`) emails a 2-sheet Excel backup to the admin via Resend
- **Docs:** `docs/ROKI-USER-MANUAL.md` (full manual) and `docs/ROKI-AUDIT-AND-ROADMAP.md` (launch checklist)
- **In-app:** `Help & Guide` page with clickable walkthrough + FAQs + glossary; admin **Master backup** button

### PWA / offline
- Installable, works offline in the field, live "N pending sync" indicator with outbox queue

### Demo data
First load seeds **36 farmers across 24 districts** with full survey answers (gender, refugee/host mix, land ownership, production plans) and ~250 harvest logs — including intentional anomalies and duplicates so every rule and dashboard has visible data. Reset anytime in **Settings → Reset demo data**.

---

## 🚀 Deploy to Vercel

The project ships as `roki-farm-platform.zip` (all source; `node_modules`/`.next` excluded — Vercel installs and builds on their side).

### A · Drag & drop (fastest)
1. Unzip `roki-farm-platform.zip` → you get a `roki-farm-platform/` folder.
2. Go to **vercel.com/new**, sign in, and **drag the folder** into the upload area.
3. Vercel detects Next.js automatically — hit **Deploy**. Done in ~2 minutes.

### B · GitHub → Import
Push the unzipped folder to a repo, then **vercel.com/new → Import Git Repository**.

### C · Vercel CLI
```bash
unzip roki-farm-platform.zip
cd roki-farm-platform
npm install
npx vercel          # or: npm i -g vercel && vercel --prod
```

### Environment variables
**None required.** For a shared backend later, set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`) and swap the repository in `src/lib/db.ts`.

### Updating phones with the app installed
Each release bumps the service-worker cache (`jfl-cache-vN` → `roki-cache-v1` in `public/sw.js`) and registers with `updateViaCache: "none"`, so after redeploying, phones discard the old build on their next visit. Fully close the app (swipe out of the app switcher) and reopen to force the update.

---

## 🧭 Roles (demo persona switcher — top-right)

- **Admin / Roki** — everything: surveys, forecast, supply, uploads, grid, settings
- **Field Agent** — registering farmers with the survey, harvest logs, forecast/supply views
- **Farmer** — personal dashboard, "My Farm" profile, logging their own harvests

---

## 🗂 Project structure

```
src/
├── app/
│   ├── page.tsx            # Farmer Dashboard — totals, refugee/host, gender, locations, tiers
│   ├── forecast/           # Production Forecast (crop × farmers × volume × harvest period)
│   ├── supply/             # Export Supply Planning (filters + CSV/XLSX export)
│   ├── farm/               # Farmer persona home
│   ├── farmers/            # List (tier filters), survey registration, profile detail
│   ├── logs/               # Harvest entry + filtered history
│   ├── upload/             # Bulk upload, column mapper, staging grid
│   ├── grid/               # Inline-editing data grid + exports
│   ├── settings/           # Rule toggles, per-crop thresholds, backup
│   ├── layout.tsx          # Fonts, metadata, manifest, SW registration
│   └── manifest.ts         # PWA manifest
├── components/             # UI kit, badges, shell (sidebar / bottom nav / More sheet)
└── lib/
    ├── types.ts            # Data models incl. survey answers + Roki tiers
    ├── rules.ts            # ⚙️ Rule engine + Roki farmer scoring (deterministic, no AI)
    ├── phone.ts            # MTN/Airtel Uganda validation + normalization
    ├── sheet.ts            # Parsing, synonym auto-mapping, staging validation
    ├── db.ts               # Offline-first repository + sync outbox
    ├── seed.ts             # Deterministic demo dataset with survey answers
    ├── reference.ts        # Crops, thresholds, harvest windows, districts
    └── export.ts           # CSV / XLSX export engine
```

## 🧪 Verifying the rule engine

```bash
npm install
npx tsx scripts/verify.ts   # 64 deterministic checks: phones, rules, tiers, mapping, import
```

## 📦 Backlog / next steps

- [ ] Align survey wizard field-by-field with Roki's official questionnaire (share the document)
- [ ] Swap in Roki's official logo artwork
- [ ] Supabase/PostgreSQL repository (`src/lib/db.ts` swap) + row-level security per role
- [ ] Real offline sync API (POST queued outbox ops instead of flushing locally)

---

*Built for Roki Fruit & Vegetables Ltd — premium modern meets rural simplicity.*
