"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Download, PackageSearch, Sprout, TrendingUp, Users } from "lucide-react";
import { useDb } from "@/lib/db";
import { downloadCSV, downloadXLSX, stamp, type ExportColumn } from "@/lib/export";
import { MONTHS } from "@/lib/reference";
import { Button, Card, EmptyState, Stat } from "@/components/ui";
import { RokiTierBadge } from "@/components/badges";
import { cx } from "@/lib/format";

interface ForecastRow {
  crop: string;
  farmers: number;
  tier1Farmers: number;
  expectedKg: number;
  windowLabel: string;
  windowStart: number;
  windowEnd: number;
}

function fmtWindow(start: number, end: number): string {
  if (start === end) return MONTHS[start - 1];
  if (start < end) return `${MONTHS[start - 1]}–${MONTHS[end - 1]}`;
  return `${MONTHS[start - 1]}–${MONTHS[end - 1]}`; // wraps across year (e.g. Nov–Jan)
}

export default function ForecastPage() {
  const db = useDb();

  const rows = useMemo<ForecastRow[]>(() => {
    const byCrop = new Map<string, { farmers: Set<string>; tier1: Set<string>; kg: number; starts: number[]; ends: number[] }>();
    for (const f of db.farmers) {
      for (const p of f.plannedProductions) {
        if (!p.crop) continue;
        const entry = byCrop.get(p.crop) ?? { farmers: new Set<string>(), tier1: new Set<string>(), kg: 0, starts: [], ends: [] };
        entry.farmers.add(f.id);
        if (f.rokiTier === 1) entry.tier1.add(f.id);
        entry.kg += p.expectedVolumeKg || 0;
        entry.starts.push(p.harvestStartMonth);
        entry.ends.push(p.harvestEndMonth);
        byCrop.set(p.crop, entry);
      }
    }
    return [...byCrop.entries()]
      .map(([crop, e]) => ({
        crop,
        farmers: e.farmers.size,
        tier1Farmers: e.tier1.size,
        expectedKg: e.kg,
        windowStart: Math.min(...e.starts),
        windowEnd: Math.max(...e.ends),
        windowLabel: fmtWindow(Math.min(...e.starts), Math.max(...e.ends)),
      }))
      .sort((a, b) => b.expectedKg - a.expectedKg);
  }, [db.farmers]);

  const totals = useMemo(
    () => ({
      farmers: new Set(db.farmers.filter((f) => f.plannedProductions.length > 0).map((f) => f.id)).size,
      crops: rows.length,
      tonnes: rows.reduce((s, r) => s + r.expectedKg, 0) / 1000,
    }),
    [rows, db.farmers]
  );

  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  function doExport(kind: "csv" | "xlsx") {
    setExporting(kind);
    const cols: ExportColumn[] = [
      { key: "crop", label: "Crop" },
      { key: "farmers", label: "Farmers Producing" },
      { key: "tier1Farmers", label: "Export-Ready Farmers (Tier 1)" },
      { key: "expectedT", label: "Expected Volume (MT)", value: (r) => +(r.expectedKg / 1000).toFixed(1) },
      { key: "windowLabel", label: "Harvest Period" },
    ];
    const name = `roki-production-forecast-${stamp("forecast")}`;
    if (kind === "csv") downloadCSV(rows, cols, `${name}.csv`);
    else downloadXLSX(rows, cols, `${name}.xlsx`);
    setTimeout(() => setExporting(null), 300);
  }

  const maxKg = rows[0]?.expectedKg ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-forest-900">Production Forecast</h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Built from every farmer&apos;s registration survey — who grows what, expected volumes and harvest periods.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => doExport("csv")} disabled={exporting !== null}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => doExport("xlsx")} disabled={exporting !== null}>
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Farmers with plans" value={totals.farmers.toLocaleString()} icon={<Users className="h-5 w-5" />} />
        <Stat label="Crops planned" value={totals.crops} icon={<Sprout className="h-5 w-5" />} />
        <Stat label="Expected volume" value={`${totals.tonnes.toLocaleString(undefined, { maximumFractionDigits: 0 })} t`} icon={<TrendingUp className="h-5 w-5" />} tone="ochre" />
        <Stat label="Forecast horizon" value={`${fmtWindow(Math.min(...rows.map((r) => r.windowStart), 1), Math.max(...rows.map((r) => r.windowEnd), 12))}`} icon={<CalendarRange className="h-5 w-5" />} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-6 w-6" />}
          title="No production plans yet"
          description="Production forecasts appear once farmers complete their registration surveys with a production plan."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <p className="border-b border-stone-100 bg-forest-50/50 px-4 py-2 text-center text-[11px] font-semibold text-forest-700 sm:hidden">
            ← Swipe sideways to see all columns →
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                  <th className="py-3 pr-4 pl-4">Crop</th>
                  <th className="py-3 pr-4">Farmers producing</th>
                  <th className="py-3 pr-4">Export-ready</th>
                  <th className="py-3 pr-4 text-right">Expected volume</th>
                  <th className="py-3 pr-4">Harvest period</th>
                  <th className="py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((r) => (
                  <tr key={r.crop} className="hover:bg-stone-50/60">
                    <td className="py-3 pr-4 pl-4 font-semibold text-stone-800">{r.crop}</td>
                    <td className="py-3 pr-4 font-semibold text-stone-700 tabular">{r.farmers}</td>
                    <td className="py-3 pr-4">
                      <span className="tabular">{r.tier1Farmers}</span>
                    </td>
                    <td className="py-3 pr-4 text-right font-bold text-forest-800 tabular">
                      {(r.expectedKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} t
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ochre-50 px-2.5 py-1 text-[11px] font-bold text-ochre-700">
                        <CalendarRange className="h-3 w-3" /> {r.windowLabel}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-stone-100 md:block">
                        <div className="h-full rounded-full bg-gradient-to-r from-ochre-500 to-ochre-600" style={{ width: `${(r.expectedKg / maxKg) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className={cx("min-w-0")}>
        <h3 className="mb-2 font-display text-lg font-semibold text-forest-900">How this is calculated</h3>
        <p className="text-[13px] leading-relaxed text-stone-500">
          Expected volumes come from the <b>production plans</b> captured in each farmer&apos;s registration survey
          (crop × acres × expected yield per acre, with farmer-confirmed overrides). Harvest periods aggregate the
          months each farmer expects to harvest. Volumes are indicative for planning — the <b>Export Supply Planning</b>{" "}
          tab shows the individual farmers behind every number, and harvest logs confirm actuals as the season runs.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rows.slice(0, 8).map((r) => (
            <span key={r.crop} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">
              <Sprout className="h-3 w-3 text-forest-700" /> {r.crop}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
