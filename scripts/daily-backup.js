#!/usr/bin/env node
/* =====================================================================
 * Roki — Daily Database Backup Script
 *
 * 1. Fetches all farmers + harvest logs from Supabase (service role key
 *    bypasses RLS so the backup is complete).
 * 2. Builds a 2-sheet Excel workbook: "Farmers" and "Harvest Logs".
 * 3. Emails it to the admin via Resend with filename backup_YYYY_MM_DD.xlsx
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 *           BACKUP_EMAIL_TO, BACKUP_EMAIL_FROM (default onboarding@resend.dev)
 * ===================================================================== */
const XLSX = require("xlsx");

const REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "BACKUP_EMAIL_TO"];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[backup] missing env var: ${key}`);
    process.exit(1);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL.replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_TO = process.env.BACKUP_EMAIL_TO;
const EMAIL_FROM = process.env.BACKUP_EMAIL_FROM || "onboarding@resend.dev";

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}_${p(d.getMonth() + 1)}_${p(d.getDate())}`;
}

async function fetchAll(table, orderCol) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=${orderCol}`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`fetch ${table}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

function sanitize(rows) {
  // make jsonb fields safe for Excel cells
  return rows.map((r) => {
    const out = { ...r };
    for (const [k, v] of Object.entries(out)) {
      if (v !== null && typeof v === "object") out[k] = JSON.stringify(v);
    }
    return out;
  });
}

async function main() {
  console.log("[backup] fetching farmers + produce_logs …");
  const [farmers, logs] = await Promise.all([
    fetchAll("farmers", "created_at"),
    fetchAll("produce_logs", "created_at"),
  ]);
  console.log(`[backup] got ${farmers.length} farmers, ${logs.length} logs`);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sanitize(farmers)), "Farmers");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sanitize(logs)), "Harvest Logs");

  const filename = `backup_${stamp()}.xlsx`;
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const base64 = buffer.toString("base64");
  console.log(`[backup] workbook ready: ${filename} (${(buffer.length / 1024).toFixed(0)} KB)`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Roki Backups <${EMAIL_FROM}>`,
      to: [EMAIL_TO],
      subject: `Roki daily backup — ${filename}`,
      text: `Attached is today's automated backup of the Roki farm platform.\n\n- ${farmers.length} farmers\n- ${logs.length} harvest logs\n\nGenerated automatically by the nightly backup job.`,
      attachments: [
        {
          filename,
          content: base64,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend email failed: HTTP ${res.status} ${body.slice(0, 300)}`);
  }

  console.log(`[backup] ✅ email sent to ${EMAIL_TO} with ${filename}`);
}

main().catch((err) => {
  console.error("[backup] ❌ failed:", err.message);
  process.exit(1);
});
