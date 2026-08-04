# Roki Farm Platform — Changelog

> This document is the complete history of the project: where we started, what we learned, and where we are.
> Every release appends a row. Never rewrite history — add to the top.

---

## 2.9 — 2026-08-04 · "Launch polish" (current)

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
