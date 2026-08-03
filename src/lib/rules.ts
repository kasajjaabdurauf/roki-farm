// ------------------------------------------------------------------
// RULE-BASED INTELLIGENCE ENGINE — deterministic, zero AI.
//
// 1. Anomaly detection   : yield_kg > acreage * max_expected_yield_per_acre
//                          → status NEEDS_AUDIT
// 2. Duplicate guard     : same farmer + harvest_date + crop_type logged
//                          within 24 hours → status FLAGGED
// 3. Incomplete profile  : farmer missing critical contact details
// 4. Scale tier tagging  : Micro < 2 ac | Mid-Scale 2–10 ac | Large > 10 ac
// 5. Yield scoring       : Low / Expected / Bumper vs. historical median
//                          per-crop per-acre yield (deterministic median)
// ------------------------------------------------------------------

import type {
  Farmer,
  FarmerFlag,
  ProduceLog,
  QualityGrade,
  RokiTier,
  ScaleTier,
  Settings,
  YieldScore,
} from "./types";
import { normalizeUgPhone } from "./phone";
import { isoDaysAgo } from "./format";

export function computeScaleTier(acreage: number): ScaleTier {
  if (!acreage || acreage < 2) return "MICRO";
  if (acreage <= 10) return "MID_SCALE";
  return "LARGE_SCALE";
}

// ------------------------------------------------------------------
// Farmer Scoring System (Roki) — deterministic, explainable:
//   Tier 1 · Export-ready     : ≥ 3 acres, ≥ 6 harvest logs, Grade-A
//                               verified volume in the last 180 days
//   Tier 2 · Developing comm. : ≥ 1.5 acres, ≥ 3 harvest logs
//   Tier 3 · New (support)    : everyone else
// ------------------------------------------------------------------
export function computeRokiTier(
  farmer: Pick<Farmer, "id" | "acreage">,
  logs: Pick<ProduceLog, "farmerId" | "qualityGrade" | "status" | "harvestDate">[]
): RokiTier {
  const own = logs.filter((l) => l.farmerId === farmer.id);
  const since180 = isoDaysAgo(180);
  const exportReady = own.filter(
    (l) => l.qualityGrade === "A" && l.status === "VERIFIED" && l.harvestDate >= since180
  );
  if (farmer.acreage >= 3 && own.length >= 6 && exportReady.length >= 1) return 1;
  if (farmer.acreage >= 1.5 && own.length >= 3) return 2;
  return 3;
}

export function rokiTierCriteria(tier: RokiTier): string {
  if (tier === 1) return "≥ 3 acres · ≥ 6 harvest logs · verified Grade-A produce in the last 180 days";
  if (tier === 2) return "≥ 1.5 acres · ≥ 3 harvest logs (commercial development)";
  return "Newly registered or below commercial thresholds — needs agronomy & market support";
}

// ------------------------------------------------------------------
// 1. Unusual yield alert
// ------------------------------------------------------------------
export function anomalyCheck(
  log: Pick<ProduceLog, "quantityKg" | "cropType">,
  farmer: Pick<Farmer, "acreage">,
  settings: Settings
): { flagged: boolean; note?: string } {
  if (!settings.rules.anomalyDetection) return { flagged: false };
  const crop = settings.crops[log.cropType];
  if (!crop || !farmer.acreage || farmer.acreage <= 0) return { flagged: false };
  const ceiling = farmer.acreage * crop.maxPerAcreKg;
  if (log.quantityKg > ceiling) {
    return {
      flagged: true,
      note: `Yield ${fmtKg(log.quantityKg)} exceeds expected ceiling of ${fmtKg(ceiling)} for ${log.cropType} on ${farmer.acreage} ac (rule: yield_kg > acreage × ${crop.maxPerAcreKg.toLocaleString()} kg/ac).`,
    };
  }
  return { flagged: false };
}

// ------------------------------------------------------------------
// 2. Duplicate guard — same farmer + harvest date + crop within 24h
// ------------------------------------------------------------------
export function duplicateCheck(
  log: Pick<ProduceLog, "farmerId" | "cropType" | "harvestDate" | "createdAt" | "id">,
  allLogs: Pick<ProduceLog, "id" | "farmerId" | "cropType" | "harvestDate" | "createdAt">[]
): { flagged: boolean; note?: string } {
  const t = new Date(log.createdAt).getTime();
  for (const other of allLogs) {
    if (other.id === log.id) continue;
    if (other.farmerId !== log.farmerId) continue;
    if (other.cropType !== log.cropType) continue;
    if (other.harvestDate !== log.harvestDate) continue;
    const dt = Math.abs(new Date(other.createdAt).getTime() - t);
    if (dt <= 24 * 60 * 60 * 1000) {
      return {
        flagged: true,
        note: `Possible duplicate: ${other.id} also logs ${log.cropType} harvested ${log.harvestDate} within the last 24 h.`,
      };
    }
  }
  return { flagged: false };
}

// ------------------------------------------------------------------
// 3. Incomplete profile flag
// ------------------------------------------------------------------
export function computeFarmerFlags(farmer: Partial<Farmer>): FarmerFlag[] {
  const flags: FarmerFlag[] = [];
  const missing: string[] = [];
  if (!farmer.phone || !normalizeUgPhone(farmer.phone).ok) missing.push("phone number");
  if (!farmer.district) missing.push("district");
  if (!farmer.subCounty) missing.push("sub-county");
  if (missing.length > 0) flags.push("INCOMPLETE_PROFILE");
  return flags;
}

export function incompleteProfileNote(farmer: Partial<Farmer>): string | undefined {
  const missing: string[] = [];
  if (!farmer.phone || !normalizeUgPhone(farmer.phone).ok) missing.push("phone");
  if (!farmer.district) missing.push("district");
  if (!farmer.subCounty) missing.push("sub-county");
  if (missing.length === 0) return undefined;
  return `Missing critical contact details: ${missing.join(", ")}.`;
}

// ------------------------------------------------------------------
// 5. Yield scoring — Low / Expected / Bumper
// Baseline: median historical per-acre yield for the crop (≥ 5 logs),
// falling back to the deterministic per-crop default.
// ------------------------------------------------------------------
export function computeYieldScore(
  log: Pick<ProduceLog, "quantityKg" | "cropType" | "farmerId">,
  farmer: Pick<Farmer, "acreage">,
  allLogs: ProduceLog[],
  settings: Settings
): YieldScore {
  if (!settings.rules.yieldScoring) return "EXPECTED";

  const perAcre = farmer.acreage > 0 ? log.quantityKg / farmer.acreage : log.quantityKg;

  const sameCrop = allLogs.filter(
    (l) => l.cropType === log.cropType && l.id !== (log as ProduceLog).id && l.quantityKg > 0
  );
  let baseline = settings.crops[log.cropType]?.typicalPerAcreKg ?? 2500;

  if (sameCrop.length >= 5) {
    const medians: number[] = [];
    for (const l of sameCrop) {
      // per-acre basis requires the farmer's acreage — approximated from
      // current farmer record (deterministic and stable).
      medians.push(l.quantityKg / (farmer.acreage > 0 ? farmer.acreage : 1));
    }
    medians.sort((a, b) => a - b);
    baseline = medians[Math.floor(medians.length / 2)] || baseline;
  }

  if (baseline <= 0) baseline = 2500;
  if (perAcre < baseline * 0.5) return "LOW";
  if (perAcre > baseline * 1.5) return "BUMPER";
  return "EXPECTED";
}

// ------------------------------------------------------------------
// Master evaluation — used on every create/edit of a produce log.
// Status priority: FLAGGED (duplicate) > NEEDS_AUDIT (anomaly) > VERIFIED.
// ------------------------------------------------------------------
export interface EvaluationResult {
  status: ProduceLog["status"];
  auditNotes: string[];
  yieldScore: YieldScore;
}

export function evaluateLog(
  draft: Pick<
    ProduceLog,
    "id" | "farmerId" | "cropType" | "quantityKg" | "harvestDate" | "createdAt"
  >,
  farmer: Farmer | undefined,
  allLogs: ProduceLog[],
  settings: Settings
): EvaluationResult {
  const auditNotes: string[] = [];
  let status: ProduceLog["status"] = "VERIFIED";

  if (farmer) {
    const anomaly = anomalyCheck(draft, farmer, settings);
    if (anomaly.flagged) {
      status = "NEEDS_AUDIT";
      auditNotes.push(anomaly.note!);
    }
  }

  const dup = duplicateCheck(draft, allLogs);
  if (dup.flagged) {
    status = "FLAGGED";
    auditNotes.push(dup.note!);
  }

  const yieldScore = farmer
    ? computeYieldScore(draft, farmer, allLogs, settings)
    : "EXPECTED";

  return { status, auditNotes, yieldScore };
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
export function fmtKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(kg >= 100000 ? 0 : 1)} t`;
  return `${Math.round(kg).toLocaleString()} kg`;
}

export function fmtNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function gradeFromLabel(label: string): QualityGrade {
  const l = label.trim().toUpperCase();
  if (l.startsWith("A")) return "A";
  if (l.startsWith("B")) return "B";
  if (l.includes("REJ") || l.startsWith("R")) return "REJECT";
  if (l.includes("C")) return "B";
  return "A";
}
