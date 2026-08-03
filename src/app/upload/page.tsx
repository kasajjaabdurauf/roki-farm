"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  RefreshCw,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { importStaging, useDb, type ImportSummary } from "@/lib/db";
import { buildStaging, parseFile, reStage, stageFieldLabel, STAGE_FIELDS, type ParsedFile } from "@/lib/sheet";
import type { StagingState, StageField } from "@/lib/types";
import { downloadCSV, downloadText, stamp } from "@/lib/export";
import { Button, Card, EmptyState, Modal, Select } from "@/components/ui";
import { cx } from "@/lib/format";
import { fmtKg } from "@/lib/rules";

export default function UploadPage() {
  const db = useDb();
  const [stage, setStage] = useState<StagingState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const nameOf = useMemo(() => {
    const m = new Map(db.farmers.map((f) => [f.id, f.fullName]));
    return (id: string) => m.get(id);
  }, [db.farmers]);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setParseError("");
    try {
      const parsed: ParsedFile = await parseFile(file);
      setStage(buildStaging(parsed, db));
    } catch {
      setParseError("Could not read that file. Please upload a .xlsx, .xls or .csv spreadsheet.");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function updateMapping(index: number, target: StageField) {
    if (!stage) return;
    const columns = stage.columns.map((c, i) =>
      i === index ? { ...c, target, autoDetected: false } : c
    );
    setStage(reStage(stage, columns, db));
  }

  const validCount = stage ? stage.rows.filter((r) => r.errors.length === 0).length : 0;
  const newFarmerCount = stage ? stage.rows.filter((r) => r.errors.length === 0 && !r.farmerId).length : 0;
  const logRowCount = stage ? stage.rows.filter((r) => r.isLogRow && r.errors.length === 0).length : 0;

  function downloadSample() {
    const sample = [
      ["Farmer Name", "Phone", "District", "Sub-County", "Crop", "Harvest Date", "Qty (Kg)", "Grade", "Batch ID"],
      ["Aisha Namukwaya", "0772 456 123", "Wakiso", "Nansana", "Maize", "2026-07-28", "1450", "A", "B-20260728-101"],
      ["John Bosco Okello", "+256702111222", "Gulu", "Pece", "Groundnuts", "2026-07-25", "600", "B", ""],
      ["Grace Achieng", "0755 000 111", "Lira", "Erute", "Millet", "2026-07-22", "820", "A", "B-20260722-104"],
      ["Moses Ssemanda", "0789 333 444", "Mukono", "Nama", "Bananas", "2026-07-20", "4500", "A", ""],
      ["Invalid Phone Row", "077X 12 345", "Kampala", "Rubaga", "Maize", "2026-07-18", "900", "B", ""],
      ["Sarah Nakanwagi", "0701 555 666", "Kampala", "Nakawa", "Vegetables", "2026-07-15", "-5", "A", ""],
      ["Peter Odongo", "0773 777 888", "Soroti", "Arapai", "Maize", "2026-07-12", "3000", "A", "B-20260712-110"],
    ];
    downloadText(
      sample.map((r) => r.map((c) => `"${c}"`).join(",")).join("\r\n"),
      `jfl-sample-upload-${stamp("csv")}.csv`
    );
  }

  function reset() {
    setStage(null);
    setSummary(null);
    setParseError("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-forest-900">Bulk Upload & Mapping</h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Drop an <b>.xlsx / .xls / .csv</b> file, columns are auto-mapped (Tel → phone, Qty (Kg) → quantity…), staged for review, then imported.
          </p>
        </div>
        <Button variant="outline" onClick={downloadSample}>
          <Download className="h-4 w-4" /> Download sample file
        </Button>
      </div>

      {!stage ? (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cx(
              "flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-20 text-center transition-colors",
              dragOver ? "border-forest-600 bg-forest-50" : "border-stone-300 bg-white hover:border-forest-400 hover:bg-forest-50/40"
            )}
          >
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-forest-800 text-white">
              <UploadCloud className="h-8 w-8" />
            </div>
            <p className="font-display text-xl font-semibold text-forest-900">
              Drag & drop your spreadsheet here
            </p>
            <p className="mt-1 text-sm text-stone-500">or tap to browse, .xlsx, .xls, .csv up to 10 MB</p>
            <p className="mt-4 max-w-md text-[12px] leading-relaxed text-stone-400">
              Rules handle the rest: flexible column auto-mapping, Ugandan phone validation (MTN / Airtel),
              negative-yield detection, duplicate suspicion and farmer association by ID or phone.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          {parseError && (
            <p className="flex items-center gap-2 rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-dark">
              <XCircle className="h-4 w-4" /> {parseError}
            </p>
          )}
        </>
      ) : (
        <>
          {/* file banner */}
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest-50 text-forest-700">
                <FileSpreadsheet className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-stone-800">{stage.fileName}</p>
                <p className="text-[12px] text-stone-400">
                  Sheet “{stage.sheetName}” · {stage.rows.length} data rows · {stage.columns.length} columns
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={reset}><RefreshCw className="h-4 w-4" /> New file</Button>
              <Button
                variant="accent"
                size="lg"
                disabled={validCount === 0}
                onClick={() => setSummary(importStaging(stage))}
              >
                <CheckCircle2 className="h-4 w-4" />
                Import {validCount} valid row{validCount === 1 ? "" : "s"}
              </Button>
            </div>
          </Card>

          {/* validation summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile label="Valid rows" value={validCount} tone="text-success-dark bg-success-bg" />
            <SummaryTile label="Rows with errors" value={stage.rows.length - validCount} tone="text-danger-dark bg-danger-bg" />
            <SummaryTile label="New farmer profiles" value={newFarmerCount} tone="text-forest-800 bg-forest-50" />
            <SummaryTile label="Produce logs to create" value={logRowCount} tone="text-ochre-700 bg-ochre-50" />
          </div>

          {/* column mapper */}
          <Card>
            <h3 className="mb-1 font-display text-lg font-semibold text-forest-900">Column mapping</h3>
            <p className="mb-4 text-[13px] text-stone-500">
              Auto-detected by the rule engine, override any column with the dropdowns.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {stage.columns.map((col, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-stone-700" title={col.sourceHeader}>
                    {col.sourceHeader || "(empty header)"}
                  </span>
                  {col.autoDetected ? (
                    <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-forest-700 uppercase">auto</span>
                  ) : null}
                  <Select
                    value={col.target}
                    onChange={(e) => updateMapping(i, e.target.value as StageField)}
                    className="h-9 w-[190px] rounded-lg text-[12px] font-semibold"
                  >
                    {STAGE_FIELDS.map((f) => (
                      <option key={f} value={f}>{stageFieldLabel(f)}</option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </Card>

          {/* staging grid */}
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-1 border-b border-stone-100 px-5 py-4">
              <h3 className="font-display text-lg font-semibold text-forest-900">Staging preview</h3>
              <p className="text-[12px] text-stone-400">
                <span className="sm:hidden">← swipe → · </span>
                First {Math.min(stage.rows.length, 20)} of {stage.rows.length} rows · errors in red are excluded
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                    <th className="py-2.5 pr-3 pl-4 w-16">Row</th>
                    {stage.columns.filter((c) => c.target !== "ignore").map((c, i) => (
                      <th key={i} className="max-w-[180px] truncate py-2.5 pr-3" title={c.sourceHeader}>
                        {stageFieldLabel(c.target)}
                      </th>
                    ))}
                    <th className="py-2.5 pr-4">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {stage.rows.slice(0, 20).map((row) => {
                    const cols = stage.columns.filter((c) => c.target !== "ignore");
                    const isOpen = expanded.has(row.key);
                    const hasErrors = row.errors.length > 0;
                    return (
                      <StagingRowGroup
                        key={row.key}
                        row={row}
                        cols={cols}
                        isOpen={isOpen}
                        hasErrors={hasErrors}
                        nameOf={nameOf}
                        onToggle={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.key)) next.delete(row.key);
                            else next.add(row.key);
                            return next;
                          })
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            {stage.rows.length > 20 && (
              <p className="border-t border-stone-100 px-5 py-3 text-[12px] text-stone-400">
                +{stage.rows.length - 20} more rows, all are included in the import; only rows with errors are skipped.
              </p>
            )}
          </Card>
        </>
      )}

      {/* import summary modal */}
      <Modal
        open={summary !== null}
        onClose={() => { setSummary(null); setStage(null); }}
        title="Import complete"
        footer={
          <Button variant="primary" onClick={() => { setSummary(null); setStage(null); }}>Done</Button>
        }
        wide
      >
        {summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryTile label="Farmers created" value={summary.createdFarmers} tone="text-forest-800 bg-forest-50" />
              <SummaryTile label="Linked to existing" value={summary.linkedExisting} tone="text-forest-800 bg-forest-50" />
              <SummaryTile label="Logs created" value={summary.createdLogs} tone="text-ochre-700 bg-ochre-50" />
              <SummaryTile label="Skipped (errors)" value={summary.skippedWithErrors} tone="text-danger-dark bg-danger-bg" />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-stone-200">
              <ul className="divide-y divide-stone-100">
                {summary.results.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 px-3.5 py-2.5 text-[13px]">
                    {r.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-500" />
                    )}
                    <span className="min-w-0 flex-1 text-stone-600">
                      <span className="font-mono text-[11px] text-stone-400">Row {r.row}:</span> {r.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[12px] text-stone-400">
              {summary.warnings} warning{summary.warnings === 1 ? "" : "s"} noted. Every imported log was checked by the rule engine, flagged items appear in the dashboard.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cx("rounded-2xl px-4 py-3.5", tone.split(" ")[1])}>
      <p className={cx("font-display text-2xl font-bold tabular", tone.split(" ")[0])}>{value.toLocaleString()}</p>
      <p className={cx("text-[12px] font-semibold", tone.split(" ")[0])}>{label}</p>
    </div>
  );
}

function StagingRowGroup({
  row,
  cols,
  isOpen,
  hasErrors,
  nameOf,
  onToggle,
}: {
  row: StagingState["rows"][number];
  cols: { sourceIndex: number; target: StageField }[];
  isOpen: boolean;
  hasErrors: boolean;
  nameOf: (id: string) => string | undefined;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={cx(hasErrors ? "bg-danger-bg/40" : "hover:bg-stone-50/60")}>
        <td className="py-2.5 pr-3 pl-4">
          <button onClick={onToggle} className="flex items-center gap-1 font-mono text-[11px] font-semibold text-stone-400 hover:text-forest-800">
            {hasErrors ? (
              <AlertTriangle className="h-3.5 w-3.5 text-danger-500" />
            ) : (
              isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            )}
            {row.rowIndex}
          </button>
        </td>
        {cols.map((c, i) => (
          <td key={i} className="max-w-[180px] truncate py-2.5 pr-3 text-stone-700">
            {formatCell(row, c.target)}
          </td>
        ))}
        <td className="py-2.5 pr-4">
          {row.farmerId ? (
            <span className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full bg-forest-50 px-2 py-1 text-[11px] font-semibold text-forest-800">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              {nameOf(row.farmerId) ?? row.farmerId}
            </span>
          ) : hasErrors ? (
            <span className="text-[11px] font-bold text-danger-600">{row.errors.length} error{row.errors.length === 1 ? "" : "s"}</span>
          ) : (
            <span className="rounded-full bg-ochre-50 px-2 py-1 text-[11px] font-bold text-ochre-700">🆕 New farmer</span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className={cx("bg-stone-50/70", hasErrors && "bg-danger-bg/20")}>
          <td colSpan={cols.length + 2} className="px-4 py-3">
            <div className="space-y-1.5 text-[12.5px]">
              {row.errors.map((e, i) => (
                <p key={i} className="flex items-start gap-1.5 font-semibold text-danger-600">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e}
                </p>
              ))}
              {row.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-1.5 font-medium text-warning-dark">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                </p>
              ))}
              {row.errors.length === 0 && row.warnings.length === 0 && (
                <p className="font-medium text-success-dark">✓ Row passes all validation rules.</p>
              )}
              {row.resolveNote && <p className="text-stone-500">🔗 {row.resolveNote}</p>}
              {row.isLogRow && !hasErrors && (
                <p className="text-stone-500">📦 Carries produce data → will create a harvest log (with farmer {row.farmerId ? "link" : "profile"}).</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function formatCell(row: StagingState["rows"][number], target: StageField): string {
  const v = row.parsed[target];
  if (target === "quantityKg" && typeof v === "number") return `${v.toLocaleString()} kg`;
  if (target === "acreage" && typeof v === "number") return `${v.toLocaleString()} ac`;
  if (v === undefined || v === "") return "N/A";
  return String(v);
}
