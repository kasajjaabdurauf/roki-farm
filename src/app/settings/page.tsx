"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Database,
  Download,
  HardDrive,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  UserRound,
  Loader2,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { matchesAgentCode, setAgentCode, syncNow, updateCropDefaults, updateSettings, useDb, wipeAllData } from "@/lib/db";
import { downloadSummaryPdf } from "@/lib/report";
import { signOut } from "@/lib/remote";
import { downloadCSV, downloadMasterBackup, downloadXLSX, stamp, type ExportColumn } from "@/lib/export";
import { APP_VERSION, fmtDateTime } from "@/lib/format";
import { CROPS } from "@/lib/reference";
import { fetchAllProfiles, remoteConfigured, updateProfileRole, type TeamMember } from "@/lib/remote";
import { TIER_LABEL } from "@/lib/types";
import { Button, Card, ConfirmDialog, Input, Select, Toggle } from "@/components/ui";
import { PwaHint } from "@/components/layout";

export default function SettingsPage() {
  const db = useDb();
  const [q, setQ] = useState("");
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [agentCode, setAgentCodeInput] = useState("");
  const [agentMsg, setAgentMsg] = useState("");

  const storageSize = useMemo(() => {
    try {
      const raw = localStorage.getItem("jfl-db-v1") ?? "";
      return `${(raw.length / 1024).toFixed(0)} KB`;
    } catch {
      return "N/A";
    }
  }, [db]);

  const crops = useMemo(
    () => CROPS.filter((c) => c.toLowerCase().includes(q.trim().toLowerCase())),
    [q]
  );

  const rules = db.settings.rules;

  function masterBackup() {
    const nameOf = (id: string) => db.farmers.find((f) => f.id === id)?.fullName ?? "Unknown";
    downloadMasterBackup(db.farmers, db.logs, nameOf, `roki-master-backup-${stamp("backup")}.xlsx`);
  }

  function exportFarmers(xlsx: boolean) {
    const cols: ExportColumn[] = [
      { key: "id", label: "Farmer ID" },
      { key: "fullName", label: "Full Name" },
      { key: "phone", label: "Phone (+256)" },
      { key: "district", label: "District" },
      { key: "subCounty", label: "Sub-County" },
      { key: "village", label: "Village" },
      { key: "acreage", label: "Acreage (acres)" },
      { key: "scaleTier", label: "Scale Tier", value: (r) => TIER_LABEL[r.scaleTier as keyof typeof TIER_LABEL] },
      { key: "primaryCrops", label: "Crops", value: (r) => r.primaryCrops.join("; ") },
      { key: "createdAt", label: "Registered", value: (r) => fmtDateTime(r.createdAt) },
    ];
    const name = `jfl-backup-farmers-${stamp("backup")}`;
    if (xlsx) downloadXLSX(db.farmers, cols, `${name}.xlsx`);
    else downloadCSV(db.farmers, cols, `${name}.csv`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-forest-900">Settings</h2>
        <p className="mt-0.5 text-sm text-stone-500">
          Admin-only: tune the deterministic validation rules and manage data. All changes re-run the rule engine instantly.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* team & roles (admin, production) */}
        {remoteConfigured() && <TeamRolesCard />}

        {/* field-agent access code (admin) */}
        {remoteConfigured() && (
          <Card>
            <h3 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
              <UserCog className="h-5 w-5 text-ochre-500" /> Field-agent access code
            </h3>
            <p className="mb-4 text-[13px] text-stone-500">
              Field agents can enter the shared code on the sign-in screen to continue without an account. Change it
              here anytime; the old code stops working immediately.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={agentCode}
                onChange={(e) => { setAgentCodeInput(e.target.value); setAgentMsg(""); }}
                placeholder="New access code"
                className="h-11 w-64 text-sm"
                autoComplete="off"
              />
              <Button
                variant="accent"
                size="sm"
                className="h-11"
                disabled={agentCode.trim().length < 6}
                onClick={() => {
                  setAgentCode(agentCode.trim());
                  setAgentCodeInput("");
                  setAgentMsg(`Access code updated. Agents must use "${agentCode.trim()}".`);
                }}
              >
                <KeyRound className="h-4 w-4" /> Update code
              </Button>
            </div>
            {agentMsg && <p className="mt-2 text-[12.5px] font-semibold text-success-dark">{agentMsg}</p>}
            <p className="mt-2 text-[12px] text-stone-400">
              The current code is stored hashed (never in plaintext). Share it with field agents privately.
            </p>
          </Card>
        )}

        {/* rule toggles */}
        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
            <ShieldCheck className="h-5 w-5 text-ochre-500" /> Rule engine switches
          </h3>
          <div className="space-y-2">
            <Toggle
              checked={rules.anomalyDetection}
              onChange={(v) => updateSettings({ rules: { ...rules, anomalyDetection: v } })}
              label="Unusual yield alert"
              description="Flag logs where yield_kg > acreage × max_expected_yield_per_acre as “Needs Audit”."
            />
            <Toggle
              checked={rules.duplicateGuard}
              onChange={(v) => updateSettings({ rules: { ...rules, duplicateGuard: v } })}
              label="Duplicate guard"
              description="Flag same farmer + harvest date + crop logged within 24 hours."
            />
            <Toggle
              checked={rules.incompleteProfile}
              onChange={(v) => updateSettings({ rules: { ...rules, incompleteProfile: v } })}
              label="Incomplete profile flag"
              description="Highlight farmers missing critical contact details (phone, district, sub-county)."
            />
            <Toggle
              checked={rules.yieldScoring}
              onChange={(v) => updateSettings({ rules: { ...rules, yieldScoring: v } })}
              label="Harvest yield scoring"
              description="Assign Low / Expected / Bumper from historical per-crop medians."
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
            <SlidersHorizontal className="h-5 w-5 text-ochre-500" /> Per-crop thresholds (kg / acre)
          </h3>
          <p className="mb-4 text-[13px] text-stone-500">
            <b>Max</b> = anomaly ceiling · <b>Typical</b> = baseline for yield scoring. Edits re-flag existing logs instantly.
          </p>
          <div className="relative mb-3">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search crop…" className="h-10 pl-9 text-sm" />
          </div>
          <div className="max-h-[420px] overflow-x-auto overflow-y-auto rounded-xl border border-stone-200">
            <table className="w-full min-w-[460px] text-left text-[13px]">
              <thead className="sticky top-0 bg-stone-50">
                <tr className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                  <th className="py-2.5 pr-3 pl-3">Crop</th>
                  <th className="py-2.5 pr-3">Max kg/ac</th>
                  <th className="py-2.5 pr-3">Typical kg/ac</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {crops.map((c) => {
                  const d = db.settings.crops[c] ?? { maxPerAcreKg: 1000, typicalPerAcreKg: 500 };
                  return (
                    <tr key={c} className="hover:bg-stone-50/60">
                      <td className="py-2 pr-3 pl-3 font-semibold text-stone-700">{c}</td>
                      <td className="py-2 pr-3">
                        <CropInput value={d.maxPerAcreKg} onSave={(v) => updateCropDefaults(c, v, d.typicalPerAcreKg)} />
                      </td>
                      <td className="py-2 pr-3">
                        <CropInput value={d.typicalPerAcreKg} onSave={(v) => updateCropDefaults(c, d.maxPerAcreKg, v)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* data management */}
      <Card>
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
          <Database className="h-5 w-5 text-ochre-500" /> Data management
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <Database className="h-4 w-4 text-stone-400" /> {remoteConfigured() ? "Cloud + local (Supabase)" : "Local preview data"}
            </p>
            <p className="mt-1 mb-3 text-[12.5px] leading-relaxed text-stone-500">
              {remoteConfigured()
                ? "All changes are pushed to Supabase automatically and pulled on sign-in. The local copy keeps the app fast and offline-capable."
                : "No cloud connection configured on this environment, so this device holds preview data only."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void syncNow()}>
                <RefreshCw className="h-3.5 w-3.5" /> Sync now
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <HardDrive className="h-4 w-4 text-stone-400" /> Local database
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500">
              <b>{db.farmers.length.toLocaleString()}</b> farmers · <b>{db.logs.length.toLocaleString()}</b> logs ·{" "}
              <b>{storageSize}</b> on this device. Data lives in the browser (offline-first), the repository layer in{" "}
              <code className="rounded bg-stone-100 px-1 font-mono text-[11px]">src/lib/db.ts</code> is the single swap point for a
              Supabase/PostgreSQL backend.
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
            <p className="text-sm font-semibold text-stone-700">Full backup export</p>
            <p className="mt-1 mb-3 text-[12.5px] text-stone-500">
              Download every farmer and log with clean +256 phone formatting and computed columns.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportFarmers(false)}>
                <Download className="h-3.5 w-3.5" /> Farmers CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportFarmers(true)}>
                <Download className="h-3.5 w-3.5" /> Farmers Excel
              </Button>
              <Button variant="accent" size="sm" onClick={masterBackup}>
                <Download className="h-3.5 w-3.5" /> Master backup (.xlsx)
              </Button>
              <Button variant="outline" size="sm" onClick={() => void downloadSummaryPdf(db)}>
                <Download className="h-3.5 w-3.5" /> Summary report (PDF)
              </Button>
            </div>
            <p className="mt-2 text-[11.5px] text-stone-400">
              Master backup = one workbook with Farmers + Harvest Logs sheets (surveys and plans included). The PDF
              report is a branded one-page summary: KPIs, forecast, locations and Tier-1 shortlist.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
          <div className="flex items-center gap-2">
            <PwaHint />
            {remoteConfigured() && (
              <Button variant="ghost" className="text-stone-500 hover:bg-stone-100" onClick={() => void signOut().then(() => { window.location.href = "/login"; })}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            )}
          </div>
          <p className="mt-4 text-[11px] text-stone-300">
            Roki platform v{APP_VERSION} · build {new Date().toISOString().slice(0, 10)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="text-danger-600 hover:bg-danger-50" onClick={() => { setWipeOpen(true); setWipeConfirm(""); }}>
              <AlertTriangle className="h-4 w-4" /> Delete all data…
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        onConfirm={wipeAllData}
        danger
        title="Delete ALL data?"
        confirmLabel="Delete everything"
        confirmDisabled={wipeConfirm !== "DELETE"}
        message={
          <p>
            This permanently deletes <b>every farmer, survey and harvest log</b> from this account,{" "}
            <b>including the cloud database</b> ({remoteConfigured() ? "it syncs the deletion to Supabase" : "local preview data"}).
            The nightly backup email is your only way back. This cannot be undone.
          </p>
        }
      >
        <p className="text-[12.5px] text-stone-500">
          Type <b className="font-mono">DELETE</b> to confirm.
        </p>
        <Input
          value={wipeConfirm}
          onChange={(e) => setWipeConfirm(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
          className="h-11 text-center font-mono font-bold"
        />
      </ConfirmDialog>
    </div>
  );
}

function CropInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <input
      type="number"
      min={0}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = parseInt(draft, 10);
        if (!isNaN(n) && n > 0 && n !== value) onSave(n);
        else setDraft(String(value));
      }}
      className="h-9 w-24 rounded-lg border border-stone-300 px-2 text-right text-[13px] font-semibold tabular outline-none focus:border-forest-600 focus:ring-2 focus:ring-forest-100"
    />
  );
}


// ------------------------------------------------------------------
// Team & roles — manage admins / agents / farmers without SQL.
// Only visible to admins (RLS enforces this on the server too).
// ------------------------------------------------------------------
function TeamRolesCard() {
  const db = useDb();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetchAllProfiles()
      .then(setMembers)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load team"));
  }, []);

  async function changeRole(m: TeamMember, role: string) {
    setSaving(m.id);
    setError("");
    setNotice("");
    try {
      const farmerId = role === "FARMER" ? m.farmer_id : null;
      await updateProfileRole(m.id, role, role === "FARMER" ? m.farmer_id : null);
      setMembers((prev) => prev?.map((x) => (x.id === m.id ? { ...x, role } : x)) ?? null);
      setNotice(`${m.email ?? "Member"} is now ${role}. They'll see the new role on their next sign-in.`);
      void farmerId;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(null);
    }
  }

  async function changeFarmerLink(m: TeamMember, farmerId: string | null) {
    setSaving(m.id);
    setError("");
    setNotice("");
    try {
      await updateProfileRole(m.id, m.role, farmerId);
      setMembers((prev) => prev?.map((x) => (x.id === m.id ? { ...x, farmer_id: farmerId } : x)) ?? null);
      setNotice(`Farmer link updated for ${m.email ?? "member"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <h3 className="font-display text-lg font-semibold text-forest-900">Team &amp; roles</h3>
        <span className="rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-bold text-forest-700 uppercase">
          Admin
        </span>
      </div>
      <p className="mb-4 text-[13px] text-stone-500">
        Add and manage administrators, field agents and farmers without touching the database. New sign-ups
        automatically join as Field Agents; the very first account on a fresh database becomes the Admin.
      </p>

      {error && <p className="mb-3 rounded-xl bg-danger-bg px-3.5 py-2.5 text-[13px] font-semibold text-danger-dark">{error}</p>}
      {notice && <p className="mb-3 rounded-xl bg-success-bg px-3.5 py-2.5 text-[13px] font-semibold text-success-dark">{notice}</p>}

      {!members ? (
        <p className="flex items-center gap-2 py-6 text-center text-[13px] text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
        </p>
      ) : members.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-stone-400">No accounts yet. Ask team members to sign up in the app.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-stone-200 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                <th className="py-2.5 pr-3 pl-1">Email</th>
                <th className="py-2.5 pr-3">Role</th>
                <th className="py-2.5 pr-3">Linked farmer</th>
                <th className="py-2.5">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-stone-50/60">
                  <td className="max-w-[220px] truncate py-2.5 pr-3 pl-1 font-semibold text-stone-700">
                    {m.email ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Select
                      value={m.role}
                      disabled={saving === m.id}
                      onChange={(e) => changeRole(m, e.target.value)}
                      className="h-10 w-44 rounded-lg text-[12px] font-semibold"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="FIELD_AGENT">Field Agent</option>
                      <option value="FARMER">Farmer</option>
                    </Select>
                  </td>
                  <td className="py-2.5 pr-3">
                    {m.role === "FARMER" ? (
                      <Select
                        value={m.farmer_id ?? ""}
                        disabled={saving === m.id}
                        onChange={(e) => changeFarmerLink(m, e.target.value || null)}
                        className="h-10 w-48 rounded-lg text-[12px] font-semibold"
                      >
                        <option value="">Link a farmer…</option>
                        {db.farmers.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.id} · {f.fullName}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-[12px] text-stone-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-[12px] text-stone-400">{m.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-snug text-stone-400">
        <UserCog className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Role changes take effect on that person's next sign-in. Farmers linked to a profile can only see and log
        their own harvests. <UserRound className="ml-1 h-3.5 w-3.5" />
      </p>
    </Card>
  );
}
