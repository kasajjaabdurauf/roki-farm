// ------------------------------------------------------------------
// Sheet parsing, flexible column auto-mapping and the staging area.
// Fully rule-based: synonym tables + pattern matching, no AI.
//
//    "Tel" | "Phone" | "Contact"  → phone_number
//    "Qty (Kg)" | "Weight"        → quantityKg   (unit sniffing: tonne/bag/crate)
//    "Area (Ha)"                  → acreage      (auto ×2.471 acres)
// ------------------------------------------------------------------

import * as XLSX from "xlsx";
import type { Db, StageField, StagingRow, StagingState, ColumnMapping, Farmer } from "./types";
import { CROPS, CROP_DEFAULTS } from "./reference";
import { normalizeUgPhone } from "./phone";
import { gradeFromLabel, computeScaleTier, computeFarmerFlags } from "./rules";
import { UNIT_FACTORS } from "./types";

export interface ParsedFile {
  fileName: string;
  sheetName: string;
  raw: string[][];
}

export function parseFile(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(new Uint8Array(data), { type: "array" });
        const first = wb.SheetNames[0];
        const ws = wb.Sheets[first];
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const rows = raw.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c).trim())));
        resolve({ fileName: file.name, sheetName: first, raw: rows });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Could not parse file"));
      }
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsArrayBuffer(file);
  });
}

// ------------------------------------------------------------------
// Synonym tables for rule-based column auto-detection
// ------------------------------------------------------------------
const SYNONYMS: Record<Exclude<StageField, "ignore">, string[]> = {
  fullName: ["fullname", "name", "names", "farmername", "farmer", "farmers", "fullnames", "beneficiary", "beneficiaryname", "farmerfullname", "farmernames"],
  firstName: ["firstname", "first name", "first", "givenname", "given name", "forename", "fname", "firstnames"],
  lastName: ["lastname", "last name", "last", "surname", "familyname", "family name", "lname", "lastnames"],
  phone: ["phone", "phonenumber", "phone1", "tel", "telephone", "contact", "mobile", "cell", "mob", "telno", "telnumber", "phoneno", "mobilephone", "whatsapp", "contactnumber"],
  nin: ["nin", "nationalid", "nationalidnumber", "idnumber", "nationalidentity", "nationalidno"],
  farmerId: ["farmerid", "systemid", "jflid", "farmercode", "jfl", "code"],
  district: ["district", "districtname", "dist", "region"],
  subCounty: ["subcounty", "subcountyname", "subcounty1"],
  village: ["village", "vill", "parish", "villageparish"],
  acreage: ["acreage", "acres", "acre", "landsize", "farmsize", "sizeacres", "totalacreage", "area", "farmarea", "acresfarmed", "sizefarm", "landarea"],
  crops: ["primarycrops", "crops", "maincrop", "primarycrop", "cropmix", "croplist"],
  cropType: ["croptype", "produce", "commodity", "crop", "product", "producetype", "harvesttype", "cropname"],
  harvestDate: ["harvestdate", "date", "dateharvested", "harvested", "harvest", "harvestingdate", "collectiondate", "pickdate", "harvestday"],
  quantityKg: ["quantity", "quantitykg", "weight", "kg", "kilograms", "kgs", "yield", "amount", "volume", "qty", "output", "mass", "yieldkg", "quantitykgs", "totalquantity", "quantitytonnes", "quantitybags"],
  qualityGrade: ["grade", "quality", "qualitygrade", "grading", "gradingcategory", "gradequality", "class"],
  batchId: ["batchid", "batch", "lot", "lotno", "batchnumber", "lotnumber"],
  storageLocation: ["storagelocation", "storage", "location", "deliverylocation", "depot", "store", "collectioncenter", "storelocation", "storename"],
  gender: ["gender", "sex", "male", "female"],
  refugeeStatus: ["refugeestatus", "refugee", "hostcommunity", "host", "displacementstatus"],
  email: ["email", "emailaddress", "mail", "useremail", "accountemail"],
  plantingDate: ["plantingdate", "dateplanted", "planted", "planting"],
  sourceOfSeed: ["sourceofseed", "seed source", "seedsource", "source", "seedorigin", "seed"],
  plantingStatus: ["status", "plantingstatus", "currentstatus", "farmstatus", "farmerstatus"],
  gpsLat: ["gpslatitude", "latitude", "lat", "gps-latitude"],
  gpsLon: ["gpslongitude", "longitude", "lon", "long", "gps-longitude"],
};

const NORM_CACHE: Record<string, string> = {};
function norm(s: string): string {
  if (NORM_CACHE[s] !== undefined) return NORM_CACHE[s];
  const n = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  NORM_CACHE[s] = n;
  return n;
}

const FIELD_LABELS: Record<Exclude<StageField, "ignore">, string> = {
  fullName: "Full name",
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone number",
  nin: "National ID (NIN)",
  farmerId: "Farmer ID (RFV-UG-…)",
  district: "District",
  subCounty: "Sub-county",
  village: "Village / parish",
  acreage: "Acreage (acres)",
  crops: "Primary crops (farmer)",
  cropType: "Crop type (log)",
  harvestDate: "Harvest date",
  quantityKg: "Quantity / weight",
  qualityGrade: "Quality grade",
  batchId: "Batch ID",
  storageLocation: "Storage / delivery location",
  gender: "Gender",
  refugeeStatus: "Refugee / host status",
  email: "Email (account)",
  plantingDate: "Planting date",
  sourceOfSeed: "Source of seed",
  plantingStatus: "Status",
  gpsLat: "GPS latitude",
  gpsLon: "GPS longitude",
};

export const STAGE_FIELDS: StageField[] = [
  "fullName", "firstName", "lastName", "phone", "nin", "farmerId", "district", "subCounty", "village",
  "acreage", "crops", "cropType", "harvestDate", "quantityKg", "qualityGrade", "batchId", "storageLocation",
  "gender", "refugeeStatus", "email", "plantingDate", "sourceOfSeed", "plantingStatus", "gpsLat", "gpsLon", "ignore",
];

export function stageFieldLabel(f: StageField): string {
  return f === "ignore" ? "Ignore column" : FIELD_LABELS[f];
}

// ------------------------------------------------------------------
// Auto-detection of the best target field for a header
// ------------------------------------------------------------------
export function autoDetect(header: string): { target: StageField; unit?: "KG" | "BAG" | "CRATE" | "TONNE"; areaUnit?: "ACRES" | "HECTARES" } {
  const n = norm(header);
  if (!n) return { target: "ignore" };

  let best: StageField = "ignore";
  let bestScore = 0;
  // "company name" / "organisation" headers must never become a farmer's name
  if (/company|organisation|organization|org/.test(n)) {
    return { target: "ignore" };
  }
  for (const [field, syns] of Object.entries(SYNONYMS) as [Exclude<StageField, "ignore">, string[]][]) {
    let score = 0;
    for (const s of syns) {
      const ns = norm(s);
      if (n === ns) { score = 3; break; }
      if (n.includes(ns) && ns.length >= 3) { score = Math.max(score, 2); }
      if (ns.includes(n) && n.length >= 4) { score = Math.max(score, 1); }
    }
    if (score > bestScore) { bestScore = score; best = field; }
  }

  // unit sniffing
  let unit: "KG" | "BAG" | "CRATE" | "TONNE" | undefined;
  if (best === "quantityKg") {
    if (/ton/i.test(n) || n.includes("tonnes") || n.includes("tons") || n.includes("tonne")) unit = "TONNE";
    else if (n.includes("bag")) unit = "BAG";
    else if (n.includes("crate")) unit = "CRATE";
    else unit = "KG";
  }
  let areaUnit: "ACRES" | "HECTARES" | undefined;
  if (best === "acreage" && (n.includes("ha") || n.includes("hectare"))) areaUnit = "HECTARES";

  return { target: best, unit, areaUnit };
}

// ------------------------------------------------------------------
// Value parsing helpers
// ------------------------------------------------------------------
function parseNum(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  let clean = raw.replace(/,/g, "").replace(/\s/g, "");
  // allow "ac"/"acres" suffixes and trailing junk that Excel sometimes adds
  clean = clean.replace(/(ac|acres|ha|hectares)$/i, "");
  const v = Number(clean);
  return isNaN(v) ? undefined : v;
}

function parseDateCell(raw: string): string | undefined {
  if (!raw) return undefined;
  // Excel serial date (e.g. 45658)
  if (/^\d{4,5}(\.\d+)?$/.test(raw.trim())) {
    const n = Number(raw.trim());
    if (n > 20000 && n < 70000) {
      const d = new Date(Math.round((n - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  const t = raw.trim();
  // YYYY-MM-DD
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // "12 Mar 2025"
  const parsed = new Date(t);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return undefined;
}

// ------------------------------------------------------------------
// Build the staging state from a parsed file
// ------------------------------------------------------------------
export function buildStaging(file: ParsedFile, db: Db): StagingState {
  // Locate header row: first row where ≥ 2 cells auto-detect
  let headerIdx = -1;
  for (let i = 0; i < Math.min(file.raw.length, 20); i++) {
    const row = file.raw[i];
    const hits = row.filter((c) => c && autoDetect(c).target !== "ignore").length;
    if (hits >= 2) { headerIdx = i; break; }
  }
  if (headerIdx === -1) headerIdx = 0;
  const headers = file.raw[headerIdx] ?? [];

  const columns: ColumnMapping[] = headers.map((h, i) => {
    const det = autoDetect(h);
    return {
      sourceIndex: i,
      sourceHeader: h || `Column ${i + 1}`,
      target: det.target,
      autoDetected: true,
      unit: det.unit,
      areaUnit: det.areaUnit,
    };
  });

  const dataRows = file.raw.slice(headerIdx + 1).filter((r) => r.some((c) => c !== ""));
  const rows: StagingRow[] = dataRows.map((r, idx) =>
    stageRow(r, columns, db, idx + headerIdx + 2)
  );

  return { fileName: file.fileName, sheetName: file.sheetName, columns, rows, headers };
}

/** Re-stage rows after the user overrides a column mapping. */
export function reStage(prev: StagingState, columns: ColumnMapping[], db: Db): StagingState {
  const dataRows = prev.rows.map((r) => {
    const cells: string[] = prev.headers.map((_, i) => r.cells[String(i)] ?? "");
    return cells;
  });
  const rows = dataRows.map((r, idx) => stageRow(r, columns, db, idx + 2));
  return { ...prev, columns, rows };
}

export function stageRow(
  rawCells: string[],
  columns: ColumnMapping[],
  db: Db,
  rowNumber: number
): StagingRow {
  const cells: Record<string, string> = {};
  const parsed: Record<string, string | number | boolean | undefined> = {};
  for (const col of columns) {
    if (col.target === "ignore") continue;
    const raw = rawCells[col.sourceIndex] ?? "";
    cells[String(col.sourceIndex)] = raw;
    if (raw === "") { parsed[col.target] = undefined; continue; }

    switch (col.target) {
      case "fullName":
        parsed.fullName = raw.trim().replace(/\s+/g, " ");
        break;
      case "firstName":
        parsed.firstName = raw.trim().replace(/\s+/g, " ");
        break;
      case "lastName":
        parsed.lastName = raw.trim().replace(/\s+/g, " ");
        break;
      case "phone":
        parsed.phone = raw.trim();
        break;
      case "nin":
        parsed.nin = raw.trim();
        break;
      case "farmerId":
        parsed.farmerId = raw.trim();
        break;
      case "district":
      case "subCounty":
      case "village":
      case "batchId":
      case "storageLocation":
        parsed[col.target] = raw.trim();
        break;
      case "acreage": {
        let v = parseNum(raw);
        if (v !== undefined && col.areaUnit === "HECTARES") v = v * 2.47105;
        parsed.acreage = v;
        break;
      }
      case "crops":
      case "cropType":
        parsed[col.target] = raw.trim().replace(/;\s*/g, ", ");
        break;
      case "harvestDate":
        parsed.harvestDate = parseDateCell(raw);
        break;
      case "quantityKg": {
        let v = parseNum(raw);
        if (v !== undefined && col.unit && col.unit !== "KG") v = v * UNIT_FACTORS[col.unit];
        parsed.quantityKg = v;
        break;
      }
      case "qualityGrade":
        parsed.qualityGrade = gradeFromLabel(raw);
        break;
      case "gender": {
        const g = raw.trim().toLowerCase();
        parsed.gender = g.startsWith("f") ? "F" : g.startsWith("m") ? "M" : "OTHER";
        break;
      }
      case "refugeeStatus": {
        const r = raw.trim().toLowerCase();
        parsed.refugeeStatus = r.includes("refugee") ? "REFUGEE" : r.includes("host") ? "HOST" : "NONE";
        break;
      }
      case "email":
        parsed.email = raw.trim().toLowerCase();
        break;
      case "plantingDate":
        parsed.plantingDate = parseDateCell(raw);
        break;
      case "sourceOfSeed":
        parsed.sourceOfSeed = raw.trim();
        break;
      case "plantingStatus":
        parsed.plantingStatus = raw.trim();
        break;
      case "gpsLat":
        parsed.gpsLat = parseNum(raw);
        break;
      case "gpsLon":
        parsed.gpsLon = parseNum(raw);
        break;
    }
  }

  return validateRow(parsed, cells, db, rowNumber);
}

function validateRow(
  parsed: Record<string, any>,
  cells: Record<string, string>,
  db: Db,
  rowNumber: number
): StagingRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const out: StagingRow = { key: `r${rowNumber}-${Math.random().toString(36).slice(2, 7)}`, rowIndex: rowNumber, cells, parsed, errors, warnings, isLogRow: false };

  // MERGE first + last name into fullName when present (keeps useful data
  // that would otherwise be dropped by the column mapper)
  const first = parsed.firstName ? String(parsed.firstName) : "";
  const last = parsed.lastName ? String(parsed.lastName) : "";
  if ((first || last) && !parsed.fullName) {
    parsed.fullName = `${first} ${last}`.trim();
  } else if (first || last) {
    parsed.fullName = `${String(parsed.fullName)} ${first} ${last}`.replace(/\s+/g, " ").trim();
  }

  const hasQty = parsed.quantityKg !== undefined;
  const hasCropOrDate = parsed.cropType !== undefined || parsed.harvestDate !== undefined;
  out.isLogRow = hasQty || hasCropOrDate;

  // --- farmer resolution -------------------------------------------------
  let resolvedFarmer: Farmer | undefined;
  if (parsed.farmerId) {
    resolvedFarmer = db.farmers.find((f) => f.id.toLowerCase() === String(parsed.farmerId).toLowerCase());
    if (resolvedFarmer) out.resolveNote = `Linked to existing profile ${resolvedFarmer.id}`;
  }
  // NO AUTO-MERGE: an upload row only links to an existing record by an
  // explicit Farmer ID. Phone matches are reported as warnings but still
  // create a NEW record, so a file always yields ALL its people.
  if (!resolvedFarmer && parsed.phone) {
    const ph = normalizeUgPhone(String(parsed.phone));
    if (ph.ok) {
      const byPhone = db.farmers.find((f) => f.phone === ph.normalized);
      if (byPhone) {
        warnings.push(`Phone matches existing record ${byPhone.id} (${byPhone.fullName || byPhone.email}) — a NEW record will be created for this row (no merging). Link manually later if it is truly the same person.`);
      }
    }
  }
  if (!resolvedFarmer && parsed.farmerId) {
    warnings.push(`No farmer matches ID "${parsed.farmerId}", a new profile will be created`);
  }
  out.farmerId = resolvedFarmer?.id;
  out.farmerName = resolvedFarmer?.fullName;

  // --- field validation ---------------------------------------------------
  const name = parsed.fullName ? String(parsed.fullName) : undefined;

  if (out.isLogRow && !resolvedFarmer && !name) {
    errors.push(`Row ${rowNumber}: produce row needs a farmer, match a Farmer ID, a phone number, or provide a name`);
  }

  if (parsed.phone !== undefined && parsed.phone !== "") {
    let rawPhone = String(parsed.phone);
    // multi-phone cells like "0782408545/0757408545" or with spaces:
    // keep the first valid number, note the rest in a warning
    const parts = rawPhone.split(/[/;,|]/).map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1) {
      const firstOk = parts.find((x) => normalizeUgPhone(x).ok);
      if (firstOk) {
        parsed.phone = firstOk;
        warnings.push(`Multiple phone numbers found in one cell (${rawPhone}) — kept "${firstOk}"`);
      }
    }
    // normalize inner spaces ("0704 600996" -> "0704600996") when the raw
    // value wasn't a split multi-phone
    if (!parts || parts.length <= 1) {
      const cleaned = String(parsed.phone).replace(/[\s()-]/g, "");
      if (cleaned !== parsed.phone) parsed.phone = cleaned;
    }
    const ph = normalizeUgPhone(String(parsed.phone));
    if (!ph.ok) errors.push(ph.reason!);
  }

  if (parsed.acreage !== undefined) {
    if (typeof parsed.acreage !== "number" || isNaN(parsed.acreage)) errors.push(`Acreage "${parsed.acreage}" is not a number`);
    else if (parsed.acreage <= 0) errors.push(`Acreage must be greater than 0`);
  }

  if (parsed.quantityKg !== undefined) {
    if (typeof parsed.quantityKg !== "number" || isNaN(parsed.quantityKg)) errors.push(`Quantity "${parsed.quantityKg}" is not a number`);
    else if (parsed.quantityKg <= 0) errors.push(`Quantity must be greater than 0 (got ${parsed.quantityKg})`);
  }

  if (parsed.harvestDate === undefined && hasQty && out.isLogRow) {
    errors.push(`Harvest date is missing or not a valid date`);
  }

  if (parsed.cropType !== undefined && parsed.cropType !== "") {
    const c = String(parsed.cropType);
    const known = CROPS.find((k) => k.toLowerCase() === c.toLowerCase()) ?? CROPS.find((k) => c.toLowerCase().includes(k.toLowerCase()));
    if (!known) warnings.push(`Crop "${c}" is not in the standard list, it will be stored under "Other"`);
  }

  if (!out.isLogRow && !name) errors.push(`Farmer row needs a name`);

  // duplicate suspicion (only for log rows with resolved farmer)
  if (out.isLogRow && resolvedFarmer && parsed.harvestDate && parsed.cropType) {
    const dup = db.logs.find(
      (l) =>
        l.farmerId === resolvedFarmer!.id &&
        l.cropType === String(parsed.cropType) &&
        l.harvestDate === String(parsed.harvestDate)
    );
    if (dup) warnings.push(`Possible duplicate: matches ${dup.id} (same farmer, crop & date)`);
  }

  return out;
}

export { computeScaleTier, computeFarmerFlags, CROP_DEFAULTS };

// ------------------------------------------------------------------
// Re-validate a single staged row after the user edits one of its
// cells inline (used by the upload staging grid "fix it here" UX).
// ------------------------------------------------------------------
export function reStageRow(
  row: StagingRow,
  sourceIndex: number,
  newRaw: string,
  columns: ColumnMapping[],
  db: Db
): StagingRow {
  const cells = { ...row.cells, [String(sourceIndex)]: newRaw };
  const maxIdx = columns.reduce((m, c) => Math.max(m, c.sourceIndex), 0);
  const rawCells: string[] = Array.from({ length: maxIdx + 1 }, (_, i) => cells[String(i)] ?? "");
  return stageRow(rawCells, columns, db, row.rowIndex);
}
