"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, Download, MapPin, Search, Truck } from "lucide-react";
import { useDb } from "@/lib/db";
import { downloadCSV, downloadXLSX, stamp, type ExportColumn } from "@/lib/export";
import { DISTRICTS, MONTHS } from "@/lib/reference";
import { REFUGEE_LABEL, type RokiTier } from "@/lib/types";
import { Button, Card, EmptyState, Input, Select } from "@/components/ui";
import { RokiTierBadge } from "@/components/badges";
import { cx } from "@/lib/format";

interface SupplyRow {
  farmerId: string;
  farmerName: string;
  district: string;
  subCounty: string;
  tier: RokiTier;
  refugee: string;
  crop: string;
  acres: number;
  expectedKg: number;
  startMonth: number;
  endMonth: number;
}

export default function SupplyPage() {
  const db = useDb();
  const [q, setQ] = useState("");
  const [crop, setCrop] = useState("ALL");
  const [district, setDistrict] = useState("ALL");
  const [tier, setTier] = useState<"ALL" | RokiTier>("ALL");

  const rows = useMemo<SupplyRow[]>(() => {
    const out: SupplyRow[] = [];
    for (const f of db.farmers) {
      for (const p of f.plannedProductions) {
        if (!p.crop) continue;
        out.push({
          farmerId: f.id,
          farmerName: f.fullName,
          district: f.district,
          subCounty: f.subCounty,
          tier: f.rokiTier,
          refugee: REFUGEE_LABEL[f.refugeeStatus],
          crop: p.crop,
          acres: p.acres,
          expectedKg: p.expectedVolumeKg,
          startMonth: p.harvestStartMonth,
          endMonth: p.harvestEndMonth,
        });
      }
    }
    return out.sort((a, b) => a.crop.localeCompare(b.crop) || b.expectedKg - a.expectedKg);
  }, [db.farmers]);

  const crops = useMemo(() => [...new Set(rows.map((r) => r.crop))].sort(), [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (crop !== "ALL" && r.crop !== crop) return false;
      if (district !== "ALL" && r.district !== district) return false;
      if (tier !== "ALL" && r.tier !== tier) return false;
      if (query) {
        const hay = `${r.farmerName} ${r.farmerId} ${r.district} ${r.subCounty} ${r.crop}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, q, crop, district, tier]);

  const tonnes = filtered.reduce((s, r) => s + r.expectedKg, 0) / 1000;

  function doExport(kind: "csv" | "xlsx") {
    const cols: ExportColumn[] = [
      { key: "farmerId", label: "Farmer ID" },
      { key: "farmerName", label: "Farmer Name" },
      { key: "district", label: "District" },
      { key: "subCounty", label: "Sub-County" },
      { key: "tier", label: "Roki Tier", value: (r) => `Tier ${r.tier}` },
      { key: "refugee", label: "Community" },
      { key: "crop", label: "Crop" },
      { key: "acres", label: "Acres Planted" },
      { key: "expectedT", label: "Expected Volume (MT)", value: (r) => +(r.expectedKg / 1000).toFixed(2) },
      { key: "window", label: "Harvest Window", value: (r) => `${MONTHS[r.startMonth - 1]}–${MONTHS[r.endMonth - 1]}` },
    ];
    const name = `roki-export-supply-${stamp("supply")}`;
    if (kind === "csv") downloadCSV(filtered, cols, `${name}.csv`);
    else downloadXLSX(filtered, cols, `${name}.xlsx`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-forest-900">Export Supply Planning</h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Roki knows who has what crop, where farms are, expected harvest dates and available volumes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => doExport("csv")}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => doExport("xlsx")}>
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      {/* filters */}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[1fr_170px_170px_160px]">
        <div className="relative">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search farmer, ID, location…" className="pl-9" />
        </div>
        <Select value={crop} onChange={(e) => setCrop(e.target.value)}>
          <option value="ALL">All crops</option>
          {crops.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="ALL">All districts</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
        <Select value={String(tier)} onChange={(e) => setTier(e.target.value === "ALL" ? "ALL" : (Number(e.target.value) as RokiTier))}>
          <option value="ALL">All tiers</option>
          <option value="1">Tier 1 · Export-ready</option>
          <option value="2">Tier 2 · Developing</option>
          <option value="3">Tier 3 · New</option>
        </Select>
      </div>

      <p className="text-[13px] font-semibold text-stone-500">
        {filtered.length} supply line{filtered.length === 1 ? "" : "s"} · ≈{" "}
        <span className="text-forest-800 tabular">{tonnes.toLocaleString(undefined, { maximumFractionDigits: 0 })} t</span> expected
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-6 w-6" />}
          title="No supply lines match"
          description="Adjust filters, or complete production plans in farmer surveys to build supply."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <p className="border-b border-stone-100 bg-forest-50/50 px-4 py-2 text-center text-[11px] font-semibold text-forest-700 sm:hidden">
            ← Swipe sideways to see all columns →
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                  <th className="py-3 pr-4 pl-4">Farmer</th>
                  <th className="py-3 pr-4">Tier</th>
                  <th className="py-3 pr-4">Location</th>
                  <th className="py-3 pr-4">Crop</th>
                  <th className="py-3 pr-4 text-right">Acres</th>
                  <th className="py-3 pr-4 text-right">Volume</th>
                  <th className="py-3 pr-4">Harvest window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-stone-50/60">
                    <td className="py-3 pr-4 pl-4">
                      <Link href={`/farmers/${r.farmerId}`} className="font-semibold text-forest-800 hover:underline">
                        {r.farmerName}
                      </Link>
                      <p className="font-mono text-[11px] text-stone-400">{r.farmerId}</p>
                    </td>
                    <td className="py-3 pr-4"><RokiTierBadge tier={r.tier} /></td>
                    <td className="py-3 pr-4">
                      <p className="flex items-center gap-1 text-[13px] text-stone-600">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-ochre-500" /> {r.subCounty}, {r.district}
                      </p>
                      <p className="text-[11px] text-stone-400">{r.refugee}</p>
                    </td>
                    <td className="py-3 pr-4 font-semibold text-stone-800">{r.crop}</td>
                    <td className="py-3 pr-4 text-right text-stone-600 tabular">{r.acres.toFixed(1)}</td>
                    <td className="py-3 pr-4 text-right font-bold text-forest-800 tabular">{(r.expectedKg / 1000).toFixed(1)} t</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ochre-50 px-2.5 py-1 text-[11px] font-bold text-ochre-700">
                        <CalendarRange className="h-3 w-3" />
                        {MONTHS[r.startMonth - 1]}–{MONTHS[r.endMonth - 1]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className={cx("min-w-0")}>
        <h3 className="mb-1 font-display text-lg font-semibold text-forest-900">Planning checklist</h3>
        <ul className="list-inside list-disc space-y-1 text-[13px] leading-relaxed text-stone-500">
          <li>Use the <b>Tier 1</b> filter to shortlist export-ready farmers for contract volumes.</li>
          <li>Group by <b>crop + harvest window</b> to plan collection routes and cold-chain capacity.</li>
          <li>Volumes update automatically as surveys are completed and harvest logs confirm actuals.</li>
        </ul>
      </Card>
    </div>
  );
}
