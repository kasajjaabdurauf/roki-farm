# Roki Fruit & Vegetables — Platform User Manual

**Version:** 1.0 · **Last updated:** 2026-08-03
**For:** Joan (Admin) · Field Agents · Farmers · Anyone touching the platform

> This manual explains **everything** the platform does, screen by screen, feature by feature, and how to do every task. It is meant to be read cover-to-cover once (like the IKEA instructions), then used as a reference. It will be updated every time the app changes.

---

## Table of contents

1. [What is this platform?](#1-what-is-this-platform)
2. [Before you start](#2-before-you-start)
3. [Accounts, roles & sign-in](#3-accounts-roles--sign-in)
4. [The app shell — header, navigation, status chips](#4-the-app-shell)
5. [Screen-by-screen guide](#5-screen-by-screen-guide)
6. [The farmer registration survey (all 15 sections)](#6-the-farmer-registration-survey)
7. [The rule engine & farmer scoring](#7-the-rule-engine--farmer-scoring)
8. [Offline mode & syncing](#8-offline-mode--syncing)
9. [Exports & backups](#9-exports--backups)
10. [Daily workflows by role](#10-daily-workflows-by-role)
11. [Frequently asked questions](#11-frequently-asked-questions)
12. [Troubleshooting](#12-troubleshooting)
13. [Glossary](#13-glossary)
14. [Data, privacy & security](#14-data-privacy--security)
15. [Version log](#15-version-log)

---

## 1. What is this platform?

Roki Fruit & Vegetables' digital farm platform does four jobs:

1. **Collect** — a full farmer registration questionnaire (15 sections: identity, refugee status, farming experience, land, crops, capacity, inputs, markets, contract interest, finance, climate, consent).
2. **Forecast** — from every farmer's production plan, it knows **who is growing what, how much, and when** it will be ready.
3. **Plan supply** — for export: which farmers, which crops, where they are, expected volumes and harvest windows.
4. **Score** — every farmer gets a Roki Tier (1 = export-ready, 2 = developing commercial, 3 = new/needs support) computed from objective, explainable rules.

**Important:** there is no AI anywhere in this system. Every flag, score and summary comes from fixed rules. When the system flags something, it tells you exactly which rule fired.

**Where does the data live?** In the cloud (Supabase PostgreSQL) with a copy on each device so field agents can work offline. Backups are emailed to the admin every night automatically.

---

## 2. Before you start

### 2.1 Devices
| Device | Best for | Notes |
|---|---|---|
| Smartphone | Farmers, field agents in the field | Install as an app (see 2.3); works offline |
| Tablet | Field agents doing surveys | Same app, bigger screen |
| Laptop/desktop | Admin: bulk uploads, data grid, exports, settings | Full sidebar navigation |

### 2.2 Internet
- **Online:** everything syncs live.
- **Offline:** the app still works. Entries are saved on the device and pushed to the cloud when you're back online (see §8).

### 2.3 Install the app on your phone (PWA)
**Android (Chrome):**
1. Open the app link in Chrome.
2. Tap the ⋮ menu (top-right) → **Add to Home screen** → Add.
3. Launch from the home screen — it opens full-screen like an app.

**iPhone (Safari):**
1. Open the app link in Safari.
2. Tap the **Share** button → **Add to Home Screen** → Add.
3. Launch from the home screen.

The installed app works offline. (Note: the home-screen icon can lag behind an update; if the icon looks old, delete and re-add it once.)

---

## 3. Accounts, roles & sign-in

### 3.1 Roles
| Role | What they can do |
|---|---|
| **Admin (Joan)** | Everything: surveys, all data, bulk upload, data grid, settings, backups, exports, forecast/supply views |
| **Field Agent** | Register farmers (full survey), log harvests, bulk upload, view farmers/logs/forecast/supply. Cannot delete farmers or change settings |
| **Farmer** | Their own profile ("My Farm"), logging their own harvests, viewing their summaries. Sees only their own data |

### 3.2 Field agents: shared access code (no account needed)
Field agents don't need accounts. On the sign-in screen, the **"Field agent? Use the access code"** card is always available: enter the shared code (given by the administrator) and continue as a field agent. The code is remembered on that device. Administrators can change it anytime in Settings → Field-agent access code (the old code stops working immediately).

### 3.3 Signing in
1. Open the app. If the platform is in **production mode** you'll land on the sign-in screen.
2. Enter your email + password → **Sign in**.
3. Prefer no password? Enter your email and press **Send magic link** — a link arrives in your inbox; tap it to sign in.
4. **Forgot your password?** Tap **Forgot password?** under the password field → enter your email → **Send link** → open the email and choose a new password on the recovery page.
5. **Sign out** whenever you like: **Settings → Sign out** (bottom of the Data management section).

### 3.3 Creating an account (for team members)
1. On the sign-in screen, switch to **Create account**.
2. Enter the person's email + a password.
3. **Choose what describes you**: **Field agent** (works with Roki) or **Farmer** (grows produce). This choice becomes the account role until an admin changes it. **Admin can never be self-selected** — only an existing administrator can grant Admin in Settings → Team & roles (the very first account on a fresh database becomes Admin automatically).
4. They confirm their email from the inbox, then sign in.
5. **Linking is optional, not a roadblock**: an administrator can link the account to a farmer profile (Settings → Team & roles → **Linked farmer**) so the farmer sees their own profile and harvests. Until then, the farmer can still **Continue as a farmer** and log produce from the harvest logs page.

### 3.4 Demo mode
If the platform is running without a backend (demonstrations), there is no sign-in: use the **role switcher** in the header to flip between Admin / Field Agent / Farmer and explore with sample data. Sample data can be reset in **Settings → Reset demo data**.

### 3.5 Signing out
Open **Account** (sidebar / More menu) → **Sign out**. (The header just shows who you are; sign-out lives in Account.)

---

## 4. The app shell

### 4.1 Header (top)
- **Logo + app name** (left) — official Roki logo.
- **Page title** (desktop only).
- **Sync chip** — shows connectivity:
  - 🟢 **All synced** — everything is in the cloud.
  - 🟠 **N pending sync** — N changes waiting to upload (tap to sync now).
  - 🔴 **Offline** — you have no connection; work continues, changes queue.
- **Role switcher** (demo mode only) — Admin / Field Agent / Farmer.
- **Your email + sign out** (production mode).
- **Settings gear** (mobile, admins) and **Master backup** button (desktop, admins).

### 4.2 Navigation
- **Desktop:** sidebar on the left with all sections.
- **Mobile/tablet:** bottom tab bar with the 4 most important sections + **More** button that opens the rest in a sheet.
- **Help & Guide** is available to everyone from the sidebar / More sheet.

### 4.3 Cards, buttons, badges — what they mean
- **Cards** = white rounded panels; each contains one topic.
- **Status badges**: 🟢 **Verified** · 🟠 **Needs Audit** · 🔴 **Flagged** · 🏷️ **Tier 1/2/3** · 🌱 Micro/Mid-Scale/Large-Scale.
- Buttons are at least 48px tall so they're easy to tap in the field.

---

## 5. Screen-by-screen guide

### 5.1 Farmer Dashboard (`/`)
The home screen for everyone (different content per role).

**Admin/agent view:**
- **KPI cards:** Registered farmers · Refugee vs host · Women farmers · Export-ready (Tier 1).
- **Gender distribution** — bar + split.
- **Location mapping** — top districts by farmer count with bars.
- **Farmer scoring system** — three tier cards with counts.
- **Rule engine findings** — the list of everything needing attention (anomalies, duplicates, incomplete profiles). Tap any item to jump to it.
- **Recent harvests** — latest logs (cards on mobile, table on desktop).

**Farmer view:** "Karibu, [name] 🌱" + their own stats, tier, and recent harvests.

### 5.2 Farmer Profiles (`/farmers`)
- **Search box** — searches name, phone, district, village, village, and farmer ID instantly.
- **Filters** — Roki tier (1/2/3), Needs-attention toggle.
- Cards show: initials avatar, name, ID, tier badge, gender/community badges, farm size, crops, harvest count, plan count.
- **New Survey** button (top-right) starts the registration questionnaire.

### 5.3 Farmer profile detail (`/farmers/RFV-UG-XXXXX`)
- Header: name, ID, tier badges, location, actions (**Log Harvest**, **Edit** survey, **Delete**).
- Facts: phone, acreage, irrigation, crops.
- Stats: total harvested, harvest logs, avg per acre, top crop.
- **Survey record** card: gender, community, age, household, land ownership, irrigation, enumerator, scoring criteria, assessment.
- **Production plan** table: crop × acres × expected volume × harvest window.
- Rule findings for this farmer (if any).
- **Harvest history** — all their logs (table on desktop, cards on mobile).

### 5.4 Harvest Logs (`/logs`)
**Left (or top on mobile): New produce entry**
1. Select farmer (dropdown).
2. Crop type (Tomato, Onion, …).
3. Quantity + unit (**kg, bags (100 kg), crates (20 kg), tonnes**) — converts automatically.
4. Quality grade: **A / B / Reject**.
5. Harvest date, optional batch ID and storage/delivery location.
6. **Save & run rule checks** — the response box immediately tells you: ✓ verified, or the exact rule that fired (e.g. "Yield 9.0 t exceeds expected ceiling…").

**Right: History** with filters: search, status, crop, district, date range (mobile: filters collapse behind a **Filters** button). View toggle: table ⇄ cards.
Status chips let you jump to All / Verified / Needs Audit / Flagged counts.

### 5.5 Production Forecast (`/forecast`)
A table per crop: **Farmers producing · Export-ready count · Expected volume (t) · Harvest period** — sorted by volume. Top stats: farmers with plans, crops planned, total expected tonnes, forecast horizon. Export CSV / Excel. The "How this is calculated" card explains the method (survey production plans × expected yield).

### 5.6 Export Supply Planning (`/supply`)
Farmer-by-farmer supply lines: **Farmer (link to profile) · Tier · Location · Community · Crop · Acres · Volume · Harvest window.**
Filters: search, crop, district, tier. Shows total expected tonnes for the current filter. Export CSV / Excel. The planning checklist card explains how to use it (Tier 1 shortlist, route planning by window).

### 5.7 Bulk Upload & Mapping (`/upload`)
1. **Drag & drop** a `.xlsx`, `.xls` or `.csv` file (or tap to browse). Download the **sample file** to see the expected shape.
2. **Column mapping** — the engine auto-detects columns from headers ("Tel"/"Phone"/"Contact" → phone; "Qty (Kg)" → quantity; "Area (Ha)" → acres auto-converted). Override any column with its dropdown.
3. **Staging grid** — every row previewed. Red rows have errors (bad phone, negative quantity, unreadable date, produce row without a farmer). **Fix them right in the grid**: tap any cell and type the correct value (dropdowns appear for grade, gender and refugee status) and the row re-validates instantly. Expand a row to see the exact errors/warnings and whether it links to an existing farmer (by ID or phone) or creates a new profile.
4. **Rows that still have errors are NOT imported** — the red banner above the grid says exactly how many will be dropped, and you can press **Remove invalid rows** to discard them first. Then **Import** — a report lists every row's result (created / linked / fixed / skipped).
5. All imported logs pass through the rule engine immediately.

### 5.8 Data Grid & Export (`/grid`)
Two tabs: **Farmers** and **Produce Logs**.
- **Inline editing:** click any cell to edit (text, number, dropdown). The rule engine re-checks the record on save (e.g. raise a quantity → tier/status recompute).
- **Sorting:** click column headers.
- **Filtering:** the search box filters all columns.
- **Bulk actions:** tick rows → **Reassign** (move logs to another farmer) or **Delete**.
- **Pagination:** 25/50/100/250 rows per page.
- **Export:** CSV or Excel of exactly what's filtered — clean headers, clean +256 phone formatting, computed columns included.
- Mobile: swipe sideways to see all columns (hint shown).

### 5.9 Settings (`/settings`) — admin only
- **Rule engine switches** — turn each rule on/off:
  - Unusual yield alert (yield > acreage × max/acre → Needs Audit)
  - Duplicate guard (same farmer+crop+date within 24 h → Flagged)
  - Incomplete profile flag
  - Harvest yield scoring (Low/Expected/Bumper)
- **Per-crop thresholds** — edit kg-per-acre **max** (anomaly ceiling) and **typical** (yield baseline) for every crop. Changes re-run the engine over existing logs instantly.
- **Data management:**
  - Data source card: demo vs production + **Sync now**.
  - Farmers CSV / Excel export, **Master backup (.xlsx)** (farmers + logs in one workbook).
  - **Reset demo data** (demo mode only).
- **PWA hint** — install instructions.

### 5.10 Help & Guide (`/help`)
The in-app manual: quick-start cards, "Explore the app" tiles (tap to jump), step-by-step tasks, **FAQ filtered by audience** (Admin / Field agent / Farmer / Everyone), and a glossary. Point farmers here before calling for support.

### 5.11 My Farm (`/farm`) — farmer persona
The farmer's own profile: name, tier, location, facts, stats (total harvested, logs, per-acre average, payout-ready entries), and their harvest history.

---

## 6. The farmer registration survey

Nine steps = the 15 official questionnaire sections. Every step is validated; you can't advance with errors.

| Step | Sections | What's asked |
|---|---|---|
| 1 | §1 Identification & bio-data | Enumerator name/ID (auto-suggested), full name, gender, age in years, NIN (optional), primary + alternative phone (MTN/Airtel validated), district, sub-county, **parish**, village, GPS coordinates (optional) |
| 2 | §2 Refugee & host community status | Refugee or host? If refugee: country of origin, year arrived, settlement, refugee household number. Adults/children. Vulnerability: female-headed, youth (18–35), disability, elderly |
| 3 | §3 Farming experience & history | Years farming, farming types (multi), crops produced before (years + avg area), sold commercially before? Where? |
| 4 | §4 Land & farm assets | Land access, ownership (own/family/rented/allocated/other), total acreage, land under cultivation, expansion land available |
| 5 | §5–6 Current activities & capacity | Current crops table (area, expected harvest date, expected qty), production season, production system, current capacity, future capacity after support, production limits (multi) |
| 6 | §7–8 Inputs & technology | Input sources, improved seed?, extension support (from whom?), irrigation (type), records kept?, willing to adopt digital records? |
| 7 | §9–10 Market & Roki interest | Who they sell to, average price (UGX/kg), selling challenges, **want to supply Roki?**, which crops, and the **expected production plan for Roki** (crop × acres × harvest period × expected quantity) — this feeds the Forecast |
| 8 | §11–13 Contract, finance, climate | Roki specs? export standards? forward purchasing? finance accessed (source)? need financing? climate challenges? climate-smart practices? |
| 9 | §14–15 Consent & review | Digital consent + date, enumerator assessment (land availability, production potential, recommended category), full review of everything, then **Complete registration** |

On completion:
- System ID `RFV-UG-XXXXX` is assigned,
- the farmer appears in all dashboards immediately,
- the rule engine tags their scale tier and Roki tier.

**Editing:** open the farmer → **Edit** → the same wizard opens pre-filled; changes re-run the engine and re-sync.

---

## 7. The rule engine & farmer scoring

All rules are deterministic and shown on the records they affect.

| Rule | Trigger | Result |
|---|---|---|
| Unusual yield alert | `quantity_kg > acreage × max_per_acre` (per-crop threshold) | Status **NEEDS AUDIT** + note with the ceiling calculation |
| Duplicate guard | same farmer + crop + harvest date logged within 24 h | Status **FLAGGED** + note naming the other log |
| Incomplete profile | missing phone, district or sub-county | **Attention** badge on the profile |
| Scale tier | < 2 ac → Micro · 2–10 ac → Mid-Scale · > 10 ac → Large-Scale | Tag on the profile |
| Roki tier | T1: ≥3 ac, ≥6 logs, Grade-A verified in 180 days · T2: ≥1.5 ac, ≥3 logs · T3: rest | Score recalculated after every harvest change |
| Yield score | per-acre yield vs crop baseline (median of history, fallback to per-crop typical): <50% → Low, >150% → Bumper, else Expected | Badge on each log |

**Tuning:** Admins adjust thresholds in Settings → Per-crop thresholds; toggles in Settings → Rule engine switches. Edits re-evaluate existing records instantly.

---

## 8. Offline mode & syncing

1. The app keeps a copy of the database on your device.
2. Every change (new farmer, harvest log, edit, delete) is written locally first — the UI never waits for the internet.
3. Changes are queued in the **outbox**. The sync chip shows the count: "3 pending sync".
4. When you reconnect, the queue pushes automatically. Tap the chip to force it.
5. Failed pushes stay queued and retry — nothing is lost silently.
6. On sign-in, the app pulls the latest cloud state to your device.

**Field tip:** do surveys in airplane mode if the network is flaky; sync when you reach the road. The app was built for exactly this.

---

## 9. Exports & backups

| Where | What you get |
|---|---|
| Forecast page | Crop-level forecast CSV/Excel |
| Supply page | Filtered farmer supply lines CSV/Excel |
| Data Grid | Farmers or Logs CSV/Excel of the current filter |
| Settings → Data management | Farmers CSV/Excel, **Master backup .xlsx** (both sheets) |
| Admin header (desktop) | Same master backup |
| Nightly automation | Full database emailed to the admin inbox every night (backup_YYYY_MM_DD.xlsx) |

All exports use clean headers and +256 phone formatting; CSV files open correctly in Excel (UTF-8 BOM).

---

## 10. Daily workflows by role

### Field agent — field day
1. Open the app (offline is fine).
2. **New Survey** for each farmer; complete all 9 steps; get consent.
3. Log any harvests you witness (**Harvest Logs → New produce entry**).
4. At the end of the day (or when signal returns): check the sync chip → **All synced**.
5. Weekly: review your farmers on the Profiles list; flag incomplete profiles to the admin.

### Admin — weekly
1. Dashboard: check **Rule engine findings** — clear Needs Audit / Flagged items by verifying and editing.
2. Forecast/Supply: review volumes vs targets; export supply lines for the week.
3. Settings: confirm rules/thresholds still match the season; download a **Master backup** at least weekly.
4. Inbox: confirm the nightly backup email arrived; if missing, run the backup workflow manually from GitHub.
5. Monthly: run the audit checklist (§5 of the audit doc) and review data quality.

### Farmer
1. Open the app → **Log Harvest** whenever you harvest.
2. Check **My Farm** for your totals and tier.
3. If Roki staff ask you to confirm a survey, review your profile and tell them about anything that changed (new crops, new land).

---

## 11. Frequently asked questions

*(Short version — the full FAQ with more answers is in the app: Help & Guide → FAQ.)*

**Q: Is this AI?** No — all rules are fixed and explainable.

**Q: What does "Needs Audit" mean on my log?** The quantity looks above the expected ceiling for that crop/farm size. An admin reviews it; often it's a typo or a mis-entered unit.

**Q: I made a mistake in the survey / log — can I fix it?** Yes: profiles → Edit; logs → edit icon in the grid or logs page. Rule checks re-run.

**Q: I'm offline — is my data safe?** Yes; it queues locally and syncs automatically.

**Q: Can a farmer see other farmers?** No — row-level security; farmers see only their own records.

**Q: How are backups made?** Nightly automated email (Excel) + manual master backup anytime + cloud database.

**Q: Which crops does Roki focus on?** Tomato, Onion, Cabbage, Carrots, Watermelon, Eggplant, Passion Fruit, Chilli Pepper, plus cereals/legumes from the survey.

---

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| App shows an old version | Fully close the app (swipe from app switcher) and reopen; it updates automatically. Re-add the home-screen icon if it looks stale |
| "Application error" screen | Usually stale cached files from an older version: fully close and reopen the app (or hard-refresh the browser with Ctrl/Cmd+Shift+R). If it persists, check the browser console (right-click → Inspect → Console) and send the red error text to support; the most common cause is a Supabase URL/key with stray spaces or quotes in the Vercel environment variables |
| "N pending sync" never clears | Check internet; tap the chip to retry; if it persists for days, tell the admin (server-side logs will show the failure) |
| Home-screen icon wrong/old | iOS: delete + re-add from Safari's Share → Add to Home Screen |
| Can't sign in | Check the confirmation email; try the magic link; ask Joan to confirm your account exists |
| Grid looks different on phone | Swipe sideways — tables are horizontally scrollable; key info is in the first columns |
| Accidentally deleted a farmer | Contact the admin within 30 days — the nightly backup can restore data (as an Excel import) |
| I imported a test file and want to start clean | Admin: Settings → Data management → **Delete all data…** (type DELETE to confirm). This clears the local store and the cloud, then syncs |
| App feels slow | Refresh once; ensure the app is updated; on very old phones, close other apps |
| Demo data messed up | Settings → Reset demo data (demo mode only) |

---

## 13. Glossary

| Term | Meaning |
|---|---|
| RFV-UG-XXXXX | Farmer system ID — auto-generated, unique |
| Roki Tier 1/2/3 | Export-readiness: 1 = export-ready, 2 = developing commercial, 3 = new/needs support |
| Scale tier | Farm size: Micro <2 ac · Mid-Scale 2–10 ac · Large-Scale >10 ac |
| Verified / Needs Audit / Flagged | Rule-engine log statuses: clean / above ceiling / possible duplicate |
| Grade A / B / Reject | Quality at harvest (Grade A drives export scoring) |
| Outbox | The device queue of changes waiting to sync |
| Production plan | Farmer's planned crops for Roki: acres, volume, harvest months |
| Enumerator | The field officer completing the survey |
| Parish | Administrative level below sub-county (Uganda) |
| RLS | Row-level security — who may see which rows in the database |
| Keep-alive | The automation that pings the database so the free tier never pauses |
| Magic link | Passwordless sign-in emailed to you |
| PWA | Progressive Web App — installable, offline-capable |

---

## 14. Data, privacy & security

- **Consent:** every farmer's registration includes Section 14 consent (dated) stored with their record.
- **Access control:** row-level security (RLS) — public users see nothing; farmers see only themselves; agents see the field data they need; only admins can delete.
- **Where data lives:** Supabase PostgreSQL (EU region recommended), with encrypted transport (HTTPS) everywhere.
- **Backups:** nightly email + manual exports. The $0 stack includes keep-alive automation so the free database never pauses.
- **Retention:** no automatic deletion is performed; Joan controls the data. Deletions are permanent (nightly backups are the safety net).

---

## 15. Version log

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-08-03 | Production-ready build: Supabase backend + auth + RLS, sync engine, keep-alive + nightly backup automation, in-app Help & Guide, master backup, full audit + this manual |
| 1.1 | 2026-08-03 | Polish pass: role management in-app (Settings → Team & roles, no SQL), new Account page with sign-out, login page standalone (no nav), role switcher moved to Account (demo mode), Roki name in mobile header, roomier data grid with responsive columns, settings cards fixed on phones, em dashes replaced with commas |
| 1.2 | 2026-08-03 | Upload staging is now editable (fix errors inline with tap-to-edit cells and dropdowns; rows with errors are visibly excluded with a Remove-invalid option). Harvest logs page fixed on desktop (filters wrap, tables show a right-edge fade when they continue). Header reduced to one clean row (logo + sync + settings; email lives in Account only). Admins can wipe all data from Settings (typed DELETE confirmation). |
| 1.3 | 2026-08-03 | Stability: malformed Supabase settings can no longer crash the app (falls back to demo mode with a console warning), stale device data is ignored (storage key bumped), service-worker cache bumped, and friendly branded error screens replace the generic "Application error" page. |
| 1.4 | 2026-08-03 | Role changes no longer break accounts: farmer views show a friendly "not linked" screen when a farmer record isn't linked, and farmers can never see other farmers' data even when unlinked. Signup now asks Field agent vs Farmer (Admin is never self-selectable). Forgot-password flow with a branded reset page. New admin **Summary report (PDF)**: branded one-page KPI, forecast, location and Tier-1 shortlist export. |
| 1.5 | 2026-08-03 | Farmers can always continue: linking to a farmer profile is optional (a calm "Continue as a farmer" card appears if unlinked, and they can log produce). Field agents can enter a shared **access code** on the sign-in screen instead of creating an account (admin changes it in Settings). Sign-out added to Settings. |

*Every future release appends a row here.*
