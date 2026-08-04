"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ClipboardPlus,
  Flag,
  LayoutGrid,
  List,
  Pencil,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  Trash2,
} from "lucide-react";
import { addLog, deleteLogs, updateLog, useDb } from "@/lib/db";
import { fmtDate, fmtDateTime, isoDaysAgo, relTime, todayISO } from "@/lib/format";
import { fmtKg } from "@/lib/rules";
import { CROPS, DISTRICTS } from "@/lib/reference";
import { STATUS_LABEL, UNIT_FACTORS, type LogStatus, type QualityGrade } from "@/lib/types";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Select, XScroll } from "@/components/ui";
import { GradeBadge, SourceChip, StatusBadge, YieldBadge } from "@/components/badges";
import { cx } from "@/lib/format";

type Unit = "KG" | "BAG" | "CRATE" | "TONNE";

export default function LogsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-stone-400">Loading harvest logs…</div>}>
      <LogsPageInner />
    </Suspense>
  );
}

function LogsPageInner() {
  const db = useDb();
  const searchParams = useSearchParams();
  const isFarmerRole = db.meta.role === "FARMER";
  const farmerScope = isFarmerRole && db.meta.demoFarmerId ? db.meta.demoFarmerId : undefined;

  // ---------------- entry form state ----------------
  const [farmerId, setFarmerId] = useState(searchParams.get("farmer") ?? farmerScope ?? "");
  const [cropType, setCropType] = useState("Maize");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<Unit>("KG");
  const [grade, setGrade] = useState<QualityGrade>("A");
  const [harvestDate, setHarvestDate] = useState(todayISO());
  const [batchId, setBatchId] = useState("");
  const [storage, setStorage] = useState("");
  const [formError, setFormError] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // ---------------- history filters ----------------
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | LogStatus>("ALL");
  const [cropFilter, setCropFilter] = useState("ALL");
  const [districtFilter, setDistrictFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState(isoDaysAgo(120));
  const [toDate, setToDate] = useState(todayISO());
  const [view, setView] = useState<"table" | "cards">("table");
  const [showFilters, setShowFilters] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(searchParams.get("focus"));

  useEffect(() => {
    const f = searchParams.get("farmer");
    if (f) setFarmerId(f);
    const foc = searchParams.get("focus");
    if (foc) setFocusId(foc);
  }, [searchParams]);

  // Phones default to the card view, much friendlier than a wide table.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setView("cards");
  }, []);

  // ---------------- filtered logs ----------------
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const farmerOf = new Map(db.farmers.map((f) => [f.id, f]));
    return db.logs
      .filter((l) => {
        if (farmerScope && l.farmerId !== farmerScope) return false;
        if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
        if (cropFilter !== "ALL" && l.cropType !== cropFilter) return false;
        if (fromDate && l.harvestDate < fromDate) return false;
        if (toDate && l.harvestDate > toDate) return false;
        const f = farmerOf.get(l.farmerId);
        if (districtFilter !== "ALL" && f?.district !== districtFilter) return false;
        if (query) {
          const hay = `${l.id} ${l.cropType} ${f?.fullName ?? ""} ${f?.phone ?? ""} ${l.batchId ?? ""}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db.logs, db.farmers, q, statusFilter, cropFilter, districtFilter, fromDate, toDate, farmerScope]);

  const farmerOptions = useMemo(
    () =>
      db.farmers
        .filter((f) => !farmerScope || f.id === farmerScope)
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [db.farmers, farmerScope]
  );

  // ---------------- actions ----------------
  function submitLog() {
    setFormError("");
    const qtyKg = (parseFloat(qty) || 0) * UNIT_FACTORS[unit];
    if (!farmerId) return setFormError("Select a farmer for this harvest.");
    if (qtyKg <= 0) return setFormError("Enter a quantity greater than zero.");
    if (!harvestDate) return setFormError("Pick a harvest date.");
    const log = addLog({
      farmerId,
      cropType,
      quantityKg: qtyKg,
      qualityGrade: grade,
      harvestDate,
      batchId: batchId || undefined,
      storageLocation: storage || undefined,
      source: isFarmerRole ? "FARMER" : "FIELD_AGENT",
    });
    setLastSaved(log.id);
    // surface a sync problem immediately instead of a silent pending pill
    try {
      const err = localStorage.getItem("roki-last-sync-error");
      if (err) setFormError(`Saved on this device, but syncing is blocked: ${err}`);
    } catch { /* ignore */ }
    setQty("");
    setBatchId("");
    setStorage("");
  }

  const [editLog, setEditLog] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  const editTarget = editLog ? db.logs.find((l) => l.id === editLog) : undefined;
  const savedLog = lastSaved ? db.logs.find((l) => l.id === lastSaved) : undefined;

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: filtered.length };
    for (const s of ["VERIFIED", "NEEDS_AUDIT", "FLAGGED"] as LogStatus[]) c[s] = filtered.filter((l) => l.status === s).length;
    return c;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-forest-900">
          {isFarmerRole ? "Log my harvest" : "Harvest Logs"}
        </h2>
        <p className="mt-0.5 text-sm text-stone-500">
          Every entry is checked instantly by the rule engine, anomalies, duplicates and yield scoring.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        {/* ------------------------------------------------ entry form */}
        {/* min-w-0 lets the history column shrink below its content width
            so the filter row wraps instead of being cut off */}
        <Card className="h-fit xl:sticky xl:top-24">
          <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
            <ClipboardPlus className="h-5 w-5 text-ochre-500" /> New produce entry
          </h3>
          <div className="space-y-4">
            <Field label={isFarmerRole ? "Farmer" : "Select farmer"} required>
              <Select value={farmerId} onChange={(e) => setFarmerId(e.target.value)} disabled={isFarmerRole}>
                <option value="">Type-ahead / search farmer…</option>
                {farmerOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.fullName}, {f.id} ({f.district})
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Crop type" required>
                <Select value={cropType} onChange={(e) => setCropType(e.target.value)}>
                  {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Harvest date" required>
                <Input type="date" value={harvestDate} max={todayISO()} onChange={(e) => setHarvestDate(e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-[1fr_130px] gap-3">
              <Field label="Quantity" required hint={unit === "KG" ? undefined : `= ${fmtKg((parseFloat(qty) || 0) * UNIT_FACTORS[unit])}`}>
                <Input type="number" min={0} step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" inputMode="decimal" />
              </Field>
              <Field label="Unit">
                <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                  <option value="KG">kg</option>
                  <option value="BAG">bags (100 kg)</option>
                  <option value="CRATE">crates (20 kg)</option>
                  <option value="TONNE">tonnes</option>
                </Select>
              </Field>
            </div>

            <Field label="Quality grade" required>
              <div className="grid grid-cols-3 gap-2">
                {(["A", "B", "REJECT"] as QualityGrade[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={cx(
                      "touch-target h-11 rounded-xl border text-[13px] font-semibold transition-colors",
                      grade === g
                        ? g === "REJECT"
                          ? "border-danger-500 bg-danger-500 text-white"
                          : g === "A"
                            ? "border-forest-700 bg-forest-800 text-white"
                            : "border-ochre-500 bg-ochre-500 text-white"
                        : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                    )}
                  >
                    {g === "A" ? "Grade A" : g === "B" ? "Grade B" : "Reject"}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Batch ID" hint="optional">
                <Input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="auto if blank" />
              </Field>
              <Field label="Storage / delivery" hint="optional">
                <Input value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="e.g. Nakasero depot" />
              </Field>
            </div>

            {formError && (
              <p className="flex items-center gap-1.5 rounded-xl bg-danger-bg px-3 py-2.5 text-[13px] font-semibold text-danger-dark">
                <AlertTriangle className="h-4 w-4" /> {formError}
              </p>
            )}

            <Button variant="accent" size="lg" className="w-full" onClick={submitLog}>
              <ShieldCheck className="h-4 w-4" /> Save & run rule checks
            </Button>

            {savedLog && (
              <div
                className={cx(
                  "rounded-xl border px-3.5 py-3 text-[13px]",
                  savedLog.status === "VERIFIED"
                    ? "border-success/30 bg-success-bg text-success-dark"
                    : savedLog.status === "NEEDS_AUDIT"
                      ? "border-warning/40 bg-warning-bg text-warning-dark"
                      : "border-danger/30 bg-danger-bg text-danger-dark"
                )}
              >
                <p className="font-bold">
                  {savedLog.id} saved · <StatusBadge status={savedLog.status} />
                </p>
                {savedLog.auditNotes.map((n, i) => (
                  <p key={i} className="mt-1 leading-snug">{n}</p>
                ))}
                {savedLog.auditNotes.length === 0 && (
                  <p className="mt-1">No rule violations, log verified clean.</p>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* ------------------------------------------------ history */}
        <div className="min-w-0 space-y-4">
          {/* filters, desktop / tablet grid */}
          <div className="hidden gap-2.5 sm:grid sm:grid-cols-2 xl:grid-cols-[1fr_150px_150px_130px_130px]">
            <FilterControls
              q={q} setQ={setQ}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              cropFilter={cropFilter} setCropFilter={setCropFilter}
              districtFilter={districtFilter} setDistrictFilter={setDistrictFilter}
              fromDate={fromDate} setFromDate={setFromDate}
              toDate={toDate} setToDate={setToDate}
            />
          </div>

          {/* filters, mobile collapsible panel */}
          <div className="sm:hidden">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex h-12 w-full items-center justify-between rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-600 active:bg-stone-50"
              aria-expanded={showFilters}
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-ochre-600" /> Filters
              </span>
              <ChevronDown className={cx("h-4 w-4 text-stone-400 transition-transform", showFilters && "rotate-180")} />
            </button>
            {showFilters && (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <FilterControls
                  q={q} setQ={setQ}
                  statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                  cropFilter={cropFilter} setCropFilter={setCropFilter}
                  districtFilter={districtFilter} setDistrictFilter={setDistrictFilter}
                  fromDate={fromDate} setFromDate={setFromDate}
                  toDate={toDate} setToDate={setToDate}
                />
              </div>
            )}
          </div>

          {/* status chips + view toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", "VERIFIED", "NEEDS_AUDIT", "FLAGGED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s as "ALL" | LogStatus)}
                  className={cx(
                    "h-9 rounded-full px-3.5 text-[12px] font-semibold transition-colors",
                    statusFilter === s
                      ? s === "ALL"
                        ? "bg-forest-800 text-white"
                        : s === "NEEDS_AUDIT"
                          ? "bg-warning-500 text-white"
                          : s === "FLAGGED"
                            ? "bg-danger-500 text-white"
                            : "bg-success-500 text-white"
                      : "bg-white text-stone-500 ring-1 ring-stone-200 hover:bg-stone-50"
                  )}
                >
                  {s === "ALL" ? "All" : STATUS_LABEL[s]} · {statusCounts[s]}
                </button>
              ))}
            </div>
            <div className="flex rounded-xl border border-stone-200 bg-white p-0.5">
              <button onClick={() => setView("table")} className={cx("grid h-9 w-9 place-items-center rounded-lg", view === "table" ? "bg-forest-50 text-forest-800" : "text-stone-400")} aria-label="Table view">
                <List className="h-4 w-4" />
              </button>
              <button onClick={() => setView("cards")} className={cx("grid h-9 w-9 place-items-center rounded-lg", view === "cards" ? "bg-forest-50 text-forest-800" : "text-stone-400")} aria-label="Card view">
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Sprout className="h-6 w-6" />}
              title="No harvest logs match"
              description="Adjust the filters, or log a new harvest on the left."
            />
          ) : view === "table" ? (
            <Card className="overflow-hidden p-0">
              <XScroll>
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/60 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                      <th className="py-3 pr-4 pl-4">Log</th>
                      <th className="py-3 pr-4">Farmer</th>
                      <th className="py-3 pr-4">Crop</th>
                      <th className="py-3 pr-4 text-right">Qty</th>
                      <th className="py-3 pr-4">Grade</th>
                      <th className="py-3 pr-4">Harvested</th>
                      <th className="py-3 pr-4">Yield</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Source</th>
                      <th className="py-3 pr-4">Logged</th>
                      <th className="py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filtered.map((l) => (
                      <tr
                        key={l.id}
                        className={cx("hover:bg-stone-50/60", focusId === l.id && "bg-warning-bg/50 ring-2 ring-inset ring-warning-400/60")}
                      >
                        <td className="py-3 pr-4 pl-4 font-mono text-[12px] text-stone-400">{l.id}</td>
                        <td className="py-3 pr-4">
                          {isFarmerRole ? (
                            <span className="font-semibold text-stone-700">{farmerName(db, l.farmerId)}</span>
                          ) : (
                            <Link href={`/farmers/${l.farmerId}`} className="font-semibold text-forest-800 hover:underline">
                              {farmerName(db, l.farmerId)}
                            </Link>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-stone-700">{l.cropType}</td>
                        <td className="py-3 pr-4 text-right font-semibold tabular">{fmtKg(l.quantityKg)}</td>
                        <td className="py-3 pr-4"><GradeBadge grade={l.qualityGrade} /></td>
                        <td className="py-3 pr-4 text-stone-500">{fmtDate(l.harvestDate)}</td>
                        <td className="py-3 pr-4"><YieldBadge score={l.yieldScore} /></td>
                        <td className="py-3 pr-4"><StatusBadge status={l.status} /></td>
                        <td className="py-3 pr-4"><SourceChip source={l.source} /></td>
                        <td className="py-3 pr-4 text-stone-400">{relTime(l.createdAt)}</td>
                        <td className="py-3 pr-2">
                          <div className="flex gap-1">
                            <button onClick={() => setEditLog(l.id)} className="grid h-9 w-9 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-forest-800" aria-label="Edit log">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleteIds([l.id])} className="grid h-9 w-9 place-items-center rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600" aria-label="Delete log">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </XScroll>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((l) => (
                <Card key={l.id} className={cx("p-4", focusId === l.id && "ring-2 ring-warning-400")}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-stone-800">{farmerName(db, l.farmerId)}</p>
                      <p className="font-mono text-[11px] text-stone-400">{l.id}</p>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-stone-600">
                    <span className="font-bold text-forest-800">{l.cropType}</span>
                    <span className="tabular">{fmtKg(l.quantityKg)}</span>
                    <GradeBadge grade={l.qualityGrade} />
                    <YieldBadge score={l.yieldScore} />
                  </div>
                  <p className="mt-2 text-[12px] text-stone-400">
                    Harvested {fmtDate(l.harvestDate)} · logged {relTime(l.createdAt)} · {l.storageLocation ?? "no location"}
                  </p>
                  {l.auditNotes.length > 0 && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning-bg/60 px-2.5 py-2 text-[12px] leading-snug text-warning-dark">
                      <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {l.auditNotes[0]}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* edit modal */}
      {editTarget && (
        <EditLogModal
          logId={editTarget.id}
          onClose={() => setEditLog(null)}
          defaultCrop={editTarget.cropType}
          defaultQty={editTarget.quantityKg}
          defaultGrade={editTarget.qualityGrade}
          defaultDate={editTarget.harvestDate}
          defaultBatch={editTarget.batchId ?? ""}
          defaultStorage={editTarget.storageLocation ?? ""}
          onSave={(patch) => {
            updateLog(editTarget.id, patch);
            setEditLog(null);
          }}
        />
      )}

      <ConfirmDialog
        open={deleteIds.length > 0}
        onClose={() => setDeleteIds([])}
        onConfirm={() => deleteLogs(deleteIds)}
        danger
        title="Delete harvest log(s)?"
        confirmLabel="Delete"
        message={`This permanently removes ${deleteIds.length} log${deleteIds.length === 1 ? "" : "s"}.`}
      />
    </div>
  );
}

function farmerName(db: ReturnType<typeof useDb>, id: string): string {
  return db.farmers.find((f) => f.id === id)?.fullName ?? "Unknown farmer";
}

// ------------------------------------------------------------------
// Shared filter controls (desktop grid / mobile collapsible panel)
// ------------------------------------------------------------------
function FilterControls({
  q, setQ,
  statusFilter, setStatusFilter,
  cropFilter, setCropFilter,
  districtFilter, setDistrictFilter,
  fromDate, setFromDate,
  toDate, setToDate,
}: {
  q: string; setQ: (v: string) => void;
  statusFilter: "ALL" | LogStatus; setStatusFilter: (v: "ALL" | LogStatus) => void;
  cropFilter: string; setCropFilter: (v: string) => void;
  districtFilter: string; setDistrictFilter: (v: string) => void;
  fromDate: string; setFromDate: (v: string) => void;
  toDate: string; setToDate: (v: string) => void;
}) {
  return (
    <>
      <div className="relative col-span-2 2xl:col-span-1">
        <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search farmer, ID, crop…" className="pl-9" />
      </div>
      <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | LogStatus)}>
        <option value="ALL">All statuses</option>
        <option value="VERIFIED">Verified</option>
        <option value="NEEDS_AUDIT">Needs audit</option>
        <option value="FLAGGED">Flagged</option>
      </Select>
      <Select value={cropFilter} onChange={(e) => setCropFilter(e.target.value)}>
        <option value="ALL">All crops</option>
        {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
      <Select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
        <option value="ALL">All districts</option>
        {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
      </Select>
      <div className="col-span-2 flex gap-2 2xl:col-span-1">
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" />
      </div>
    </>
  );
}

// ------------------------------------------------------------------
// Inline edit modal for a single log, re-runs the rule engine on save
// ------------------------------------------------------------------
function EditLogModal({
  logId,
  onClose,
  defaultCrop,
  defaultQty,
  defaultGrade,
  defaultDate,
  defaultBatch,
  defaultStorage,
  onSave,
}: {
  logId: string;
  onClose: () => void;
  defaultCrop: string;
  defaultQty: number;
  defaultGrade: QualityGrade;
  defaultDate: string;
  defaultBatch: string;
  defaultStorage: string;
  onSave: (patch: { cropType: string; quantityKg: number; qualityGrade: QualityGrade; harvestDate: string; batchId: string; storageLocation: string }) => void;
}) {
  const [crop, setCrop] = useState(defaultCrop);
  const [qty, setQty] = useState(String(defaultQty));
  const [grade, setGrade] = useState<QualityGrade>(defaultGrade);
  const [date, setDate] = useState(defaultDate);
  const [batch, setBatch] = useState(defaultBatch);
  const [storage, setStorage] = useState(defaultStorage);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${logId}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave({ cropType: crop, quantityKg: parseFloat(qty) || 0, qualityGrade: grade, harvestDate: date, batchId: batch, storageLocation: storage })}>
            Save & re-check rules
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Crop">
            <Select value={crop} onChange={(e) => setCrop(e.target.value)}>
              {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Quantity (kg)">
            <Input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grade">
            <Select value={grade} onChange={(e) => setGrade(e.target.value as QualityGrade)}>
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="REJECT">Reject</option>
            </Select>
          </Field>
          <Field label="Harvest date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Batch ID">
            <Input value={batch} onChange={(e) => setBatch(e.target.value)} />
          </Field>
          <Field label="Storage / delivery">
            <Input value={storage} onChange={(e) => setStorage(e.target.value)} />
          </Field>
        </div>
        <p className="flex items-center gap-1.5 rounded-xl bg-forest-50 px-3 py-2.5 text-[12px] font-medium text-forest-800">
          <Boxes className="h-4 w-4 shrink-0" />
          Saving re-runs the deterministic rule engine: yield ceiling, duplicate guard and yield scoring.
        </p>
      </div>
    </Modal>
  );
}
