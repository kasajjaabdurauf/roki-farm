# Roki Fruit & Vegetables — Platform Audit & Launch Roadmap

**Version:** 2.15.1 · **Date:** 2026-08-04 · **Status:** Field-demo ready — fresh-start one-shot SQL, multi-admin, safe linking, crop/place search+export. Moving toward public launch.

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
- [x] v1.5: farmers can continue without linking (optional link, no roadblock), field-agent shared access code (no accounts needed; admin-managed), sign-out in Settings
- [x] v1.6: fixed "Continue as a farmer" crash (hooks ordering) + same bug class on farmer detail; security headers, config-error screen instead of demo fallback, agent code never shown in plaintext
- [x] v1.7: continue-as-farmer persists across refreshes; agent sessions survive refresh; error screens show real error + copy button + global error logger; version stamp in Settings/Account
- [x] v1.8: role-calibrated dashboards (farmers see only their own data + tips; staff see operations), My Farm gate removed (own account view), farmer account no longer lists other roles, demo artifacts removed
- [x] v1.9: farmer self-registration survey flow (/survey) with auto account-linking on completion; enumerator-only fields hidden in self mode
- [x] v1.9.1: awaited account linking (no silent failures), 15s live refresh on all devices while online, manual Refresh data button on staff dashboard, Farmers list newest-first with 20s auto-refresh
- [x] v2.0: farmer-only signup (no role picker; agents use the code), self-signups default FARMER, auto survey nudge on first sign-in, migration_v4 retro-fixes old FIELD_AGENT self-signups
- [x] v2.1: accounts ARE farmers (own ID + record at signup, email on record, no linking; migration_v5.sql; 'Link a farmer' removed; pending-survey badges; farmers update own record)
- [x] v2.2: upload↔account linking (match by ID → phone → email; email column support; signup claims existing record by email, migration_v6.sql; simulation email demo; manual §5.7b)
- [x] v2.3: mandatory onboarding survey (no skip), reliable survey→profile linking, phone-based record claiming during onboarding, survey mobile polish (full-width rows, spacing)
- [x] v2.4: fixed stuck "Setting up your farmer profile" gate (survey page no longer blocked), survey "More about your farm" extras step, farmer dashboard card cleanup, full factory reset SQL (accounts included)
- [x] v2.5: server-validated sessions on boot (deleted accounts are signed out automatically), no demo data seeding in production, storage key bumped
- [x] v2.6: real-world upload resilience (first/last name merge, multi-phone cells, phone spacing, acreage cleanup, COMPANY guard, recommended-format guide, no silent data loss) + 7 new parser tests (80 total)
- [x] v2.7: planting history capture (planting date, source of seed, status, GPS) from uploads; GPS on survey record; planting history table on farmer profile; STATUS→planting status resolution (88 checks total)
- [x] v2.8: dedup & merge tool (/duplicates), Sentry client monitoring + /api/health uptime endpoint, multi-language (en/lg/rn/sw) for farmer screens with Account switcher, SMS/USSD removed from all claims, 92 checks
- [x] v2.9: onboarding flicker fixed (splash while profile loads), resilient session validation (no surprise sign-outs), survey UX polish (step scroll-to-top, labelled row inputs, simplified consent), per-farmer Survey PDF download, docs reorganized (changelog + developer guide)
- [x] v2.10: agent link restored on sign-in, brute-force protection on access code, strict survey field validation, concurrency-safe IDs, 98 checks
- [x] v2.11: agent access code lives in the cloud (hashed in settings; shared across devices; migration_v7.sql) + v7b/c (settings row + anon read) + v8/v9/v10 (RLS write fixes for agents + farmers)
- [x] v2.12: agent & exec workspace — anon read for farmers/logs (v7d), agent banner, add-a-farmer straight to form (no account wall), anon farmer insert (v11)
- [x] v2.13: RLS insert unblock (emergency), stale sync-error cleanup, no more pending-sync pill for farmers
- [x] v2.14: signup password validation, admin role never leaks farmer view (bootstrap reconciles role + clears stale farmer link), agent straight-to-form
- [x] v2.15: ALL 135 districts + Kampala, safe upload linking (never merge into account-owned records), crop+place search with downloadable CSV list, upload tooltips, multi-admin clarity
- [x] v2.15.1: one-shot idempotent fresh_start.sql (wipe + schema + migrations v2→v11 + logs RLS-off), 101 checks
- [x] v3.0.0: two-group model — Admin + Field Agent only (migration_v12: first account=ADMIN, others=FIELD_AGENT; FARMER→FIELD_AGENT), signup→FIELD_AGENT, farmer role removed from nav/dashboards/auth-gate, "Request access" login, Farmer dashboard removed
- [x] v3.0.7: Farmer option removed from Team & roles dropdown; leftover FARMER roles treated as FIELD_AGENT; migration_v14 converts them
- [x] v3.1.0: **Agent performance page** (/agents): per-agent cards, farmer tables, per-agent CSV + full report download, "farmers without agent" warning; no-merge uploads (ID links only); expandable upload review; typeable sub-county; GPS button; crop+place filters + CSV download; GitHub Actions hardened (secret pre-checks)
- [x] v3.2.0: **agent names actually recorded** — root-cause fix (createFarmer/updateFarmer dropped `loggedBy`), one-time name capture in the Agent banner ("Working as …" + change), admin "Who is using this device?" prompt, survey writes enumerator=agent, uploads credit an agent (device stamp + optional Agent Name column), CSV "Registered By (Agent)" column, farmer cards/detail/PDF show the agent, inline admin "Registered by" editor on every farmer profile, edit-survey preserves credit, migration_v15.sql recovery script, 114 checks
- [x] v3.3.0: **agent name unmissable & mandatory** — dashboard prompt cards removed; survey Step 1 opens with a mandatory amber "WHO IS REGISTERING THIS FARMER?" box (blocks completion; "none" accepted as visible "None" group); uploads require the credit box (or an Agent Name column) before Import unlocks; banner simplified to "Working as …"; nightly workflow secret-check bug fixed (`secrets[s]` loop → explicit checks); keep-alive workflow hardened (env-based secrets, URL validation); 121 checks
- [x] v3.4.0: **sync health + exact timestamps** — Settings shows device-vs-cloud counts with drift detection; admin "Resync device from cloud" tool (typed confirm, refuses while unsynced changes exist, never touches the cloud — the cure for the 113-vs-95 laptop ghost records caused by the 06 Aug cloud reset); exact registration date+time on farmer profiles, Farmers CSV, per-agent CSV, master backup + survey PDF ("Registered At (exact)" `YYYY-MM-DD HH:MM` local); master backup gained "Registered By (Agent)"; 123 checks
- [x] v3.4.1: **Data Check page** (`/datacheck`, admin) — one-button full audit: device-vs-cloud drift + resync, farmers without agent (clickable), duplicate phones/names, possible agent-as-farmer, company-like names, unsynced counter; read-only, each finding links to its fix tool; big "Validate data" button on the dashboard. Real-data findings (Aug 8, 116 farmers): 92 with agent / 24 without, 4 safe duplicate pairs, 24 farmers sharing one phone (+256763900986, agent's own number — do not auto-merge), ~8–10 team members registered as farmers (admin's suspicion confirmed), 1 company record. Nothing changed — reporting only.
- 📋 **Data-quality backlog (from the Aug 8 real-data audit, pending admin decisions):** (1) assign agents to the 24 uncredited farmers; (2) merge the 4 duplicate pairs in /duplicates; (3) decide on the ~8–10 agent-as-farmer records (keep or remove — the samuelombeni073/samuel ombeni pair is still pending the identity check); (4) confirm whether AMSTUS AGRO PROCESSING & EXPORTS LTD belongs in the farmer list; (5) decide how to handle the 24 farmers sharing +256763900986 (verify with agent "samuel" — likely his own phone entered for everyone).
- ⚠️ **Incident log — cloud reset 2026-08-06:** the cloud database was reset to a clean slate on 06 Aug (all accounts + farmers wiped; 6 farmers re-registered that day). Devices that had older local copies kept them (by design), which caused device-vs-cloud count differences. Any pre-reset data beyond the nightly backups is unrecoverable.
- 🔍 **FULL DIAGNOSIS — the "117 vs 99" mystery (2026-08-08, closed with hard evidence):**
  - **The cloud is the truth: 99 farmers** (incognito backup CSV `jfl-backup-farmers-backup-20260808 (1).csv` = 99 rows; incognito summary PDF = 99 farmers, 98 in Isingiro + 1).
  - **The laptop/normal session shows 117** (backup CSV = 117 rows; website summary PDF = 117 farmers; districts include MPIGI, KALUNGU, LUWERO, WAKISO, GOMBA, BUTAMBALA, BUTAMABALA, BUIKWE, BUGWERI, MUKONO).
  - **The 18-record difference = the 2024-list bulk import.** All 18 laptop-only farmers (RFV-UG-00009…00026: JOSEPH MAYANJA, JOHNBOSCO KAMUGISHA, RCHARD LUYIMA, BAKER MABIRIZI, TAAKYA NAMBALIRWA, EPHRAIM KASEGA, EDDY KAIJA, IDDI SSALLI, AISHA NAKYAGABA, DENIS NSUBUGA, DOUGLAS SSENTONGO, MATIA MUGEJA, AMSTUS AGRO PROCESSING & EXPORTS LTD, MUHAMMAD MUZAALE, HAKIM MAWEJJE, CHARLES LUYINDA, DENIS MUGALULA, NOAH MUTIMBA) carry the **exact same timestamp "4 Aug 22:26"** (a single bulk import), every name is found in the **ROKI FARMERS LIST 2024** PDF, and every district matches the 2024 list. They were wiped from the cloud by the 06 Aug reset but survived in the laptop's local storage.
  - **Conclusion:** no data corruption, no duplicated registrations from agents — just 18 historical 2024-list records that live on the laptop only. Safe copy saved: `ghost-farmers-2024-list-18.csv`.
  - **Decision pending (admin):** (A) re-import the 18 into the cloud so everyone sees 117 (recommended if the 2024 farmers are still active/suppliers), (B) keep the cloud at 99 and resync the laptop (the 18 stay in the backup + 2024 PDF only), or (C) review each of the 18 first (some may be companies/outdated contacts). Until decided, do NOT resync the laptop (that would hide the 18 from the local view; they'd remain only in the CSV backups).
  - ✅ **DECIDED 2026-08-08 — 18 bulk-import records ARCHIVED, cloud stays at 99.** The 18 are not needed in the live database (the team works with farmers registered by agents since the reset). They are preserved in `roki-backups/2024-bulk-import-18-farmers-ARCHIVED.csv` (with a README explaining provenance + how to restore via Bulk Upload). The laptop was resynced (or site data cleared) so all devices now show the live 99.
  - **Why the laptop kept them (root cause of the retention):** `refreshFromRemote` merged — it never replaced. Deletes done directly in the cloud (the 6 Aug reset) send no "delete these IDs" message to devices; a device only ever sees "here are the current rows", and local-only rows were preserved by design (so offline registrations can't be wiped). Hence the laptop "never knew" the 18 were deleted.
  - ✅ **FIXED AUTOMATICALLY FROM v3.5.0:** `refreshFromRemote` now adopts the cloud's exact list whenever the outbox is empty (i.e. after every successful sync) — the auto-heal. Any record on a device that isn't in the cloud was deleted externally and now disappears on the next sync, on every device, with zero user action. Offline work remains safe because a pull is skipped whenever anything is pending. The manual Resync button remains as a fallback, and the one-tap "Update now" banner ships updates to agents anywhere.



---

## 🔐 ROLES & ADMIN — how it works now (v3.2)

### The two roles (confirmed product direction)
| Role | What they see/do |
|---|---|
| **Admin** | Everything: dashboard, all farmers/logs, settings, Team & roles, agents performance, duplicates, master backup, PDF reports, crop/place search+download |
| **Field Agent** | Sees the operations dashboard (read), registers farmers straight from the form, logs harvests. No settings, no code change, no delete. Two ways in: **access code** (no account) or an **account** with role FIELD_AGENT |

**Farmers do NOT use the app.** Farmers are onboarded by agents/admins; a farmer never signs up on their own. All farmer-role remnants were removed (migrations v12–v14 convert any leftover FARMER accounts to FIELD_AGENT; the app treats FARMER as FIELD_AGENT defensively).

### How admin access works (multi-admin, no secret slots)
- **There is no limit** on admins — 1, 5, 10, 20, whatever the team needs.
- **Becoming an admin:** request access (an account is created as FIELD_AGENT), then an existing admin changes the role to ADMIN in **Settings → Team & roles**. That's it. The role is applied to that person's account; they see the admin workspace on their next sign-in.
- **The first account** on a fresh database automatically becomes Admin (so setup never dead-ends).
- **No self-serve admin:** a regular signup can never make itself admin; only an existing admin can grant it (RLS enforces this server-side).
- **Protection:** Settings, Team & roles, Duplicates, agents performance, access-code change, and delete actions are admin-only. RLS backs all of it.

### Field agents — the access code
- One shared code (admin-managed, stored **hashed** in the cloud so it works on every device).
- Rate-limited: 5 wrong attempts / 10 min per device.
- Agents enter it on the login screen ("Are you a field agent?" link), get the agent view + **Add a farmer** (straight to the survey form, no account linking), and can log harvests.
- **Name capture (v3.2):** the green Agent workspace banner asks "What's your name?" once; the name is stamped on every farmer the agent registers (`logged_by`), shown on farmer cards/detail/PDF/CSV, and feeds the **Agent performance** page.

### Safe linking (the "35 became 30" fix)
- Uploads **never** merge into an existing farmer record unless the row explicitly carries that farmer's **ID**. Phone/email matches warn but still create a NEW record — a file always yields ALL its people.
- Match order (for linking only): Farmer ID → (warning) phone/email. Warnings explain every decision.

---

## 🚨 2. P0 — REQUIRED BEFORE LAUNCH

### 2.1 Backend provisioning (manual, ~1 hour, done once)
- [x] Create dedicated client Gmail — done (the account that owns GitHub/Supabase/Resend)
- [x] Create GitHub repo `roki-farm-platform` — done
- [x] Create Supabase project under the client account — done (note: keep the URL + anon key matching Vercel env)
- [x] Apply the schema — **use `supabase/fresh_start.sql`** (wipe + schema + migrations v2→v11 + logs RLS-off) in ONE paste. This is the current recommended path.
- [ ] Sign up at Resend.com (free tier), verify sender domain or use `onboarding@resend.dev`
- [ ] Deploy to Vercel from the client GitHub repo (or drag & drop)
- [ ] Set env vars: Vercel → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Set GitHub secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `BACKUP_EMAIL_TO`, `BACKUP_EMAIL_FROM`
- [ ] Confirm keep-alive workflow runs (Actions tab → run manually once)
- [ ] Confirm nightly backup workflow runs and email arrives (run manually once)

### 2.2 Accounts & roles (multi-admin, no secret slots)
- [x] In-app role management: Settings → Team & roles — no SQL. Admins can be 1, 5, 10, 20 — no limit. First account on a fresh DB auto-becomes Admin.
- [x] Admin cannot be self-served: only an existing admin grants ADMIN (RLS enforces).
- [x] Field agents: shared access code (hashed in cloud) OR account with FIELD_AGENT role
- [x] Farmers: signup is farmer-only; every account gets its own farmer record (accounts ARE farmers)
- [x] Password reset flow (forgot-password link + reset page)
- [ ] (Optional) Create extra admin accounts from Settings → Team & roles to match the team size

### 2.3 Security verification
- [x] RLS enabled on all tables (schema.sql) — **except `produce_logs` which is intentionally disabled for the field demo** (so agents/farmers can log harvests reliably). Re-enable with a tested policy set before public launch (see P1).
- [x] Anonymous (access-code agents) can READ farmers/logs + INSERT farmers/logs (v7d, v8, v11); cannot update/delete
- [x] ADMIN has full CRUD; FIELD_AGENT can register + log but not delete farmers
- [x] service_role key exists ONLY in GitHub secrets (never in browser bundle); NEXT_PUBLIC_ are anon keys only
- [ ] (Before public launch) Re-enable RLS on produce_logs with the tested policy set and re-verify the above


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
- [x] Dedup & merge tool built (/duplicates) — run it monthly or after every big upload
- [x] GPS capture from uploads (GPS-LATITUDE/LONGITUDE columns → survey record)
- [ ] GPS "use my location" button in the survey (Section 1.6) for auto-filling coordinates (nice-to-have)
- [ ] Backfill `age_group` / `gender` for any imported rows missing them
- [ ] Set up naming convention guidance for enumerators (avoid typos: e.g. "Nakivale" vs "Nakivalli")

### 3.2 Monitoring & operations
- [x] Health endpoint built: `https://<app>/api/health` returns 200 JSON
- [ ] **UptimeRobot (free, 5 min):** sign up → Add New Monitor → HTTP(s) → URL `https://<app>/api/health` → interval 5 min → create. Add the alert contact email (the client Gmail).
- [ ] **Sentry (free tier):** sign up → create project → copy the DSN → add `NEXT_PUBLIC_SENTRY_DSN` in Vercel env vars (Production) → redeploy. Errors now auto-report from the browser.
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
| Auth | Sign up, sign in, magic link, sign out, role restrictions, multi-admin | Role gates nav; admin-only sections hidden; RLS (with produce_logs relaxed for the field demo) |
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
