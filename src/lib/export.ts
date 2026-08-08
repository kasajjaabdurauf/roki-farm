// ------------------------------------------------------------------
// CSV / XLSX export engine.
// Clean headers, clean +256 phone formatting, computed summary columns.
// ------------------------------------------------------------------

import * as XLSX from "xlsx";
import { fmtDateTimeCSV } from "./format";

export interface ExportColumn {
  key: string;
  label: string;
  value?: (row: Record<string, any>) => string | number;
}

function escCSV(v: string | number | boolean | undefined | null): string {
  if (v === undefined || v === null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSVString(rows: Record<string, any>[], columns: ExportColumn[]): string {
  const header = columns.map((c) => escCSV(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escCSV(c.value ? c.value(row) : row[c.key])).join(","))
    .join("\r\n");
  // BOM so Excel opens UTF-8 cleanly (names like "Okello" & "Nakato" etc.)
  return "\uFEFF" + header + "\r\n" + body;
}

export function downloadText(text: string, filename: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCSV(rows: Record<string, any>[], columns: ExportColumn[], filename: string): void {
  downloadText(toCSVString(rows, columns), filename);
}

export function downloadXLSX(
  rows: Record<string, any>[],
  columns: ExportColumn[],
  filename: string
): void {
  const data = rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const c of columns) out[c.label] = c.value ? c.value(row) : row[c.key];
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Roki");
  XLSX.writeFile(wb, filename);
}

export function stamp(name: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${name}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// ------------------------------------------------------------------
// Master backup: one workbook with "Farmers" and "Harvest Logs" sheets
// (used by the admin header button + Settings → Data management).
// ------------------------------------------------------------------
export function downloadMasterBackup(
  farmers: Record<string, any>[],
  logs: Record<string, any>[],
  farmerNameOf: (id: string) => string,
  filename: string
): void {
  const farmerCols: ExportColumn[] = [
    { key: "id", label: "Farmer ID" },
    { key: "fullName", label: "Full Name" },
    { key: "loggedBy", label: "Registered By (Agent)", value: (r) => r.loggedBy ?? r.survey?.enumeratorName ?? "" },
    { key: "phone", label: "Phone (+256)" },
    { key: "gender", label: "Gender", value: (r) => (r.gender === "F" ? "Female" : r.gender === "M" ? "Male" : "Other") },
    { key: "refugeeStatus", label: "Community", value: (r) => (r.refugeeStatus === "REFUGEE" ? "Refugee" : r.refugeeStatus === "HOST" ? "Host community" : "") },
    { key: "district", label: "District" },
    { key: "subCounty", label: "Sub-County" },
    { key: "village", label: "Village" },
    { key: "acreage", label: "Acreage (acres)" },
    { key: "cultivatedAcreage", label: "Cultivated (acres)", value: (r) => r.survey?.cultivatedAcreage ?? "" },
    { key: "landOwnership", label: "Land Ownership" },
    { key: "rokiTier", label: "Roki Tier", value: (r) => `Tier ${r.rokiTier}` },
    { key: "scaleTier", label: "Farm Size Tier" },
    { key: "primaryCrops", label: "Crops", value: (r) => r.primaryCrops.join("; ") },
    { key: "plannedTotalKg", label: "Planned Volume (kg)", value: (r) => (r.plannedProductions ?? []).reduce((s: number, p: any) => s + (p.expectedVolumeKg || 0), 0) },
    { key: "createdAt", label: "Registered At (exact)", value: (r) => fmtDateTimeCSV(r.createdAt) },
  ];
  const logCols: ExportColumn[] = [
    { key: "id", label: "Log ID" },
    { key: "farmerId", label: "Farmer ID" },
    { key: "farmerName", label: "Farmer Name", value: (r) => farmerNameOf(r.farmerId) },
    { key: "cropType", label: "Crop" },
    { key: "quantityKg", label: "Quantity (kg)" },
    { key: "qualityGrade", label: "Grade" },
    { key: "harvestDate", label: "Harvest Date" },
    { key: "status", label: "Status" },
    { key: "yieldScore", label: "Yield Score" },
    { key: "source", label: "Source" },
    { key: "createdAt", label: "Logged At (exact)", value: (r) => fmtDateTimeCSV(r.createdAt) },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      farmers.map((f) => {
        const o: Record<string, string | number> = {};
        for (const c of farmerCols) o[c.label] = c.value ? c.value(f) : f[c.key];
        return o;
      })
    ),
    "Farmers"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      logs.map((l) => {
        const o: Record<string, string | number> = {};
        for (const c of logCols) o[c.label] = c.value ? c.value(l) : l[c.key];
        return o;
      })
    ),
    "Harvest Logs"
  );
  XLSX.writeFile(wb, filename);
}
