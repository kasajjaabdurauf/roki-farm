# Roki Farm Platform — Step-by-Step Setup Walkthrough (GO LIVE)

**Goal:** go from zip file → live, secure, backed-up platform used by 1,000+ people.
**Total time:** ~2 hours in one sitting (most steps are 5–15 minutes).
**Rule that makes everything else safe:** create a **dedicated Gmail** (e.g. `rokifarmlogs@gmail.com`) and create **every account with that email**. Never use personal accounts.

> ⚠️ Only Step 2 (GitHub) and Step 5 (Vercel) need the code. Every other step is website clicking + copy-paste.

---

## PHASE 0 — Prep (10 min)

- [ ] **0.1** Unzip `roki-farm-platform.zip` → folder `roki-farm-platform/`.
- [ ] **0.2** Create the dedicated Gmail: go to [accounts.google.com/signup](https://accounts.google.com/signup) → create `rokifarmlogs@gmail.com` (or similar). Write the password in your password manager NOW (see Appendix A).
- [ ] **0.3** Open a browser tab for each: GitHub, Vercel, Supabase, Resend. Keep them signed into the new Gmail.
- [ ] **0.4** You will need your phone nearby for 2FA on the new accounts.

---

## PHASE 1 — GitHub (15 min)
*(Required — the keep-alive and nightly backup automations live here.)*

- [ ] **1.1** Go to [github.com](https://github.com) → **Sign up** with the new Gmail. Verify email.
- [ ] **1.2** Click **+** (top-right) → **New repository** → name: `roki-farm-platform` → **Private** → **Create repository**.
- [ ] **1.3** Put the code in the repo. Two ways:

  **Option A — Git command line (recommended, 5 min):**
  ```bash
  cd roki-farm-platform
  git init
  git add -A
  git commit -m "Roki platform v1.0"
  git branch -M main
  git remote add origin https://github.com/<YOUR_USERNAME>/roki-farm-platform.git
  git push -u origin main
  ```
  *(If Git isn't installed: [git-scm.com/downloads](https://git-scm.com/downloads))*

  **Option B — Web upload (works but slower):** on the new repo page → **uploading an existing file** → drag the *contents* of the folder (package.json, src/, public/, .github/, supabase/, scripts/, docs/, etc.) → Commit.

- [ ] **1.4** Add the GitHub secrets (they power the automations). On the repo → **Settings → Secrets and variables → Actions → New repository secret**. Add all six:
  | Secret name | Value (get from Phase 2/3) |
  |---|---|
  | `SUPABASE_URL` | `https://xxxx.supabase.co` |
  | `SUPABASE_ANON_KEY` | anon key (Step 2.4) |
  | `SUPABASE_SERVICE_ROLE_KEY` | **service_role** key (Step 2.4) |
  | `RESEND_API_KEY` | `re_…` (Step 3.2) |
  | `BACKUP_EMAIL_TO` | `rokifarmlogs@gmail.com` |
  | `BACKUP_EMAIL_FROM` | `onboarding@resend.dev` |
- [ ] **1.5** ✅ **Verify:** repo → **Actions** tab → you should see the two workflows ("Keep Supabase Awake", "Nightly Database Backup"). Don't run them yet — Supabase doesn't exist yet.

---

## PHASE 2 — Supabase (20 min)

- [ ] **2.1** Go to [supabase.com](https://supabase.com) → **Start your project** → sign up with the new Gmail (can use "Continue with GitHub" — that's fine, it'll link to the new account).
- [ ] **2.2** Create project: Organization name `Roki Fruits`, Project name `roki-farm-platform`, **Database Password** (write it in the password manager — this is the postgres master password), Region: **EU Central (Frankfurt)** or the closest to Uganda. → Create. Wait ~2 min for provisioning.
- [ ] **2.3** Open the project → left sidebar → **SQL Editor** → **New query** → paste the ENTIRE contents of `roki-farm-platform/supabase/schema.sql` → **Run**. (It creates tables, security rules, the profile trigger, and default settings.)
- [ ] **2.3b** In the SQL Editor, open a second query → paste the ENTIRE contents of `roki-farm-platform/supabase/migration_v2.sql` → **Run**. (Adds the email column, first-user-becomes-admin and in-app role management.)
- [ ] **2.3c** In the SQL Editor, open a third query → paste the ENTIRE contents of `roki-farm-platform/supabase/migration_v3.sql` → **Run**. (Honours the Field agent / Farmer choice made at signup; Admin stays admin-only.)
- [ ] **2.3d** In the SQL Editor, open a fourth query → paste the ENTIRE contents of `roki-farm-platform/supabase/migration_v4.sql` → **Run**. (Every self-signup is now a Farmer; retro-fixes any old FIELD_AGENT self-signups.)
- [ ] **2.3e** In the SQL Editor, open a fifth query → paste the ENTIRE contents of `roki-farm-platform/supabase/migration_v5.sql` → **Run**. (THE big one: every account automatically gets its OWN farmer record + ID at signup, no linking; backfills existing accounts; farmers can update their own record.)
- [ ] **2.3f** In the SQL Editor, open a sixth query → paste the ENTIRE contents of `roki-farm-platform/supabase/migration_v6.sql` → **Run**. (Upload↔account linking: signup claims an existing farmer record by email instead of duplicating — covers people uploaded from a list before they signed up.)
- [ ] **2.4** Get the keys: sidebar → **Settings → API** (or Project Settings → API). Copy:
  - `Project URL` → this is `SUPABASE_URL`
  - `anon public` key → `SUPABASE_ANON_KEY`
  - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**never** put this in the app/Vercel — GitHub secret only)
- [ ] **2.5** ✅ **Verify security is on:** SQL Editor → run:
  ```sql
  select relname, relrowsecurity from pg_class
  where relname in ('profiles','farmers','produce_logs','settings');
  ```
  → all four rows must show `relrowsecurity = t` (true). If any is `f`, re-run the schema file.

---

## PHASE 3 — Resend (10 min)
*(Transactional email — used for the nightly backup email.)*

- [ ] **3.1** Go to [resend.com](https://resend.com) → sign up with the new Gmail → verify email.
- [ ] **3.2** Left menu → **API Keys** → **Create API Key** → name `backup` → copy the `re_…` key.
- [ ] **3.3** Sender: you can start with the shared sandbox sender `onboarding@resend.dev` (no verification needed — email will arrive from that address). Add it to GitHub secrets as `BACKUP_EMAIL_FROM`.
- [ ] **3.4** ✅ **Verify:** Run the nightly backup workflow now (GitHub → Actions → Nightly Database Backup → Run workflow). Wait 1 min → check `rokifarmlogs@gmail.com` → **backup_YYYY_MM_DD.xlsx email arrived** = Phase 3 done. (It will contain 0 farmers — that's correct at this point.)

---

## PHASE 4 — Vercel deploy (15 min)

- [ ] **4.1** Go to [vercel.com](https://vercel.com) → **Sign up** with the new Gmail → **Continue with GitHub** → authorize the `roki-farm-platform` repo.
- [ ] **4.2** **Add New… → Project** → select `roki-farm-platform` → Vercel auto-detects Next.js → **Deploy**. (First build ~2 min.)
- [ ] **4.3** Add environment variables: **Project → Settings → Environment Variables**:
  | Name | Value |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
  Apply to **Production** (and Preview if you like) → **Redeploy** (Deployments → ⋯ → Redeploy).
- [ ] **4.4** ✅ **Verify:** open the Vercel URL → you should see the **Sign in** page (the app has switched from demo mode to production mode).

---

## PHASE 5 — Accounts & roles (10 min)

- [ ] **5.1** Open the live app → **Create account** with `rokifarmlogs@gmail.com` + a strong password → confirm from inbox → **Sign in**.
- [ ] **5.2** In Supabase → **Authentication → Users** → note the new user's **UUID**.
- [ ] **5.3** Make it the admin — **no SQL needed**: the first account on a fresh database is automatically the Admin (the migration trigger handles it). If you created accounts before applying migration_v2, promote the first one with:
  ```sql
  update public.profiles set role = 'ADMIN' where id = '<uuid>';
  ```
- [ ] **5.4** Farmer accounts: people sign up in the app (always as Farmer — there is no role picker; field agents use the access code). They are then prompted to complete the farmer registration survey, which creates and links their farmer profile automatically. Admins can adjust roles in **Settings → Team & roles** (Admin / Field Agent / Farmer + linked farmer).
  💡 (SQL fallback if ever needed: `update public.profiles set role = 'FARMER', farmer_id = 'RFV-UG-00001' where id = '<uid>';` — UUIDs live in Supabase → Authentication → Users.)
- [ ] **5.5** ✅ **Verify:** sign out, sign back in as Joan → you should see **Dashboard, Forecast, Supply, Farmers, Upload, Grid, Settings** and your email chip (no role switcher). Sign in as a farmer account → only **My Farm / Harvest Logs / Help** and no other farmers' data.

---

## PHASE 6 — Automation live (5 min)

- [ ] **6.1** GitHub → Actions → **Keep Supabase Awake** → **Run workflow** → green check = the 3-day cron will now keep the database from pausing.
- [ ] **6.2** **Nightly Database Backup** → **Run workflow** → confirm the email arrives (as in 3.4, now with any data you've added).
- [ ] **6.3** ✅ **Verify:** both workflows green in the Actions tab.

---

## PHASE 7 — Real data migration (30 min)

- [ ] **7.1** Export your current farmer list as a `.csv` (or use the sample format: Farmer Name, Phone, District, Sub-County, Crop, Harvest Date, Qty (Kg), Grade). For testing, use `simulations/roki-simulation-1000-farmers.xlsx` — it has 1,000 rows with intentional errors to practise fixing.
- [ ] **7.2** In the app: **Bulk Upload** → drag the file → check the **column mapping** → inspect the **staging grid** (red rows = errors, excluded) → **Import**.
- [ ] **7.3** If rows errored (bad phones, negative quantities…), fix the file and re-import. Only the fixed rows import — it's idempotent by phone.
- [ ] **7.4** Check the results: **Farmers** page count matches your list; spot-check 5 profiles (phone normalized to +256, tier assigned).
- [ ] **7.5** **Decision point:** existing farmers need full questionnaire backfill (Sections 1–15) — choose: (a) re-survey them in the field as you visit (recommended — you're in the field anyway), or (b) import only what the spreadsheet has now. The platform works either way.

---

## PHASE 8 — Live end-to-end test (the client demo, 20 min)

Do this with Joan watching — it's also Handover Deliverable 3:

- [ ] **8.1** On a phone (airplane mode): **New Survey** → complete all 9 steps → **Complete registration** → see `RFV-UG-XXXXX` assigned. Turn data back on → chip shows "1 pending sync" → auto-syncs → appears on the laptop.
- [ ] **8.2** Upload a sample Excel with **10 rows including 2 bad ones** → staging shows red rows → import succeeds with a report.
- [ ] **8.3** **Data Grid → Logs tab** → filter → **Export Excel** → opens on her computer with clean +256 phones.
- [ ] **8.4** Check her inbox: the nightly backup email arrived (run the workflow manually if needed).
- [ ] **8.5** Install on both phones: Android Chrome ⋮ → Add to Home screen · iPhone Safari Share → Add to Home Screen → open from home screen → works offline.
- [ ] **8.6** Demo the extras: **Forgot password** flow (send link, set new password) and the admin **Summary report (PDF)** export.

---

## PHASE 9 — Handover & support (30 min)

- [ ] **9.1** Fill in **Appendix A** (master credentials) and store it in the password manager. Give Joan access to the password manager vault (this is Deliverable 2).
- [ ] **9.2** Send Joan: live link + install instructions (Deliverable 1) + the user manual (`docs/ROKI-USER-MANUAL.md` — also available in-app at **Help & Guide**).
- [ ] **9.3** Agree the **30-day support window** in writing (bug fixes free; features quoted).
- [ ] **9.4** Book check-ins: **day 1, 3, 7, 14, 30** — 15 minutes each: farmer count, error reports, backup emails arriving.
- [ ] **9.5** Post the first weeks' data volumes into the audit doc (`docs/ROKI-AUDIT-AND-ROADMAP.md`) and tick off P1 items.

---

## PHASE 10 — Make your demo video (optional, 30–40 min)

Use the simulation files in `simulations/` to show real scale without real data.

**Simulation files**
| File | Contents | Best for |
|---|---|---|
| `simulations/roki-simulation-1000-farmers.xlsx` | 1,000 farmers + produce rows; 25 intentional errors + 2 duplicate pairs (tinted, documented in the Read Me sheet) | Bulk upload at scale, inline error fixing, load test |
| `simulations/roki-farmer-log-simulation.xlsx` | 900 harvest logs referencing the farmer IDs above; anomalies, duplicate pair, error rows | Harvest-log demo, rule-engine flags (NEEDS AUDIT / FLAGGED) |

**Suggested 10-beat video script**
1. **Intro (0:00–1:00)** — brand screen, "what this platform does" (collect → forecast → supply → score). Say the zero-AI line.
2. **Admin dashboard (1:00–3:00)** — KPIs, refugee vs host, gender, location mapping, tier cards, rule findings.
3. **Register a farmer (3:00–6:00)** — New Survey, walk the 9 steps quickly, note consent + auto ID + scoring preview.
4. **Field agent, no account (6:00–7:30)** — phone: enter the access code → straight in.
5. **Bulk upload at scale (7:30–12:00)** — drag in the 1,000-farmer file; show auto-mapping; fix 2–3 tinted error cells inline; note rows with errors are excluded; Import; show the report.
6. **Rule engine (12:00–14:00)** — Harvest Logs: enter a huge quantity → "Needs Audit" note; upload the log simulation → duplicates flagged.
7. **Forecast & Supply (14:00–17:00)** — crop × farmers × volume × period table; supply filters (Tier 1); exports.
8. **Data grid & exports (17:00–20:00)** — inline edit a cell, filter, CSV/Excel export, master backup.
9. **PDF report (20:00–21:30)** — admin dashboard → Report (PDF) → show the branded one-pager.
10. **Backups & ops (21:30–24:00)** — GitHub Actions (keep-alive + nightly backup), the backup email in the inbox, Settings → Team & roles (change a role), sign out. Wrap with the 60-second health check.

Narration crib: the full screen-by-screen explanations are in `docs/ROKI-USER-MANUAL.md` — read sections 5 and 6 aloud and you have the script.

---

## Appendix A — Master Credentials Template (fill in, keep in password manager)

| System | URL | Email | Password / Key | Notes |
|---|---|---|---|---|
| Gmail | gmail.com | | | The root account |
| GitHub | github.com | | | repo: roki-farm-platform |
| Vercel | vercel.com | | | project: roki-farm-platform |
| Supabase | supabase.com | | | DB password + project URL |
| Resend | resend.com | | | API key `re_…` |
| App admin | live URL | | | role: ADMIN |
| App field agent(s) | live URL | | | role: FIELD_AGENT |

**Key hygiene rules**
- `NEXT_PUBLIC_*` (anon key, project URL) → Vercel env vars (they're public by design).
- `service_role` key, `RESEND_API_KEY`, DB password → **GitHub secrets / password manager only**. Never in the app, never in chat, never in the zip.
- If a key leaks: Supabase → Settings → API → **Roll** the key.

---

## Appendix B — The 60-second health check (run any day)

1. Open the app → signed in → dashboard loads.
2. Sync chip shows **All synced**.
3. Inbox has today's `backup_YYYY_MM_DD.xlsx`.
4. GitHub Actions: last runs green.
5. Supabase → Database → no "project paused" banner.

All five = everything is healthy.
