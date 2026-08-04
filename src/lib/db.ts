// ------------------------------------------------------------------
// Roki Fruit & Vegetables, repository layer.
//
// Offline-first: the browser database lives in localStorage so the
// PWA works in the field with zero connectivity. Every mutation is
// also recorded in an outbox while offline ("3 items pending sync")
// and flushed when connectivity returns. Swap this file for a
// Supabase/PostgreSQL repository when going to production, the rest
// of the app only talks to the functions exposed here.
// ------------------------------------------------------------------

"use client";

import { useSyncExternalStore } from "react";
import type {
  Db,
  Farmer,
  FarmerFlag,
  PlannedProduction,
  ProduceLog,
  QualityGrade,
  Role,
  Settings,
  StagingState,
  LogSource,
  IrrigationType,
  Gender,
  RefugeeStatus,
  AgeGroup,
  LandOwnership,
  FarmerSurvey,
} from "./types";
import { DEFAULT_SURVEY, hashCode } from "./types";
import { DEFAULT_SETTINGS_RULES, CROP_DEFAULTS } from "./reference";
import { buildSeed } from "./seed";
import { computeRokiTier, computeScaleTier, computeFarmerFlags, evaluateLog } from "./rules";
import { normalizeUgPhone } from "./phone";
import { todayISO } from "./format";
import { fetchAll, fetchMyProfile, pushOp, remoteConfigured, sb, signOut as signOutRemote, validateSession } from "./remote";

const KEY = "roki-db-v3";

/** Default shared field-agent access code (admin can change it). */
export const DEFAULT_AGENT_CODE = "roki-agent-2026";
export function agentCodeHash(): string {
  return hashCode(DEFAULT_AGENT_CODE);
}

// guards against recursive sync (mutate → syncNow → mutate)
let syncing = false;

// ------------------------------------------------------------------
// Store plumbing (useSyncExternalStore)
// ------------------------------------------------------------------
let cache: Db | null = null;
const listeners = new Set<() => void>();

export const EMPTY_DB: Db = {
  farmers: [],
  logs: [],
  settings: { rules: { ...DEFAULT_SETTINGS_RULES }, crops: { ...CROP_DEFAULTS } },
  meta: { nextFarmerSeq: 1, nextLogSeq: 1, outbox: [], role: "FIELD_AGENT", demoFarmerId: "", seededAt: "", agentCodeHash: agentCodeHash(), language: "en" },
};

function persist(db: Db): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage full, demo scale is well within limits */
  }
}

export function loadDb(): Db {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY_DB;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (
        parsed &&
        Array.isArray(parsed.farmers) &&
        Array.isArray(parsed.logs) &&
        parsed.meta &&
        Array.isArray(parsed.meta.outbox)
      ) {
        // normalize any legacy rows so a missing array can never crash a page
        for (const f of parsed.farmers) {
          if (!Array.isArray(f.plannedProductions)) f.plannedProductions = [];
          if (!Array.isArray(f.primaryCrops)) f.primaryCrops = [];
          if (!Array.isArray(f.flags)) f.flags = [];
          if (!f.survey) f.survey = { ...DEFAULT_SURVEY };
        }
        for (const l of parsed.logs) {
          if (!Array.isArray(l.auditNotes)) l.auditNotes = [];
        }
        if (!parsed.meta.agentCodeHash) parsed.meta.agentCodeHash = agentCodeHash();
        if (!parsed.meta.language) parsed.meta.language = "en";
        cache = parsed;
        return cache;
      }
    }
  } catch {
    /* fall through to fresh state */
  }
  if (remoteConfigured()) {
    // production: start empty; the cloud (Supabase) is the source of truth
    cache = {
      ...EMPTY_DB,
      settings: { rules: { ...DEFAULT_SETTINGS_RULES }, crops: { ...CROP_DEFAULTS } },
    };
  } else {
    // preview mode: seed sample data for exploration
    cache = buildSeed();
  }
  persist(cache);
  return cache;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): Db {
  return loadDb();
}

function getServerSnapshot(): Db {
  return EMPTY_DB;
}

export function mutate(fn: (db: Db) => void): void {
  const db = loadDb();
  fn(db);
  persist(db);
  // Replace the snapshot with fresh object/array references so every
  // useSyncExternalStore subscriber (pages, shell, badges) re-renders
  // immediately instead of waiting for a page navigation.
  cache = {
    ...db,
    farmers: [...db.farmers],
    logs: [...db.logs],
    settings: { ...db.settings, rules: { ...db.settings.rules }, crops: { ...db.settings.crops } },
    meta: { ...db.meta, outbox: [...db.meta.outbox] },
  };
  listeners.forEach((l) => l());
  // production mode: push queued mutations to the cloud automatically
  if (remoteConfigured() && !syncing) void syncNow();
}

export function useDb(): Db {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True when the device is offline, drives the pending-sync indicator. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

// ------------------------------------------------------------------
// ID generation
// ------------------------------------------------------------------
export function nextFarmerId(db: Db): string {
  const id = `RFV-UG-${String(db.meta.nextFarmerSeq).padStart(5, "0")}`;
  db.meta.nextFarmerSeq += 1;
  return id;
}

export function nextLogId(db: Db): string {
  const id = `RFV-LOG-${String(db.meta.nextLogSeq).padStart(5, "0")}`;
  db.meta.nextLogSeq += 1;
  return id;
}

// ------------------------------------------------------------------
// Outbox (offline sync queue)
// ------------------------------------------------------------------
function enqueue(db: Db, op: Db["meta"]["outbox"][number]): void {
  if (remoteConfigured()) {
    // production mode: queue every mutation, then push to the cloud
    db.meta.outbox.push(op);
  } else if (isOffline()) {
    // demo mode: queue only while offline (cleared on reconnect)
    db.meta.outbox.push(op);
  }
}

export function pendingSync(db: Db): number {
  return db.meta.outbox.length;
}

/**
 * Push queued mutations to Supabase (production mode) or clear the
 * queue (demo mode, back online). Runs automatically after every
 * mutation and on reconnect; can also be triggered manually.
 */
export async function syncNow(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const db = loadDb();
    if (db.meta.outbox.length === 0) return;

    if (!remoteConfigured() || !sb()) {
      mutate((d) => {
        d.meta.outbox = [];
      });
      return;
    }

    const remaining: Db["meta"]["outbox"] = [];
    for (const op of db.meta.outbox) {
      try {
        await pushOp(op);
      } catch {
        remaining.push(op); // keep failed ops for the next retry
      }
    }
    if (remaining.length !== db.meta.outbox.length) {
      mutate((d) => {
        d.meta.outbox = remaining;
      });
    }
  } finally {
    syncing = false;
  }
}

/** Legacy sync entry used by the UI chip (fire-and-forget). */
export function flushOutbox(): void {
  void syncNow();
}

// ------------------------------------------------------------------
// Remote bootstrap: after sign-in, pull the cloud database into the
// local store and adopt the account role. Also used by "Sync now".
// ------------------------------------------------------------------
export async function refreshFromRemote(): Promise<void> {
  const data = await fetchAll();
  if (!data) return;

  // next sequence numbers = max numeric suffix + 1 (remote ids are RFV-UG-XXXXX)
  const seqOf = (id: string) => parseInt(id.split("-").pop() ?? "0", 10) || 0;
  const maxFarmer = data.farmers.reduce((m, f) => Math.max(m, seqOf(f.id)), 0);
  const maxLog = data.logs.reduce((m, l) => Math.max(m, seqOf(l.id)), 0);

  const existing = loadDb();
  const next: Db = {
    farmers: data.farmers,
    logs: data.logs,
    settings: existing.settings,
    meta: {
      ...existing.meta,
      nextFarmerSeq: maxFarmer + 1,
      nextLogSeq: maxLog + 1,
    },
  };
  cache = next;
  persist(next);
  listeners.forEach((l) => l());
}

/** Pull fresh cloud data + push pending ops (used by the live-refresh loop). */
export async function refreshNow(): Promise<void> {
  try {
    await syncNow();
    await refreshFromRemote();
  } catch {
    /* keep local state; retry next tick */
  }
}

export async function bootstrapRemote(): Promise<void> {
  if (!remoteConfigured()) return;
  const valid = await validateSession();
  if (!valid) return; // stale session — gate will send the user to login
  const profile = await fetchMyProfile();
  if (!profile) {
    // account exists but has no profile row (e.g. was deleted): sign out
    await signOutRemote();
    return;
  }
  if (profile) {
    mutate((db) => {
      db.meta.role = (profile.role as Role) ?? "FIELD_AGENT";
      if (profile.farmer_id) db.meta.demoFarmerId = profile.farmer_id;
    });
  }
  await refreshFromRemote();
  await syncNow();
}

// ------------------------------------------------------------------
// Farmer actions
// ------------------------------------------------------------------
export interface FarmerInput {
  fullName: string;
  phone: string;
  nin?: string;
  district: string;
  subCounty: string;
  village?: string;
  acreage: number;
  primaryCrops: string[];
  irrigationType: IrrigationType;
  // --- farmer registration questionnaire answers ---
  gender: Gender;
  refugeeStatus: RefugeeStatus;
  ageGroup: AgeGroup;
  landOwnership: LandOwnership;
  householdSize?: number;
  plannedProductions: PlannedProduction[];
  survey: FarmerSurvey;
}

/** Derive the flat mirror fields from a completed survey. */
function ageGroupFromYears(years?: number): AgeGroup {
  if (!years) return "36-45";
  if (years <= 25) return "18-25";
  if (years <= 35) return "26-35";
  if (years <= 45) return "36-45";
  if (years <= 60) return "46-60";
  return "60+";
}

function cropsFromSurvey(survey: FarmerSurvey): string[] {
  const out: string[] = [];
  for (const c of survey.currentCrops) if (c.crop && !out.includes(c.crop)) out.push(c.crop);
  for (const c of survey.supplyCrops) {
    const mapped = c === "Fruits" ? "Vegetables" : c === "Pepper" ? "Chilli Pepper" : c;
    if (mapped !== "Other" && !out.includes(mapped)) out.push(mapped);
  }
  for (const p of survey.previousCrops) if (p.crop && !out.includes(p.crop)) out.push(p.crop);
  if (out.length === 0) out.push("Vegetables");
  return out.slice(0, 8);
}

export function createFarmer(input: FarmerInput): Farmer {
  const db = loadDb();
  const survey: FarmerSurvey = { ...DEFAULT_SURVEY, ...input.survey };
  const farmer: Farmer = {
    id: nextFarmerId(db),
    fullName: input.fullName.trim(),
    email: undefined,
    phone: normalizeUgPhone(input.phone).normalized ?? input.phone.trim(),
    nin: input.nin?.trim() || undefined,
    district: input.district,
    subCounty: input.subCounty,
    village: input.village?.trim() || undefined,
    acreage: Number(input.acreage) || 0,
    primaryCrops: input.primaryCrops.length > 0 ? input.primaryCrops : cropsFromSurvey(survey),
    irrigationType: input.irrigationType,
    scaleTier: "MICRO",
    rokiTier: 3,
    gender: input.gender,
    refugeeStatus: input.refugeeStatus,
    ageGroup: input.ageGroup,
    landOwnership: input.landOwnership,
    householdSize: input.householdSize,
    plannedProductions: input.plannedProductions ?? [],
    survey,
    flags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  farmer.scaleTier = computeScaleTier(farmer.acreage);
  farmer.rokiTier = computeRokiTier(farmer, loadDb().logs);
  farmer.flags = computeFarmerFlags(farmer);
  return farmer;
}

export function addFarmer(input: FarmerInput): Farmer {
  const farmer = createFarmer(input);
  mutate((db) => {
    db.farmers.push(farmer);
    enqueue(db, { kind: "CREATE_FARMER", farmer });
  });
  return farmer;
}

export function updateFarmer(id: string, patch: Partial<FarmerInput>): void {
  mutate((db) => {
    const f = db.farmers.find((x) => x.id === id);
    if (!f) return;
    if (patch.fullName !== undefined) f.fullName = patch.fullName.trim();
    if (patch.phone !== undefined) f.phone = normalizeUgPhone(patch.phone).normalized ?? patch.phone.trim();
    if (patch.nin !== undefined) f.nin = patch.nin.trim() || undefined;
    if (patch.district !== undefined) f.district = patch.district;
    if (patch.subCounty !== undefined) f.subCounty = patch.subCounty;
    if (patch.village !== undefined) f.village = patch.village.trim() || undefined;
    if (patch.acreage !== undefined) f.acreage = Number(patch.acreage) || 0;
    if (patch.primaryCrops !== undefined) f.primaryCrops = patch.primaryCrops;
    if (patch.irrigationType !== undefined) f.irrigationType = patch.irrigationType;
    if (patch.gender !== undefined) f.gender = patch.gender;
    if (patch.refugeeStatus !== undefined) f.refugeeStatus = patch.refugeeStatus;
    if (patch.ageGroup !== undefined) f.ageGroup = patch.ageGroup;
    if (patch.landOwnership !== undefined) f.landOwnership = patch.landOwnership;
    if (patch.householdSize !== undefined) f.householdSize = patch.householdSize;
    if (patch.plannedProductions !== undefined) f.plannedProductions = patch.plannedProductions;
    if (patch.survey !== undefined) {
      f.survey = { ...DEFAULT_SURVEY, ...patch.survey };
      // keep mirrors in sync with the questionnaire
      if (patch.survey.currentCrops && patch.survey.currentCrops.length > 0) {
        const names = [...new Set(patch.survey.currentCrops.map((c) => c.crop).filter(Boolean))];
        if (names.length > 0) f.primaryCrops = names;
      }
      if (patch.survey.householdAdults !== undefined || patch.survey.householdChildren !== undefined) {
        const adults = patch.survey.householdAdults ?? f.survey.householdAdults ?? 0;
        const children = patch.survey.householdChildren ?? f.survey.householdChildren ?? 0;
        if (adults + children > 0) f.householdSize = adults + children;
      }
      if (patch.survey.ageYears) f.ageGroup = ageGroupFromYears(patch.survey.ageYears);
      if (patch.survey.landOwnershipOther !== undefined) f.landOwnership = "OTHER";
    }
    f.scaleTier = computeScaleTier(f.acreage);
    f.rokiTier = computeRokiTier(f, db.logs);
    f.flags = computeFarmerFlags(f);
    f.updatedAt = new Date().toISOString();
    // acreage/crop changes re-run the rule engine over this farmer's logs
    for (const log of db.logs.filter((l) => l.farmerId === id)) {
      const ev = evaluateLog(log, f, db.logs, db.settings);
      log.status = ev.status;
      log.auditNotes = ev.auditNotes;
      log.yieldScore = ev.yieldScore;
    }
    enqueue(db, { kind: "UPDATE_FARMER", farmer: f });
  });
}

/**
 * Merge several farmer records into one master:
 *  - reassign all their harvest logs to the master
 *  - merge planting history, production plans and crop lists (no dups)
 *  - fill any missing master fields from the merged records
 *  - delete the merged-away records
 * Rule engine (tiers) is recomputed afterwards.
 * Records linked to an account must NOT be merged away (caller enforces).
 */
export function mergeFarmers(masterId: string, otherIds: string[], dbOverride?: Db): { merged: number } {
  const ok = { merged: 0 };
  const run = (db: Db) => {
    const master = db.farmers.find((f) => f.id === masterId);
    if (!master || otherIds.length === 0) return;
    const others = db.farmers.filter((f) => otherIds.includes(f.id));

    for (const o of others) {
      // reassign logs
      for (const l of db.logs) {
        if (l.farmerId === o.id) l.farmerId = masterId;
      }
      // planting history (dedupe by crop)
      const crops = new Set((master.plantingHistory ?? []).map((x) => x.crop.toLowerCase()));
      for (const ph of o.plantingHistory ?? []) {
        if (!crops.has(ph.crop.toLowerCase())) {
          master.plantingHistory = [...(master.plantingHistory ?? []), ph];
          crops.add(ph.crop.toLowerCase());
        }
      }
      // production plans (dedupe by crop)
      for (const pp of o.plannedProductions) {
        if (!master.plannedProductions.some((x) => x.crop === pp.crop)) {
          master.plannedProductions.push(pp);
        }
      }
      // crops union
      for (const c of o.primaryCrops) {
        if (!master.primaryCrops.includes(c)) master.primaryCrops.push(c);
      }
      // fill missing fields
      if (!master.phone && o.phone) master.phone = o.phone;
      if (!master.email && o.email) master.email = o.email;
      if (!master.fullName.trim() && o.fullName) master.fullName = o.fullName;
      if (!master.district && o.district) master.district = o.district;
      if (!master.subCounty && o.subCounty) master.subCounty = o.subCounty;
      if (!master.village && o.village) master.village = o.village;
      if (!master.nin && o.nin) master.nin = o.nin;
      if (o.acreage > master.acreage) master.acreage = o.acreage;
      if (o.survey) {
        master.survey = {
          ...o.survey,
          ...(master.survey ?? {}),
        };
      }
      ok.merged += 1;
    }

    master.updatedAt = new Date().toISOString();
    db.farmers = db.farmers.filter((f) => !otherIds.includes(f.id));
    enqueue(db, { kind: "UPDATE_FARMER", farmer: master });
    enqueue(db, { kind: "DELETE_FARMERS", ids: otherIds });
    // recompute tiers
    for (const f of db.farmers) f.rokiTier = computeRokiTier(f, db.logs);
  };
  if (dbOverride) {
    run(dbOverride);
    return ok;
  }
  mutate(run);
  void syncNow();
  return ok;
}

export function deleteFarmers(ids: string[]): void {
  mutate((db) => {
    db.farmers = db.farmers.filter((f) => !ids.includes(f.id));
    db.logs = db.logs.filter((l) => !ids.includes(l.farmerId));
    enqueue(db, { kind: "DELETE_FARMERS", ids });
  });
}

// ------------------------------------------------------------------
// Produce log actions
// ------------------------------------------------------------------
export interface LogInput {
  farmerId: string;
  cropType: string;
  quantityKg: number;
  qualityGrade: QualityGrade;
  harvestDate: string;
  batchId?: string;
  storageLocation?: string;
  source?: LogSource;
}

export function createLog(input: LogInput): ProduceLog {
  const db = loadDb();
  const log: ProduceLog = {
    id: nextLogId(db),
    farmerId: input.farmerId,
    cropType: input.cropType,
    quantityKg: Number(input.quantityKg) || 0,
    qualityGrade: input.qualityGrade,
    harvestDate: input.harvestDate,
    batchId: input.batchId?.trim() || undefined,
    storageLocation: input.storageLocation?.trim() || undefined,
    status: "VERIFIED",
    auditNotes: [],
    yieldScore: "EXPECTED",
    source: input.source ?? "FIELD_AGENT",
    createdAt: new Date().toISOString(),
  };
  const farmer = db.farmers.find((f) => f.id === log.farmerId);
  const ev = evaluateLog(log, farmer, db.logs, db.settings);
  log.status = ev.status;
  log.auditNotes = ev.auditNotes;
  log.yieldScore = ev.yieldScore;
  return log;
}

export function addLog(input: LogInput): ProduceLog {
  const log = createLog(input);
  mutate((db) => {
    db.logs.push(log);
    const farmer = db.farmers.find((f) => f.id === log.farmerId);
    if (farmer) farmer.rokiTier = computeRokiTier(farmer, db.logs);
    enqueue(db, { kind: "CREATE_LOG", log });
  });
  return log;
}

/** Update + re-run the rule engine on a single log (inline grid edits). */
export function updateLog(id: string, patch: Partial<LogInput>): void {
  mutate((db) => {
    const log = db.logs.find((l) => l.id === id);
    if (!log) return;
    if (patch.farmerId !== undefined) log.farmerId = patch.farmerId;
    if (patch.cropType !== undefined) log.cropType = patch.cropType;
    if (patch.quantityKg !== undefined) log.quantityKg = Number(patch.quantityKg) || 0;
    if (patch.qualityGrade !== undefined) log.qualityGrade = patch.qualityGrade;
    if (patch.harvestDate !== undefined) log.harvestDate = patch.harvestDate;
    if (patch.batchId !== undefined) log.batchId = patch.batchId?.trim() || undefined;
    if (patch.storageLocation !== undefined) log.storageLocation = patch.storageLocation?.trim() || undefined;
    const farmer = db.farmers.find((f) => f.id === log.farmerId);
    const ev = evaluateLog(log, farmer, db.logs, db.settings);
    log.status = ev.status;
    log.auditNotes = ev.auditNotes;
    log.yieldScore = ev.yieldScore;
    if (farmer) farmer.rokiTier = computeRokiTier(farmer, db.logs);
    enqueue(db, { kind: "UPDATE_LOG", log });
  });
}

export function deleteLogs(ids: string[]): void {
  mutate((db) => {
    db.logs = db.logs.filter((l) => !ids.includes(l.id));
    for (const farmer of db.farmers) farmer.rokiTier = computeRokiTier(farmer, db.logs);
    enqueue(db, { kind: "DELETE_LOGS", ids });
  });
}

export function reassignLogs(ids: string[], farmerId: string): void {
  mutate((db) => {
    const farmer = db.farmers.find((f) => f.id === farmerId);
    if (!farmer) return;
    for (const log of db.logs.filter((l) => ids.includes(l.id))) {
      log.farmerId = farmerId;
      const ev = evaluateLog(log, farmer, db.logs, db.settings);
      log.status = ev.status;
      log.auditNotes = ev.auditNotes;
      log.yieldScore = ev.yieldScore;
      enqueue(db, { kind: "UPDATE_LOG", log });
    }
    for (const f of db.farmers) f.rokiTier = computeRokiTier(f, db.logs);
  });
}

// ------------------------------------------------------------------
// Settings & session
// ------------------------------------------------------------------
export function updateSettings(patch: Partial<Settings>): void {
  mutate((db) => {
    db.settings = { ...db.settings, ...patch };
  });
}

export function updateCropDefaults(crop: string, maxPerAcreKg: number, typicalPerAcreKg: number): void {
  mutate((db) => {
    db.settings.crops[crop] = { maxPerAcreKg, typicalPerAcreKg };
    // re-run the engine over affected logs so flags stay truthful
    for (const log of db.logs.filter((l) => l.cropType === crop)) {
      const farmer = db.farmers.find((f) => f.id === log.farmerId);
      const ev = evaluateLog(log, farmer, db.logs, db.settings);
      log.status = ev.status;
      log.auditNotes = ev.auditNotes;
      log.yieldScore = ev.yieldScore;
    }
  });
}

export function setRole(role: Role): void {
  mutate((db) => {
    db.meta.role = role;
  });
}

export function setAgentCode(code: string): void {
  mutate((db) => {
    db.meta.agentCodeHash = hashCode(code);
  });
}

/** Whether the given code matches the configured agent code. */
export function matchesAgentCode(code: string): boolean {
  const db = loadDb();
  const expected = db.meta.agentCodeHash ?? agentCodeHash();
  return hashCode(code.trim()) === expected;
}

/** True when the current session came from the agent access code (not an account). */
export function isAgentSession(): boolean {
  return !remoteConfigured() && loadDb().meta.role === "FIELD_AGENT";
}

export function setLanguage(lang: string): void {
  mutate((db) => {
    db.meta.language = lang;
  });
}

export function setDemoFarmer(id: string): void {
  mutate((db) => {
    db.meta.demoFarmerId = id;
  });
}

// ------------------------------------------------------------------
// Bulk import (staging → database)
// ------------------------------------------------------------------
export interface ImportSummary {
  createdFarmers: number;
  createdLogs: number;
  linkedExisting: number;
  skippedWithErrors: number;
  warnings: number;
  results: { row: number; message: string; ok: boolean }[];
}

export function importStaging(st: StagingState, dbOverride?: Db): ImportSummary {
  const summary: ImportSummary = {
    createdFarmers: 0,
    createdLogs: 0,
    linkedExisting: 0,
    skippedWithErrors: 0,
    warnings: 0,
    results: [],
  };

  const run = (db: Db) => {
    for (const row of st.rows) {
      summary.warnings += row.warnings.length;
      if (row.errors.length > 0) {
        summary.skippedWithErrors += 1;
        summary.results.push({ row: row.rowIndex, message: row.errors[0], ok: false });
        continue;
      }

      // --- resolve or create farmer -------------------------------
      let farmer: Farmer | undefined = db.farmers.find((f) => f.id === row.farmerId);
      if (!farmer && row.parsed.phone) {
        const ph = normalizeUgPhone(String(row.parsed.phone));
        if (ph.ok) farmer = db.farmers.find((f) => f.phone === ph.normalized);
      }
      if (!farmer && row.parsed.email) {
        const em = String(row.parsed.email).trim().toLowerCase();
        farmer = db.farmers.find((f) => (f.email ?? "").toLowerCase() === em);
      }

      if (!farmer) {
        const name = String(row.parsed.fullName ?? "").trim() || (row.parsed.email ? String(row.parsed.email) : "");
        if (!name) {
          summary.skippedWithErrors += 1;
          summary.results.push({ row: row.rowIndex, message: "No farmer name to create a profile", ok: false });
          continue;
        }
        const ph = row.parsed.phone ? normalizeUgPhone(String(row.parsed.phone)) : undefined;
        const crops =
          String(row.parsed.crops ?? "")
            .split(/[,\/]/)
            .map((s) => s.trim())
            .filter(Boolean);
        const cropType = row.parsed.cropType ? String(row.parsed.cropType) : undefined;
        if (cropType && !crops.includes(cropType)) crops.push(cropType);

        const isLogRow = row.isLogRow;
        const acreage =
          typeof row.parsed.acreage === "number"
            ? row.parsed.acreage
            : isLogRow && cropType
              ? 1
              : 0;

        farmer = {
          id: nextFarmerId(db),
          fullName: name,
          phone: ph?.normalized ?? (row.parsed.phone ? String(row.parsed.phone) : ""),
          nin: row.parsed.nin ? String(row.parsed.nin) : undefined,
          district: String(row.parsed.district ?? ""),
          subCounty: String(row.parsed.subCounty ?? ""),
          village: row.parsed.village ? String(row.parsed.village) : undefined,
          acreage,
          primaryCrops: crops.length > 0 ? crops : [cropType ?? "Other"],
          irrigationType: "NONE",
          scaleTier: computeScaleTier(acreage),
          rokiTier: 3,
          gender: (row.parsed.gender as Gender) ?? "M",
          refugeeStatus: (row.parsed.refugeeStatus as RefugeeStatus) ?? "NONE",
          ageGroup: "36-45",
          landOwnership: "OWN",
          plannedProductions: [],
          survey: { ...DEFAULT_SURVEY },
          plantingHistory: buildPlantingHistory(row.parsed),
          flags: [] as FarmerFlag[],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        farmer.scaleTier = computeScaleTier(farmer.acreage);
        farmer.flags = computeFarmerFlags(farmer);
        db.farmers.push(farmer);
        enqueue(db, { kind: "CREATE_FARMER", farmer });
        summary.createdFarmers += 1;
        summary.results.push({ row: row.rowIndex, message: `Created profile ${farmer.id}, ${farmer.fullName}`, ok: true });
      } else {
        summary.linkedExisting += 1;
        summary.results.push({ row: row.rowIndex, message: `Linked to ${farmer.id}, ${farmer.fullName}`, ok: true });
      }

      // --- create produce log when the row carries produce data ------
      if (row.isLogRow && farmer) {
        const qty =
          typeof row.parsed.quantityKg === "number" ? row.parsed.quantityKg : 0;
        if (qty <= 0) {
          summary.skippedWithErrors += 1;
          summary.results.push({ row: row.rowIndex, message: "Produce row has no valid quantity", ok: false });
          continue;
        }
        const rawCrop = String(row.parsed.cropType ?? farmer.primaryCrops[0] ?? "Other");
        const cropType =
          CROPS_LIST.find((c) => c.toLowerCase() === rawCrop.toLowerCase()) ??
          CROPS_LIST.find((c) => rawCrop.toLowerCase().includes(c.toLowerCase())) ??
          "Other";
        const log: ProduceLog = {
          id: nextLogId(db),
          farmerId: farmer.id,
          cropType,
          quantityKg: qty,
          qualityGrade: (row.parsed.qualityGrade as QualityGrade) ?? "A",
          harvestDate: String(row.parsed.harvestDate ?? todayISO()),
          batchId: row.parsed.batchId ? String(row.parsed.batchId) : undefined,
          storageLocation: row.parsed.storageLocation ? String(row.parsed.storageLocation) : undefined,
          status: "VERIFIED",
          auditNotes: [],
          yieldScore: "EXPECTED",
          source: "BULK_IMPORT",
          createdAt: new Date().toISOString(),
        };
        const ev = evaluateLog(log, farmer, db.logs, db.settings);
        log.status = ev.status;
        log.auditNotes = ev.auditNotes;
        log.yieldScore = ev.yieldScore;
        db.logs.push(log);
        enqueue(db, { kind: "CREATE_LOG", log });
        summary.createdLogs += 1;
        if (log.status !== "VERIFIED") {
          summary.results.push({
            row: row.rowIndex,
            message: `Log ${log.id} created, ${log.status === "FLAGGED" ? "FLAGGED (duplicate check)" : "NEEDS AUDIT (yield ceiling)"}: ${log.auditNotes[0] ?? ""}`.slice(0, 200),
            ok: true,
          });
        }
      }
    }

    for (const f of db.farmers) f.rokiTier = computeRokiTier(f, db.logs);
  };

  if (dbOverride) {
    run(dbOverride);
    return summary;
  }
  mutate(run);
  return summary;
}

const CROPS_LIST = Object.keys(CROP_DEFAULTS);

// ------------------------------------------------------------------
// Demo data reset (demo mode only — local)
// ------------------------------------------------------------------
export function resetDemoData(): void {
  cache = buildSeed();
  persist(cache);
  listeners.forEach((l) => l());
}

// ------------------------------------------------------------------
// Delete ALL data (admins) — local store cleared, and the deletions are
// queued + pushed to Supabase so the cloud matches. Use with care.
// ------------------------------------------------------------------
export function wipeAllData(): void {
  const db = loadDb();
  const farmerIds = db.farmers.map((f) => f.id);
  const logIds = db.logs.map((l) => l.id);
  mutate((d) => {
    d.farmers = [];
    d.logs = [];
    d.meta.outbox = [];
    d.meta.nextFarmerSeq = 1;
    d.meta.nextLogSeq = 1;
    if (remoteConfigured()) {
      if (logIds.length > 0) d.meta.outbox.push({ kind: "DELETE_LOGS", ids: logIds });
      if (farmerIds.length > 0) d.meta.outbox.push({ kind: "DELETE_FARMERS", ids: farmerIds });
    }
  });
  void syncNow();
}

/** Collect planting-history entries from a staged row (dedupe by crop). */
function buildPlantingHistory(parsed: StagingState["rows"][number]["parsed"]) {
  const crop = parsed.cropType ? String(parsed.cropType) : undefined;
  if (!crop) return undefined;
  return [
    {
      id: `PH-${Date.now()}-${crop.slice(0, 4).toUpperCase()}`,
      crop,
      acres: typeof parsed.acreage === "number" ? parsed.acreage : 0,
      plantingDate: parsed.plantingDate ? String(parsed.plantingDate) : undefined,
      sourceOfSeed: parsed.sourceOfSeed ? String(parsed.sourceOfSeed) : undefined,
      status: parsed.plantingStatus ? String(parsed.plantingStatus) : undefined,
    },
  ];
}
