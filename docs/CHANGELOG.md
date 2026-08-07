# Roki Farm Platform — Changelog

> This document is the complete history of the project: where we started, what we learned, and where we are.
> Every release appends a row. Never rewrite history — add to the top.

---

## 3.3.0 — 2026-08-07 · Agent name: unmissable & mandatory (solves it once and for all)

Day-two feedback: agents were still skipping the name (or the device didn't remember it), leaving farmers without credit. Fix — you can no longer miss it:

- **Removed** the "Who is using this device?" card on the dashboard (it looked like an error and was skippable).
- **The survey now hard-requires the agent's name.** Step 1 opens with a big amber box — **"WHO IS REGISTERING THIS FARMER?"** — with a bold input and the rule: *cannot be skipped; if there is no specific agent, write "none"*. The form blocks completion until it's filled. The name also appears in the final review step.
- If the agent writes **"none" / "n/a" / "-"**, it's stored as a visible **"None"** group on the Agent performance page (never a silent blank).
- **Uploads now require credit too:** the "Credit these farmers to which agent?" box is mandatory (type a name or "none") unless the file itself has an **Agent Name** column — the Import button stays disabled with a clear message otherwise.
- The green Agent workspace banner no longer nags; it just shows **"Working as \<name\>"** (change link) when a name is set.
- **Nightly backup workflow fixed:** the secret-check step used `secrets[s]` inside a shell loop, which GitHub Actions evaluates as a literal key (always "missing") — rewritten with explicit checks so the workflow can actually run once secrets are set.
- 121 automated checks (+7 new).

> ⚠️ **Agents' phones must load the new build** — a phone running the old version still has the old (dropped-name) behaviour. Open Settings/Account and check the version says **3.3.0**; otherwise close the app fully and reopen (twice) to force the update.

## 3.2.0 — 2026-08-06 · Agent names are finally recorded (the big fix)

**The bug you were seeing**
The survey always asked "Your name (agent)", but a code bug meant that name was silently **dropped before the farmer record was saved** — so the Agent performance page showed "no agent" for every farmer, even though agents were typing their names. And the downloaded CSV had no agent column at all, so there was nowhere to see it.

**Fix**
- **Root cause:** `createFarmer` / `updateFarmer` now save the agent name (`loggedBy` / `logged_by`) on every farmer record.
- The agent's name is also written into the survey's **Enumerator** field, so survey PDFs show it.
- **Name captured once, up front:** the green Agent workspace banner now asks **"What's your name?"** when an agent starts, shows **"Working as \<name\>"** with a *change* link (great for shared phones), and pre-fills the survey's name field automatically.
- Admins get the same **"Who is using this device?"** prompt, so farmers registered by admins are credited too.
- **Uploads now credit an agent:** new "Credit these farmers to which agent?" box on the upload screen (pre-filled from the device name); a file can also carry an **Agent Name / Enumerator** column which wins per row.
- **The downloaded CSV list now includes a "Registered By (Agent)" column** — the "I downloaded the survey but can't see the agent" fix.
- Farmer cards, farmer detail page and the survey PDF all show the agent name.
- **Farmer profiles: admins can assign the agent** — each farmer's profile now has an inline **"Registered by …" editor** (pencil → type the agent's name → save → syncs to the cloud). This is how the older farmers with no recorded agent get their credit.
- **Edit-survey no longer wipes credit** — editing a farmer's details used to overwrite (or blank) the agent name with the current device user's name; it now preserves the existing agent.
- **Recovery script `supabase/migration_v15.sql`** — copies names already sitting inside old survey records (enumerator field) onto the farmer records. Run in the Supabase SQL editor (4 steps — read the numbers first).
- 114 automated checks (+13 new agent-attribution tests).

## 3.0–3.1 — 2026-08-05/06 · Two-group model + Agent performance page

- **Two roles only:** Admin (granted in Settings → Team & roles; the first account on a fresh DB is Admin automatically) and Field Agent (via access code `ROKIEXPORTS` or an account). Farmer role removed everywhere; leftover FARMER accounts are treated as Field Agents (migrations v12–v14).
- "Request access" replaces "Create account" — signups are Field Agents until an admin grants a role.
- **Agent performance page** (`/agents`): per-agent cards with farmer tables, per-agent CSV + full report download, and a "farmers without agent" warning card.
- **No-merge upload policy:** every row imports; only an explicit Farmer ID links to an existing record (the "35 became 30" fix).
- Expandable upload review (all rows, not 20), typeable sub-county with suggestions, GPS "Use my current location", crop + place filters with CSV download on the Farmers page.
- GitHub Actions keep-alive + nightly backup workflows (they check for secrets first).


**Fix**
- The field-agent access-code entry was invisible (the card only rendered when the local role was not FIELD_AGENT, which is the default — so it never showed). Replaced with a subtle **"Are you a field agent?"** link on the sign-in page that reveals the code field inline.

**Security**
- **Brute-force protection** on the agent access code: max 5 attempts per 10 minutes per device (localStorage rate limiter), with a clear lockout message.
- **Strict input validation** in the survey: required text must be real text (trimmed, length-capped); required numbers must be real numbers in range (acreage, quantities, ages, household counts); dates must be valid. Invalid input is blocked with a clear message instead of silently storing garbage.
- **Concurrency-safe ID generation**: farmer/log IDs now skip any id already present, so two devices writing at once can never collide (verified by test).
- 98 automated checks (6 new security tests).

**Docs**
- User manual + walkthrough + audit refreshed (agent link, security rules).

## 2.9 — 2026-08-04 · "Launch polish" (previous)

**Fix**
- Onboarding flicker: after sign-in the home page no longer flashes before redirecting to the survey — a splash holds until the farmer's profile is loaded, then the gate decides (survey or dashboard) with zero flicker.
- Surprise sign-outs: session validation now distinguishes a **really dead session** (deleted account, revoked token → sign out) from a **transient network failure** (→ keep the cached session, stay signed in). A temporary network blip no longer kicks people to the login screen.

**Improve**
- Survey UX: every step-change scrolls to the top; the crop/production rows now label every input ("Crop", "Area (acres)", **"Expected harvest date"**, "Expected quantity (kg)", "Harvest from/until") so nothing is a mystery date field; the final consent block shows a simple green **"Consent recorded on …"** line when already agreed (no redundant interactive box).
- New admin tool: **Survey PDF** button on every farmer profile — downloads a branded one-page PDF of that farmer's full questionnaire, production plan and planting history.
- Simplicity pass: removed filler wording on the farmer screens.

**Docs**
- Added `docs/CHANGELOG.md` (this file), `docs/DEVELOPER-GUIDE.md` (how the repo works, rules, how to contribute) and `docs/README.md` (index). The user manual, setup walkthrough and audit were refreshed. All docs are now living documents: any code change must update them.

## 2.8 — 2026-08-04 · Real-world hardening

**Add**
- **Dedup & merge tool** (`/duplicates`, admin): auto-detects duplicate farmers by same phone / email / normalized name; pick a master and one-click merge (logs, planting history, production plans, missing fields). Account-linked records are protected (master-only).
- **Sentry client monitoring** (optional `NEXT_PUBLIC_SENTRY_DSN`) wired into the global error logger + error boundary.
- **Uptime health endpoint** `/api/health` (200 JSON) for UptimeRobot or any monitor.
- **Multi-language for farmers**: English, Luganda, Runyankole/Rukiga, Kiswahili — auto-set from the survey's preferred-language answer, switchable in Account. Staff screens stay English. All strings live in `src/lib/i18n.ts`.
- SMS/USSD plans removed from the product and docs (cost/complexity; revisit later).

## 2.7 — 2026-08-04 · Planting history + real file support

- Upload engine captures **PLANTING DATE, SOURCE OF SEED, STATUS, GPS-LATITUDE/LONGITUDE** from real lists (e.g. "ROKI FARMERS LIST 2024").
- STATUS now resolves to **planting status**, not refugee status (bug found by tests).
- Farmer profile shows a **Planting history** table; GPS lands on the survey record.
- 88 automated checks.

## 2.6 — 2026-08-04 · Real-world upload resilience

- **First Name + Last Name** columns auto-merge into full name.
- **Multi-phone cells** (`0782…/0779…`) keep the first valid number and flag the rest as warnings — nothing silently lost.
- Phones with inner spaces normalize; messy acreage values clean up; **COMPANY NAME headers never become a farmer name**.
- Upload page shows a **Recommended spreadsheet format** guide; every column stays visible in the mapper.
- 80 checks (7 new parser tests written against a real client file).

## 2.5 — 2026-08-04 · Stale-session fix

- Sessions are **server-validated on boot** — deleted accounts are signed out automatically.
- Production **never seeds demo data** (empty local state; cloud is the source of truth). Preview environments still seed sample data.
- Storage cache bumped (roki-db-v3).

## 2.4 — 2026-08-04 · Survey gate + extras + reset

- Fixed the stuck **"Setting up your farmer profile"** screen (the gate no longer blocks `/survey` itself).
- Survey gained **"More about your farm"** step: farm name, preferred language, smartphone access, market distance, other income.
- Farmer dashboard profile card cleaned up.
- **Full factory reset SQL** (`supabase/wipe_everything.sql`, with CASCADE).

## 2.3 — 2026-08-04 · Mandatory onboarding + phone claiming

- Onboarding survey is **mandatory** — farmers are held at `/survey` until completed (no skip).
- Survey completion reliably links/updates the account's own record.
- **Phone-based claiming**: entering a phone that matches an existing record (e.g. from an uploaded list) offers to link the login to that record.
- Survey mobile polish (full-width rows, spacing).

## 2.2 — 2026-08-04 · Upload ↔ account linking model

- Rows match farmer records by **ID → phone → email** (email added as a matching key + column).
- Signup **claims an existing farmer record by email** instead of duplicating (`migration_v6.sql`).
- Simulation file gained an Email column; manual section 5.7b explains the two linking scenarios.

## 2.1 — 2026-08-04 · Accounts ARE farmers

- Every signup automatically gets its **own farmer record + ID** (sequence-generated, email on record) — no linking step ever (`migration_v5.sql`).
- Self-registration fills the account's own record; the "Link a farmer" control removed from Team & roles.
- Farmers list shows new signups (email + "Pending survey" badge), newest first; farmers can update their own record.

## 2.0 — 2026-08-04 · Farmer-only signup

- Signup role picker removed: **every account is a Farmer**; field agents use the access code; Admin is never self-selectable (`migration_v4.sql` retro-fixes old FIELD_AGENT self-signups).
- Auto survey nudge on first sign-in.

## 1.9.1 — 2026-08-03 · Sync reliability

- Awaited account→farmer linking (no silent fire-and-forget).
- **Live refresh every 15s** on all devices while online; manual **Refresh data** button on the staff dashboard; Farmers list newest-first with 20s auto-refresh.

## 1.9 — 2026-08-03 · Farmer self-registration survey

- New farmers invited to complete the official 15-section questionnaire (`/survey`); self mode hides enumerator-only fields; finishing auto-links the account.

## 1.8 — 2026-08-03 · Role calibration

- Farmers see only their own world (stats, harvests, farming tips) — zero admin metrics.
- My Farm opens to the farmer's own account (no admin gate); account page no longer shows other roles to farmers; demo artifacts removed.

## 1.7.x — 2026-08-03 · Stability & diagnostics

- 1.7.1: fixed the last **React error #300** source (app shell returned early for `/login` before its hooks). All hooks audited app-wide.
- 1.7.0: "Continue as a farmer" persists across refreshes; agent sessions survive refresh; error screens show the real error + copy button; global error logger; app version stamp.

## 1.6 — 2026-08-03 · Security headers + config guard

- Security headers (nosniff, X-Frame-Options DENY, referrer policy, permissions policy).
- Misconfigured backend shows a clear error screen instead of silently serving demo data.
- Agent code never displayed in plaintext.

## 1.5 — 2026-08-03 · Access code + farmer continue

- Field-agent **shared access code** (no accounts; admin-managed, hashed).
- Farmers can always continue without linking; sign-out added to Settings.

## 1.4 — 2026-08-03 · Roles, forgot password, PDF report

- Role-change crash fixed (unlinked farmers safe; no data leak).
- Signup role picker (Field agent/Farmer; Admin gatekept), forgot-password + reset page.
- Admin **Summary report (PDF)**.

## 1.3 — 2026-08-03 · Stability

- Malformed Supabase config can't crash the app; stale data immunity (storage bump); SW cache bump; branded error screens.

## 1.2 — 2026-08-03 · Upload editing + layout fixes

- Upload staging **editable inline** (tap-to-edit cells, dropdowns, visible drop messaging, remove-invalid).
- Harvest Logs desktop overflow fixed; right-edge fade on wide tables; single-row header; admin Delete-all-data with typed confirm.

## 1.1 — 2026-08-03 · Polish pass

- In-app **Team & roles** (no SQL); Account page with sign-out; standalone login page; role switcher moved to Account (demo); Roki name in mobile header; roomier grid; settings cards fixed; em dashes → commas.

## 1.0 — 2026-08-03 · Production-ready base

- Supabase backend + auth + RLS; sync engine (offline outbox → cloud); keep-alive + nightly backup automation; in-app Help & Guide; master backup; full audit + manual.

## 0.x — 2026-08-02 · Demo → Roki

- Started as "Joan Farm Logs" demo (Next.js PWA, offline-first, rule engine, bulk upload, data grid). Client loved it; rebranded to **Roki Fruit & Vegetables** with the official logo, the 15-section questionnaire (from their PDF), farmer/refugee data model, and the four client dashboards (Farmer Dashboard, Production Forecast, Export Supply Planning, Farmer Scoring).
- Lessons learned in 0.x: hooks-ordering bugs (React #300) crash on navigation — always run hooks before conditional returns; offline-first + outbox needs a live-refresh loop; "linking accounts to pre-existing records" is the wrong model — **accounts ARE farmers**; real spreadsheets are messy (first/last names, multi-phone cells, company headers) — the engine must never silently drop data.
