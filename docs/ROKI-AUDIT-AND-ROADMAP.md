# Roki Fruit & Vegetables — Platform Audit & Launch Roadmap

**Version:** 1.0 · **Date:** 2026-08-03 · **Status:** Moving from demo → production (targeting 1,000+ users)

This document is the single source of truth for everything left before the platform is 100% launch-ready.
Every item has a priority (P0 = before launch, P1 = first month, P2 = backlog) and an acceptance check.
Tick items off as they are completed.

---

## ✅ 1. What is DONE (current build)

- [x] PWA (installable, offline-first, service worker, manifests, icons from official logo)
- [x] Full 15-section farmer registration questionnaire wizard (mirrors the official Roki PDF)
- [x] Farmer profiles, search, filters, survey record + production plan views
- [x] Harvest logging with unit conversion + instant rule-engine feedback
- [x] Rule engine (zero AI): yield ceiling → NEEDS_AUDIT · 24h duplicate guard → FLAGGED · incomplete profile · scale tiers · Roki Tier 1/2/3 scoring · yield scoring (Low/Expected/Bumper)
- [x] Bulk Excel/CSV upload: auto column mapping, staging grid, error highlighting, import report
- [x] Data grid: inline editing, sorting, filters, bulk delete/reassign, CSV/XLSX export
- [x] Production Forecast dashboard (crop × farmers × volume × harvest period)
- [x] Export Supply Planning dashboard (farmer-level supply lines, filters, export)
- [x] Farmer Dashboard (totals, refugee vs host, gender, location mapping, tier distribution)
- [x] Settings: rule toggles, per-crop thresholds (kg/acre), data management
- [x] Supabase client layer + auth (email/password + magic link), login page, auth gate
- [x] Offline outbox → cloud sync engine (mutations queue locally, push automatically)
- [x] Supabase schema + Row-Level Security SQL (`supabase/schema.sql`)
- [x] GitHub Action keep-alive (pings Supabase every 3 days) + nightly backup workflow
- [x] Daily backup script (`scripts/daily-backup.js`) → Excel workbook → Resend email
- [x] In-app Help & Guide page with clickable walkthrough, FAQs, glossary
- [x] Admin master backup button (header + Settings)
- [x] 73 automated rule-engine checks (phones, tiers, rules, mapping, import, survey integrity)
- [x] Polish pass v1.1: in-app Team & roles (no SQL), Account page with sign-out, standalone login page, Roki name in mobile header, roomier grid with responsive columns, settings card overflow fixed, em dashes removed
- [x] Polish pass v1.2: editable staging grid (inline fixes + dropdowns, visible drop messaging, remove-invalid), logs-page desktop overflow fixed, single-row header (email moved to Account), admin Delete-all-data with typed confirm
- [x] v1.4: role-change crash fixed (unlinked farmer accounts get a safe screen; no data leak for unlinked farmers), signup role picker (Field agent/Farmer; Admin gatekept), forgot-password + reset page, admin PDF summary report (migration_v3.sql)

---

## 🚨 2. P0 — REQUIRED BEFORE LAUNCH

### 2.1 Backend provisioning (manual, ~1 hour, done once)
- [ ] Create dedicated client Gmail (`rokifarmlogs@gmail.com` or similar) — never use personal accounts
- [ ] Create GitHub repo `roki-farm-platform` under that account
- [ ] Create Supabase project under the client account (region `eu-central-1` or nearest to East Africa)
- [ ] Apply `supabase/schema.sql` in the Supabase SQL Editor
- [ ] Sign up at Resend.com (free tier), verify sender domain or use `onboarding@resend.dev`
- [ ] Deploy to Vercel from the client GitHub repo (or drag & drop)
- [ ] Set env vars: Vercel → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Set GitHub secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `BACKUP_EMAIL_TO`, `BACKUP_EMAIL_FROM`
- [ ] Confirm keep-alive workflow runs (Actions tab → run manually once)
- [ ] Confirm nightly backup workflow runs and email arrives (run manually once)

### 2.2 Accounts & roles
- [x] In-app role management: Settings → Team & roles (Admin) — no SQL for new admins; first account on a fresh DB auto-becomes Admin (migration_v2.sql)
- [ ] Create field agent accounts and assign `FIELD_AGENT`
- [ ] Create farmer accounts (optional per farmer) and assign `FARMER` + `farmer_id` link
- [ ] Password reset flow tested (Supabase built-in email)

### 2.3 Security verification (bank-grade, per addendum)
- [ ] Confirm RLS is ON for all tables (`select relrowsecurity from pg_class …`)
- [ ] Verify an anonymous (logged-out) request gets 401/empty on `/rest/v1/farmers`
- [ ] Verify a FARMER account can only read/insert their own `farmer_id` logs
- [ ] Verify FIELD_AGENT can register farmers + insert logs but cannot delete farmers
- [ ] Verify ADMIN has full CRUD on all tables
- [ ] Confirm service_role key exists ONLY in GitHub secrets (never in the browser bundle)
- [ ] Confirm `NEXT_PUBLIC_` keys are only anon keys

### 2.4 Data migration (real farmers in)
- [ ] Prepare the current farmer list as Excel/CSV (columns: Farmer Name, Phone, District, Sub-County, …)
- [ ] Run a test bulk upload of 10 rows in a staging environment; fix errors; then run the full list
- [ ] Verify all imported phone numbers normalize to +256 and carriers detect correctly
- [ ] Spot-check 5 random profiles for survey completeness
- [ ] Decide: backfill questionnaire sections for existing farmers or re-survey in the field

### 2.5 Live end-to-end test (Deliverable 3 of the handover)
- [ ] Log a farmer on mobile (offline first, then sync)
- [ ] Upload a sample Excel sheet with 10 rows (with intentional errors to show the staging grid)
- [ ] Trigger a live CSV/Excel export to a laptop
- [ ] Confirm the automated daily backup email arrives in the admin inbox
- [ ] Confirm keep-alive prevents pause (wait 3+ days or run workflow manually)
- [ ] Test PWA install on one Android + one iPhone; test offline → online sync on both

### 2.6 Resilience & reliability
- [ ] Multi-device conflict test: edit the same farmer from two devices; confirm last-write-wins and no data loss
- [ ] Test what happens when outbox ops fail (offline push) — items must stay in "pending sync"
- [ ] Confirm app boots with zero network (fully cached shell)
- [ ] Confirm database row count matches exports (farmers + logs) after a week of use

---

## 🔒 3. P1 — FIRST MONTH AFTER LAUNCH

### 3.1 Data quality
- [ ] Deduplication review: phone-number matching report for possible duplicate farmers
- [ ] GPS capture: add "use my location" button to the survey (Section 1.6) for auto-filling coordinates
- [ ] Backfill `age_group` / `gender` for any imported rows missing them
- [ ] Set up naming convention guidance for enumerators (avoid typos: e.g. "Nakivale" vs "Nakivalli")

### 3.2 Monitoring & operations
- [ ] Add a cheap uptime monitor (UptimeRobot free tier) on `https://rokifarm.vercel.app`
- [ ] Add error tracking: Sentry free tier (or Vercel Observability) for frontend errors
- [ ] Supabase logs review habit: check auth logins + any RLS denials weekly
- [ ] Storage size watch: confirm 500 MB free tier headroom; set a monthly size check in the audit

### 3.3 Reporting polish (nice-to-haves from the questionnaire)
- [ ] "Enumerator performance" report (registrations per enumerator per week)
- [ ] Village-level aggregation on the Supply page (group by sub-county/village)
- [ ] Export supply lines to CSV grouped by harvest month (for logistics planning)
- [ ] Farmer payout/yield summary view (per PRD Module 2 farmer persona)

### 3.4 Performance for 1,000+ users
- [ ] Load test sanity: confirm Supabase free tier handles concurrent writes (throttle: 60 req/min per IP)
- [ ] If free tier limits bite: enable Supabase connection pooling / consider Pro tier (~$25/mo) — decision documented
- [ ] Confirm first-load JS stays under ~120 KB shared (currently 102 KB) — re-check after every feature

---

## 📋 4. P2 — BACKLOG (v1.1+)

- [ ] SMS/USSD integration for farmers without smartphones (Africa's Talking / Twilio)
- [ ] Multi-language UI (Luganda, Runyankole, Swahili, French for refugees)
- [ ] Photographs: farmer photo + farm photos stored in Supabase Storage
- [ ] Contract farming module: forward-purchase agreements with signatures (Section 11)
- [ ] Finance linkage: export "requires financing" farmer list for partner SACCOs/banks
- [ ] Offline-first IndexedDB upgrade if local storage grows beyond ~5 MB
- [ ] Role-based dashboards per account (currently role is demo-switchable)
- [ ] API rate limiting + Supabase auth policies review after first month of real traffic
- [ ] Accessibility audit (WCAG 2.1 AA): contrast, focus states, screen-reader labels

---

## 🧪 5. TESTING MATRIX (complete before launch day)

| Area | What to test | Pass when |
|---|---|---|
| Phones | Android Chrome + iOS Safari, installed PWA + browser | Install works, offline works, sync chip behaves |
| Tablets | iPad + Android tablet layout (nav, grids) | No broken columns, no overlapping cards |
| Desktop | Chrome, Edge, Firefox, Safari at 1280/1920 | Layouts clean; admin flows complete |
| Offline | Airplane mode: register farmer, log harvest, edit grid | All queue; "N pending sync" shows; sync on reconnect |
| Upload | CSV with headers (Name/Phone/Qty), XLSX with units (tonnes, ha), malformed rows | Auto-mapping right; errors highlighted; import summary correct |
| Rule engine | Yield ceiling breach, duplicate within 24h, incomplete profile, tier boundaries (1.5/2/10/3 acres) | Flags/statuses/tiers exactly as rules specify |
| Exports | CSV (Excel-open, BOM, +256 phones), XLSX (2 sheets), master backup | Opens clean; columns correct; numbers match DB |
| Auth | Sign up, sign in, magic link, sign out, role restrictions | RLS blocks unauthorized; role gates nav |
| Data safety | Delete farmer → logs cascade; edit log → tier recalculates | No orphans; scores update |
| Performance | Dashboard + grid load on mid-range Android | First load < 5 s on 3G; grid renders 1,000 rows without jank |

---

## 🚀 6. LAUNCH DAY & HANDOVER (the addendum's deliverables)

- [ ] **D1 — Live PWA link** (`https://rokifarm.vercel.app` or custom domain) + written install instructions for Android/iOS home screen
- [ ] **D2 — Master account passwords document** (Google, GitHub, Vercel, Supabase, Resend) stored safely (password manager), never in chat/email
- [ ] **D3 — Admin data control demo** (2.5 live test above) performed with Joan watching
- [ ] **D4 — 30-day support window** agreed in writing: bug fixes free; new features quoted separately
- [ ] Post-launch check-ins at day 1, 3, 7, 14, 30 (data volumes, errors, farmer complaints)

---

## 💰 7. THE $0 COST GUARANTEE — how it stays at $0

| Component | Free tier | Risk | Mitigation |
|---|---|---|---|
| Vercel | Hobby: unlimited static + serverless | Build limits (100/day) | Deploy from GitHub; avoid hot-fix spam |
| Supabase | 500 MB DB, 50k MAU, auto-pause after 7d idle | Auto-pause | `keep_alive.yml` every 3 days |
| GitHub | Unlimited public repos, free Actions minutes | 2,000 min/month | Backups are tiny; fine |
| Resend | 100 emails/day | 100/day cap | 1 backup email/day is nothing |
| Backup safety | No PITR on free tier | Data loss | Nightly Excel email (Workaround B) + weekly manual master backup |

**If anything threatens $0:** Supabase Pro (~$25/mo) is the single upgrade that fixes pause, PITR and rate limits — decide with Joan before spending.

---

## 📝 8. HOW TO RUN THE AUTOMATED CHECKS (before every release)

```bash
cd roki-farm-platform
npm ci
npm run build          # must compile + generate 16 static pages
node scripts/verify.ts # needs tsx: npx tsx scripts/verify.ts  (73 checks)
```

Every PR/release should pass all 73 checks + a manual pass of the Testing Matrix §5.

---

*Keep this document updated as features ship. Next review date: launch day + 30 days.*
