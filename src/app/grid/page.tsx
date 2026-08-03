"use client";

import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  createColumnHelper,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Users,
  UserX,
  Wheat,
} from "lucide-react";
import {
  deleteFarmers,
  deleteLogs,
  reassignLogs,
  updateFarmer,
  updateLog,
  useDb,
} from "@/lib/db";
import { downloadCSV, downloadXLSX, stamp, type ExportColumn } from "@/lib/export";
import { fmtDate, fmtDateTime, cx } from "@/lib/format";
import { normalizeUgPhone } from "@/lib/phone";
import { CROPS, DISTRICTS } from "@/lib/reference";
import { fmtKg } from "@/lib/rules";
import {
  GRADE_LABEL,
  STATUS_LABEL,
  TIER_LABEL,
  YIELD_LABEL,
  type Farmer,
  type ProduceLog,
  type QualityGrade,
} from "@/lib/types";
import { Badge, Button, Card, ConfirmDialog, Input, Modal, Select, XScroll } from "@/components/ui";
import { GradeBadge, RokiTierBadge, SourceChip, StatusBadge, TierBadge, YieldBadge } from "@/components/badges";

type Tab = "farmers" | "logs";

export default function GridPage() {
  const db = useDb();
  const [tab, setTab] = useState<Tab>("farmers");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold text-forest-900">Data Grid & Export</h2>
        <p className="mt-0.5 text-sm text-stone-500">
          Click any cell to edit inline, the rule engine re-checks automatically. Sort, filter, bulk-delete and export.
        </p>
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-xl border border-stone-200 bg-white p-1 w-fit">
        <TabButton active={tab === "farmers"} onClick={() => setTab("farmers")} icon={<Users className="h-4 w-4" />} label={`Farmers (${db.farmers.length})`} />
        <TabButton active={tab === "logs"} onClick={() => setTab("logs")} icon={<Wheat className="h-4 w-4" />} label={`Produce Logs (${db.logs.length})`} />
      </div>

      {tab === "farmers" ? <FarmersGrid db={db} /> : <LogsGrid db={db} />}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition-colors",
        active ? "bg-forest-800 text-white" : "text-stone-500 hover:bg-stone-50"
      )}
    >
      {icon} {label}
    </button>
  );
}

// ------------------------------------------------------------------
// Shared toolbar
// ------------------------------------------------------------------
function Toolbar({
  globalFilter,
  onGlobalFilter,
  onExportCSV,
  onExportXLSX,
  selectionCount,
  onDelete,
  onReassign,
  selectionLabel,
}: {
  globalFilter: string;
  onGlobalFilter: (v: string) => void;
  onExportCSV: () => void;
  onExportXLSX: () => void;
  selectionCount: number;
  onDelete: () => void;
  onReassign?: () => void;
  selectionLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={globalFilter}
        onChange={(e) => onGlobalFilter(e.target.value)}
        placeholder="Search all columns…"
        className="h-10 w-64 rounded-lg text-sm"
      />
      {selectionCount > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3 py-1.5 text-[12px] font-bold text-white">
          {selectionCount} selected
        </span>
      )}
      <div className="ml-auto flex flex-wrap gap-2">
        {selectionCount > 0 && (
          <>
            {onReassign && (
              <Button variant="outline" size="sm" onClick={onReassign}>
                <Users className="h-3.5 w-3.5" /> Reassign
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={onExportCSV}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={onExportXLSX}>
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Inline editable cells
// ------------------------------------------------------------------
function EditableText({ value, onSave, mono }: { value: string; onSave: (v: string) => void; mono?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className={cx(
          "group -mx-1.5 inline-flex min-h-[32px] max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left ring-1 ring-transparent transition-all hover:bg-forest-50 hover:ring-forest-100",
          mono && "font-mono text-[12px]"
        )}
        title="Tap to edit"
      >
        <span className="truncate">{value || "N/A"}</span>
        <Pencil className="h-3 w-3 shrink-0 text-forest-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-full rounded-md border border-forest-500 px-1.5 py-1 text-sm outline-none ring-2 ring-forest-100"
    />
  );
}

function EditableNumber({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(String(value)); setEditing(true); }}
        className="group -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-right hover:bg-forest-50"
        title="Click to edit"
      >
        <span className="tabular">{value.toLocaleString()}</span>
        <Pencil className="h-3 w-3 text-forest-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }
  return (
    <input
      autoFocus
      type="number"
      step="any"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const n = parseFloat(draft);
        if (!isNaN(n) && n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-full rounded-md border border-forest-500 px-1.5 py-1 text-right text-sm outline-none ring-2 ring-forest-100"
    />
  );
}

function EditableSelect({ value, options, onSave, labels }: { value: string; options: string[]; onSave: (v: string) => void; labels?: Record<string, string> | ((v: string) => string) }) {
  const [editing, setEditing] = useState(false);
  const labelFor = (v: string) => (typeof labels === "function" ? labels(v) : labels?.[v] ?? v);
  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="group -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-forest-50"
        title="Click to change"
      >
        <span>{labelFor(value)}</span>
        <Pencil className="h-3 w-3 text-forest-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }
  return (
    <select
      autoFocus
      value={value}
      onChange={(e) => { setEditing(false); if (e.target.value !== value) onSave(e.target.value); }}
      onBlur={() => setEditing(false)}
      className="rounded-md border border-forest-500 bg-white px-1.5 py-1 text-sm outline-none ring-2 ring-forest-100"
    >
      {options.map((o) => (
        <option key={o} value={o}>{labelFor(o)}</option>
      ))}
    </select>
  );
}

// ------------------------------------------------------------------
// Farmers grid
// ------------------------------------------------------------------
function FarmersGrid({ db }: { db: ReturnType<typeof useDb> }) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmDel, setConfirmDel] = useState(false);

  const col = createColumnHelper<Farmer>();
  const columns = useMemo<ColumnDef<Farmer, any>[]>(
    () => [
      col.display({ id: "sel", header: ({ table }) => <SelHeader table={table} />, cell: ({ row }) => <SelCell row={row} />, size: 40 }),
      col.accessor("fullName", { header: "Name", cell: (i) => <EditableText value={i.getValue()} onSave={(v) => updateFarmer(i.row.original.id, { fullName: v })} /> }),
      col.accessor("id", { header: "Farmer ID", cell: (i) => <span className="font-mono text-[12px] text-stone-400">{i.getValue()}</span> }),
      col.accessor("phone", {
        header: "Phone",
        cell: (i) => (
          <EditableText
            value={i.getValue()}
            mono
            onSave={(v) => {
              const r = normalizeUgPhone(v);
              if (r.ok) updateFarmer(i.row.original.id, { phone: v });
            }}
          />
        ),
      }),
      col.accessor("district", {
        header: "District",
        cell: (i) => <EditableSelect value={i.getValue()} options={DISTRICTS} onSave={(v) => updateFarmer(i.row.original.id, { district: v })} />,
      }),
      col.accessor("subCounty", { header: "Sub-county", cell: (i) => <EditableText value={i.getValue()} onSave={(v) => updateFarmer(i.row.original.id, { subCounty: v })} /> }),
      col.accessor("acreage", {
        header: "Acres",
        cell: (i) => <EditableNumber value={i.getValue()} onSave={(v) => updateFarmer(i.row.original.id, { acreage: v })} />,
      }),
      col.accessor("rokiTier", { header: "Roki Tier", cell: (i) => <RokiTierBadge tier={i.getValue()} /> }),
      col.accessor("gender", { header: "Gender", cell: (i) => (i.getValue() === "F" ? "Female" : i.getValue() === "M" ? "Male" : "Other") }),
      col.accessor("refugeeStatus", { header: "Community", cell: (i) => (i.getValue() === "REFUGEE" ? "Refugee" : i.getValue() === "HOST" ? "Host" : "N/A") }),
      col.accessor("scaleTier", { header: "Farm size", cell: (i) => <TierBadge tier={i.getValue()} /> }),
      col.accessor("primaryCrops", { header: "Crops", cell: (i) => <span className="text-[12px] text-stone-500">{i.getValue().join(", ")}</span> }),
      col.accessor("flags", { header: "Flags", cell: (i) => (i.getValue().length > 0 ? <Badge tone="warning" dot>Attention</Badge> : <span className="text-stone-300">N/A</span>) }),
      col.accessor("createdAt", { header: "Registered", cell: (i) => <span className="text-[12px] text-stone-400">{fmtDate(i.getValue().slice(0, 10))}</span> }),
    ],
    [col]
  );

  const table = useReactTable({
    data: db.farmers,
    columns,
    state: { sorting, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
    getRowId: (r) => r.id,
  });

  const selectedIds = useMemo(() => db.farmers.filter((f) => rowSelection[f.id]).map((f) => f.id), [db.farmers, rowSelection]);

  function exportRows(xlsx: boolean) {
    const rows = table.getFilteredRowModel().rows.map((r) => r.original);
    const cols: ExportColumn[] = [
      { key: "id", label: "Farmer ID" },
      { key: "fullName", label: "Full Name" },
      { key: "phone", label: "Phone (+256)" },
      { key: "district", label: "District" },
      { key: "subCounty", label: "Sub-County" },
      { key: "village", label: "Village" },
      { key: "acreage", label: "Acreage (acres)" },
      { key: "gender", label: "Gender", value: (r) => (r.gender as string) === "F" ? "Female" : (r.gender as string) === "M" ? "Male" : "Other" },
      { key: "refugeeStatus", label: "Community", value: (r) => (r.refugeeStatus as string) === "REFUGEE" ? "Refugee" : (r.refugeeStatus as string) === "HOST" ? "Host community" : "" },
      { key: "ageGroup", label: "Age Group" },
      { key: "landOwnership", label: "Land Ownership", value: (r) => String(r.landOwnership).replace("_", " ") },
      { key: "rokiTier", label: "Roki Tier", value: (r) => `Tier ${r.rokiTier as number}` },
      { key: "scaleTier", label: "Scale Tier", value: (r) => TIER_LABEL[r.scaleTier as Farmer["scaleTier"]] },
      { key: "primaryCrops", label: "Primary Crops", value: (r) => (r.primaryCrops as string[]).join("; ") },
      { key: "flags", label: "Flags", value: (r) => (r.flags as string[]).length ? "INCOMPLETE_PROFILE" : "" },
      { key: "createdAt", label: "Registered", value: (r) => fmtDateTime(r.createdAt as string) },
    ];
    const name = `jfl-farmers-${stamp("export")}`;
    if (xlsx) downloadXLSX(rows, cols, `${name}.xlsx`);
    else downloadCSV(rows, cols, `${name}.csv`);
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-stone-100 p-4">
        <Toolbar
          globalFilter={globalFilter}
          onGlobalFilter={setGlobalFilter}
          onExportCSV={() => exportRows(false)}
          onExportXLSX={() => exportRows(true)}
          selectionCount={selectedIds.length}
          onDelete={() => setConfirmDel(true)}
          selectionLabel="farmers"
        />
      </div>
      <TableShell table={table} />
      <Pager table={table} />
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => { deleteFarmers(selectedIds); setRowSelection({}); }}
        danger
        title="Delete selected farmers?"
        confirmLabel="Delete"
        message={
          <>
            <b>{selectedIds.length}</b> farmer profile{selectedIds.length === 1 ? "" : "s"} and all their harvest logs will be permanently removed.
          </>
        }
      />
    </Card>
  );
}

// ------------------------------------------------------------------
// Logs grid
// ------------------------------------------------------------------
function LogsGrid({ db }: { db: ReturnType<typeof useDb> }) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmDel, setConfirmDel] = useState(false);
  const [reassignTarget, setReassignTarget] = useState(false);

  const farmerName = useMemo(() => {
    const m = new Map(db.farmers.map((f) => [f.id, f.fullName]));
    return (id: string) => m.get(id) ?? "Unknown";
  }, [db.farmers]);

  const col = createColumnHelper<ProduceLog>();
  const columns = useMemo<ColumnDef<ProduceLog, any>[]>(
    () => [
      col.display({ id: "sel", header: ({ table }) => <SelHeader table={table} />, cell: ({ row }) => <SelCell row={row} />, size: 40 }),
      col.accessor("id", { header: "Log ID", cell: (i) => <span className="font-mono text-[11px] text-stone-400">{i.getValue()}</span>, meta: { hideOnMobile: true } }),
      col.accessor("farmerId", {
        header: "Farmer",
        cell: (i) => (
          <EditableSelect value={i.getValue()} options={db.farmers.map((f) => f.id)} labels={farmerName} onSave={(v) => updateLog(i.row.original.id, { farmerId: v })} />
        ),
      }),
      col.accessor("cropType", {
        header: "Crop",
        cell: (i) => <EditableSelect value={i.getValue()} options={[...CROPS]} onSave={(v) => updateLog(i.row.original.id, { cropType: v })} />,
      }),
      col.accessor("quantityKg", {
        header: "Qty (kg)",
        cell: (i) => <EditableNumber value={i.getValue()} onSave={(v) => updateLog(i.row.original.id, { quantityKg: v })} />,
      }),
      col.accessor("qualityGrade", {
        header: "Grade",
        cell: (i) => (
          <EditableSelect
            value={i.getValue()}
            options={["A", "B", "REJECT"]}
            labels={GRADE_LABEL}
            onSave={(v) => updateLog(i.row.original.id, { qualityGrade: v as QualityGrade })}
          />
        ),
      }),
      col.accessor("harvestDate", {
        header: "Harvested",
        cell: (i) => (
          <EditableText
            value={fmtDate(i.getValue())}
            onSave={(v) => {
              const iso = new Date(v).toISOString().slice(0, 10);
              if (!isNaN(new Date(v).getTime())) updateLog(i.row.original.id, { harvestDate: iso });
            }}
          />
        ),
      }),
      col.accessor("status", { header: "Status", cell: (i) => <StatusBadge status={i.getValue()} /> }),
      col.accessor("yieldScore", { header: "Yield", cell: (i) => <YieldBadge score={i.getValue()} />, meta: { hideOnMobile: true } }),
      col.accessor("batchId", { header: "Batch", cell: (i) => <span className="font-mono text-[11px] text-stone-400">{i.getValue() ?? "N/A"}</span> }),
      col.accessor("storageLocation", { header: "Storage", cell: (i) => <EditableText value={i.getValue() ?? ""} onSave={(v) => updateLog(i.row.original.id, { storageLocation: v })} /> }),
      col.accessor("source", { header: "Source", cell: (i) => <SourceChip source={i.getValue()} /> }),
    ],
    [col, db.farmers, farmerName]
  );

  const table = useReactTable({
    data: db.logs,
    columns,
    state: { sorting, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
    getRowId: (r) => r.id,
  });

  const selectedIds = useMemo(() => db.logs.filter((l) => rowSelection[l.id]).map((l) => l.id), [db.logs, rowSelection]);

  function exportRows(xlsx: boolean) {
    const rows = table.getFilteredRowModel().rows.map((r) => r.original);
    const cols: ExportColumn[] = [
      { key: "id", label: "Log ID" },
      { key: "farmerId", label: "Farmer ID" },
      { key: "farmerName", label: "Farmer Name", value: (r) => farmerName(r.farmerId as string) },
      { key: "cropType", label: "Crop" },
      { key: "quantityKg", label: "Quantity (kg)" },
      { key: "qualityGrade", label: "Grade", value: (r) => GRADE_LABEL[r.qualityGrade as QualityGrade] },
      { key: "harvestDate", label: "Harvest Date" },
      { key: "status", label: "Status", value: (r) => STATUS_LABEL[r.status as ProduceLog["status"]] },
      { key: "yieldScore", label: "Yield Score", value: (r) => YIELD_LABEL[r.yieldScore as ProduceLog["yieldScore"]] },
      { key: "auditNotes", label: "Rule Engine Notes", value: (r) => (r.auditNotes as string[]).join(" | ") },
      { key: "batchId", label: "Batch ID" },
      { key: "storageLocation", label: "Storage / Delivery" },
      { key: "source", label: "Source" },
      { key: "createdAt", label: "Logged At", value: (r) => fmtDateTime(r.createdAt as string) },
    ];
    const name = `jfl-produce-logs-${stamp("export")}`;
    if (xlsx) downloadXLSX(rows, cols, `${name}.xlsx`);
    else downloadCSV(rows, cols, `${name}.csv`);
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-stone-100 p-4">
        <Toolbar
          globalFilter={globalFilter}
          onGlobalFilter={setGlobalFilter}
          onExportCSV={() => exportRows(false)}
          onExportXLSX={() => exportRows(true)}
          selectionCount={selectedIds.length}
          onDelete={() => setConfirmDel(true)}
          onReassign={() => setReassignTarget(true)}
          selectionLabel="logs"
        />
      </div>
      <TableShell table={table} />
      <Pager table={table} />

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => { deleteLogs(selectedIds); setRowSelection({}); }}
        danger
        title="Delete selected logs?"
        confirmLabel="Delete"
        message={<b>{selectedIds.length}</b>}
      />

      <Modal
        open={reassignTarget}
        onClose={() => setReassignTarget(false)}
        title="Reassign logs to another farmer"
        footer={
          <>
            <Button variant="outline" onClick={() => setReassignTarget(false)}>Cancel</Button>
          </>
        }
      >
        <ReassignPicker
          onPick={(farmerId) => {
            reassignLogs(selectedIds, farmerId);
            setReassignTarget(false);
            setRowSelection({});
          }}
        />
      </Modal>
    </Card>
  );
}

function ReassignPicker({ onPick }: { onPick: (farmerId: string) => void }) {
  const db = useDb();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return db.farmers
      .filter((f) => !query || `${f.fullName} ${f.id} ${f.district}`.toLowerCase().includes(query))
      .slice(0, 30);
  }, [db.farmers, q]);
  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search farmer…" />
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {list.map((f) => (
          <button
            key={f.id}
            onClick={() => onPick(f.id)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-forest-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-stone-700">{f.fullName}</span>
              <span className="block font-mono text-[11px] text-stone-400">{f.id} · {f.district}</span>
            </span>
            <TierBadge tier={f.scaleTier} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Shared table renderers
// ------------------------------------------------------------------
function SelHeader({ table }: { table: any }) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-forest-700"
      checked={table.getIsAllRowsSelected()}
      onChange={table.getToggleAllRowsSelectedHandler()}
    />
  );
}
function SelCell({ row }: { row: any }) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-forest-700"
      checked={row.getIsSelected()}
      onChange={row.getToggleSelectedHandler()}
    />
  );
}

function TableShell({ table }: { table: any }) {
  return (
    <div>
      <p className="border-b border-stone-100 bg-forest-50/50 px-4 py-2 text-center text-[11px] font-semibold text-forest-700 sm:hidden">
        ← Swipe sideways to see all columns →
      </p>
      <XScroll>
      <table className="w-full min-w-[1050px] text-left text-[13px]">
        <colgroup>
          {table.getAllLeafColumns().map((c: any) => (
            <col key={c.id} className={cx(c.id.includes("sel") && "w-12")} />
          ))}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((hg: any) => (
            <tr key={hg.id} className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
              {hg.headers.map((h: any) => (
                <th
                  key={h.id}
                  className={cx("py-3 px-3 first:pl-4 last:pr-4", h.column.columnDef.meta?.hideOnMobile && "hidden md:table-cell", h.column.getCanSort() && "cursor-pointer select-none")}
                  onClick={h.column.getToggleSortingHandler()}
                >
                  <span className="inline-flex items-center gap-1">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getCanSort() && (
                      <ArrowDownUp className={cx("h-3 w-3", h.column.getIsSorted() ? "text-forest-700" : "opacity-30")} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-stone-100">
          {table.getRowModel().rows.map((row: any) => (
            <tr key={row.id} className={cx("transition-colors odd:bg-white even:bg-stone-50/40 hover:bg-forest-50/50", row.getIsSelected() && "bg-forest-50/70")}>
              {row.getVisibleCells().map((cell: any) => (
                <td key={cell.id} className={cx("max-w-[240px] px-3 py-3 first:pl-4 last:pr-4 text-stone-700 align-middle", cell.column.columnDef.meta?.hideOnMobile && "hidden md:table-cell")}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.getRowModel().rows.length === 0 && (
        <div className="px-4 py-12 text-center text-sm text-stone-400">No rows match the current filters.</div>
      )}
      </XScroll>
    </div>
  );
}

function Pager({ table }: { table: any }) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-4 py-3">
      <div className="flex items-center gap-2 text-[12px] text-stone-500">
        <span className="tabular">
          {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length.toLocaleString()} rows shown
        </span>
        <Select
          value={table.getState().pagination.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="h-9 w-24 rounded-lg text-[12px]"
        >
          {[25, 50, 100, 250].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-[12px] font-semibold text-stone-500 tabular">
          Page {pageIndex + 1} / {Math.max(1, pageCount)}
        </span>
        <Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
