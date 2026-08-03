"use client";

import { useMemo, useState } from "react";
import {
  Database,
  Download,
  HardDrive,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { resetDemoData, syncNow, updateCropDefaults, updateSettings, useDb } from "@/lib/db";
import { downloadCSV, downloadMasterBackup, downloadXLSX, stamp, type ExportColumn } from "@/lib/export";
import { fmtDateTime } from "@/lib/format";
import { CROPS } from "@/lib/reference";
import { remoteConfigured } from "@/lib/remote";
import { TIER_LABEL } from "@/lib/types";
import { Button, Card, ConfirmDialog, Input, Toggle } from "@/components/ui";
import { PwaHint } from "@/components/layout";

export default function SettingsPage() {
  const db = useDb();
  const [q, setQ] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const storageSize = useMemo(() => {
    try {
      const raw = localStorage.getItem("jfl-db-v1") ?? "";
      return `${(raw.length / 1024).toFixed(0)} KB`;
    } catch {
      return "—";
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
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-stone-200">
            <table className="w-full text-left text-[13px]">
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
              <Database className="h-4 w-4 text-stone-400" /> {remoteConfigured() ? "Cloud + local (Supabase)" : "Local database (demo mode)"}
            </p>
            <p className="mt-1 mb-3 text-[12.5px] leading-relaxed text-stone-500">
              {remoteConfigured()
                ? "All changes are pushed to Supabase automatically and pulled on sign-in. The local copy keeps the app fast and offline-capable."
                : "No Supabase keys configured — data lives only on this device. Set NEXT_PUBLIC_SUPABASE_URL / ANON_KEY to go live."}
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
              <b>{storageSize}</b> on this device. Data lives in the browser (offline-first) — the repository layer in{" "}
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
            </div>
            <p className="mt-2 text-[11.5px] text-stone-400">
              Master backup = one workbook with Farmers + Harvest Logs sheets (surveys and plans included).
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
          <PwaHint />
          <Button variant="ghost" className="text-danger-600 hover:bg-danger-50" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="h-4 w-4" /> Reset demo data
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetDemoData}
        danger
        title="Reset all data?"
        confirmLabel="Reset everything"
        message="This wipes all farmers, logs and settings on this device and restores the original demo dataset."
      />
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
