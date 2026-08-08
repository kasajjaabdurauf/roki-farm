// ------------------------------------------------------------------
// Roki, remote (Supabase) layer.
//
// The app is offline-first: the UI always reads/writes the local store
// (src/lib/db.ts). This module is the *only* place that talks to
// Supabase, it handles auth, pulling remote tables into the local
// store, and pushing queued mutations to the cloud.
//
// When NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are
// set, the app runs in "production mode" (real auth + cloud sync).
// Without them it runs in demo mode (local-only, persona switcher).
// ------------------------------------------------------------------

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Farmer,
  FarmerSurvey,
  OutboxOp,
  PlannedProduction,
  ProduceLog,
  QualityGrade,
  RokiTier,
  ScaleTier,
} from "./types";

let client: SupabaseClient | null = null;

/**
 * Validate the config so a malformed env var (stray quotes, trailing
 * spaces/newlines, placeholder URL) can NEVER crash the app — it just
 * falls back to demo mode with a clear console warning.
 */
/** True when the Supabase env vars are set at all (even if invalid). */
export function remoteVarsPresent(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function configValid(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    if (typeof console !== "undefined") {
      console.warn(
        "[Roki] NEXT_PUBLIC_SUPABASE_URL is not a valid URL — running in demo mode.",
        JSON.stringify(url)
      );
    }
    return false;
  }
}

export function sb(): SupabaseClient | null {
  if (typeof window === "undefined") return null; // server-side: no client
  if (!configValid()) return null;
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(), {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export function remoteConfigured(): boolean {
  return configValid();
}

// ------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------
export async function getSession() {
  const c = sb();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}

/**
 * Server-validated session. Unlike getSession (which only reads the
 * local token), this asks Supabase whether the user still exists.
 * If the account was deleted (e.g. a factory reset), the local token
 * is discarded and null is returned so the app signs the user out.
 */
export async function validateSession(): Promise<{ user: { id: string; email?: string | null } } | null> {
  const c = sb();
  if (!c) return null;
  try {
    const { data, error } = await c.auth.getUser();
    if (!error && data.user) return { user: data.user };
    // Only DEFINITIVE auth errors (invalid/expired/revoked token, deleted
    // user) mean the session is dead. Everything else (network blips,
    // timeouts) must never bounce a signed-in user — keep the cached
    // session instead.
    const msg = (error?.message ?? "").toLowerCase();
    const definitelyInvalid =
      !!error &&
      (msg.includes("invalid") || msg.includes("expired") || msg.includes("revoked") ||
        msg.includes("jwt") || msg.includes("token") || msg.includes("not found") ||
        msg.includes("user") || msg.includes("401") || msg.includes("403"));
    if (definitelyInvalid) {
      await c.auth.signOut().catch(() => {});
      return null;
    }
    // network / transient / unknown: keep the cached session
    const { data: cached } = await c.auth.getSession();
    return cached.session ? { user: cached.session.user } : null;
  } catch {
    // hard failure (offline): keep the cached session, never bounce
    try {
      const { data: cached } = await c.auth.getSession();
      return cached.session ? { user: cached.session.user } : null;
    } catch {
      return null;
    }
  }
}

export function onAuthChange(cb: (event: string, session: unknown) => void) {
  const c = sb();
  if (!c) return null;
  return c.auth.onAuthStateChange(cb);
}

export async function signInWithEmail(email: string, password: string) {
  const c = sb();
  if (!c) throw new Error("Backend not configured, run in demo mode or set Supabase keys.");
  return c.auth.signInWithPassword({ email, password });
}

export async function signInWithMagicLink(email: string) {
  const c = sb();
  if (!c) throw new Error("Backend not configured, run in demo mode or set Supabase keys.");
  return c.auth.signInWithOtp({ email });
}

export async function signUp(email: string, password: string) {
  const c = sb();
  if (!c) throw new Error("Backend not configured, run in demo mode or set Supabase keys.");
  // Two-group model: every self-signup is a FIELD AGENT (agents onboard
  // farmers; farmers don't use the app). ADMIN can never be self-selected
  // (the first account on a fresh database becomes Admin automatically).
  return c.auth.signUp({
    email,
    password,
    options: { data: { role: "FIELD_AGENT" } },
  });
}

/** Send a password reset email (Supabase handles the recovery link). */
export async function resetPasswordForEmail(email: string) {
  const c = sb();
  if (!c) throw new Error("Backend not configured, run in demo mode or set Supabase keys.");
  return c.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

/** Set a new password (called from the recovery page with a valid session). */
export async function updatePassword(newPassword: string) {
  const c = sb();
  if (!c) throw new Error("Backend not configured, run in demo mode or set Supabase keys.");
  return c.auth.updateUser({ password: newPassword });
}

export async function signOut() {
  const c = sb();
  if (!c) return;
  await c.auth.signOut();
}

/** The authenticated user's profile row (role + linked farmer id). */
export async function fetchMyProfile() {
  const c = sb();
  const session = await getSession();
  if (!c || !session?.user) return null;
  const { data } = await c
    .from("profiles")
    .select("id, role, farmer_id, full_name")
    .eq("id", session.user.id)
    .maybeSingle();
  return data as { id: string; role: string; farmer_id: string | null; full_name: string | null } | null;
}

// ------------------------------------------------------------------
// Row mapping (snake_case DB <-> camelCase app model)
// ------------------------------------------------------------------
function rowToFarmer(r: any): Farmer {
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email ?? undefined,
    phone: r.phone ?? "",
    nin: r.nin ?? undefined,
    district: r.district ?? "",
    subCounty: r.sub_county ?? "",
    village: r.village ?? undefined,
    acreage: r.acreage ?? 0,
    primaryCrops: r.primary_crops ?? [],
    irrigationType: r.irrigation_type ?? "NONE",
    scaleTier: (r.scale_tier ?? "MICRO") as ScaleTier,
    rokiTier: (r.roki_tier ?? 3) as RokiTier,
    gender: r.gender ?? "M",
    refugeeStatus: r.refugee_status ?? "NONE",
    ageGroup: r.age_group ?? "36-45",
    landOwnership: r.land_ownership ?? "OWN",
    householdSize: r.household_size ?? undefined,
    plannedProductions: (r.planned_productions ?? []) as PlannedProduction[],
    survey: (r.survey ?? undefined) as FarmerSurvey | undefined,
    loggedBy: r.logged_by ?? undefined,
    flags: r.flags ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function farmerToRow(f: Farmer) {
  return {
    id: f.id,
    full_name: f.fullName,
    email: f.email ?? null,
    phone: f.phone,
    nin: f.nin ?? null,
    district: f.district,
    sub_county: f.subCounty,
    village: f.village ?? null,
    acreage: f.acreage,
    primary_crops: f.primaryCrops,
    irrigation_type: f.irrigationType,
    scale_tier: f.scaleTier,
    roki_tier: f.rokiTier,
    gender: f.gender,
    refugee_status: f.refugeeStatus,
    age_group: f.ageGroup,
    land_ownership: f.landOwnership,
    household_size: f.householdSize ?? null,
    planned_productions: f.plannedProductions,
    survey: f.survey ?? null,
    logged_by: f.loggedBy ?? null,
    flags: f.flags,
    created_at: f.createdAt,
    updated_at: f.updatedAt,
  };
}

function rowToLog(r: any): ProduceLog {
  return {
    id: r.id,
    farmerId: r.farmer_id,
    cropType: r.crop_type,
    quantityKg: r.quantity_kg ?? 0,
    qualityGrade: (r.quality_grade ?? "A") as QualityGrade,
    harvestDate: r.harvest_date,
    batchId: r.batch_id ?? undefined,
    storageLocation: r.storage_location ?? undefined,
    status: r.status ?? "VERIFIED",
    auditNotes: r.audit_notes ?? [],
    yieldScore: r.yield_score ?? "EXPECTED",
    source: r.source ?? "FIELD_AGENT",
    createdAt: r.created_at,
  };
}

function logToRow(l: ProduceLog) {
  return {
    id: l.id,
    farmer_id: l.farmerId,
    crop_type: l.cropType,
    quantity_kg: l.quantityKg,
    quality_grade: l.qualityGrade,
    harvest_date: l.harvestDate,
    batch_id: l.batchId ?? null,
    storage_location: l.storageLocation ?? null,
    status: l.status,
    audit_notes: l.auditNotes,
    yield_score: l.yieldScore,
    source: l.source,
    created_at: l.createdAt,
  };
}

// ------------------------------------------------------------------
// Pull: fetch everything into the caller (db.ts stores it locally)
// ------------------------------------------------------------------
export async function fetchAll(): Promise<{ farmers: Farmer[]; logs: ProduceLog[] } | null> {
  const c = sb();
  if (!c) return null;
  // NOTE: works WITHOUT a session so access-code agents (no login) can
  // see the real database. Read-only via anon RLS; writes still require
  // an authenticated session.
  const [fRes, lRes] = await Promise.all([
    c.from("farmers").select("*").order("created_at"),
    c.from("produce_logs").select("*").order("created_at"),
  ]);
  if (fRes.error) throw new Error(`Could not load farmers: ${fRes.error.message}`);
  if (lRes.error) throw new Error(`Could not load harvest logs: ${lRes.error.message}`);
  return {
    farmers: (fRes.data ?? []).map(rowToFarmer),
    logs: (lRes.data ?? []).map(rowToLog),
  };
}

/**
 * Lightweight cloud counts (HEAD queries — no rows transferred). Used by
 * Settings → Data management so admins can see "on this device" vs "in
 * the cloud" at a glance and spot a device whose local copy has drifted
 * (e.g. leftover records from before a cloud reset).
 */
export async function fetchCloudCounts(): Promise<{ farmers: number; logs: number } | null> {
  const c = sb();
  if (!c) return null;
  try {
    const [f, l] = await Promise.all([
      c.from("farmers").select("id", { count: "exact", head: true }),
      c.from("produce_logs").select("id", { count: "exact", head: true }),
    ]);
    if (f.error || l.error) throw new Error(f.error?.message ?? l.error?.message ?? "count failed");
    return { farmers: f.count ?? 0, logs: l.count ?? 0 };
  } catch {
    return null; // offline / transient — caller shows "unavailable"
  }
}

// ------------------------------------------------------------------
// Push: apply one queued mutation to Supabase
// ------------------------------------------------------------------
export async function pushOp(op: OutboxOp): Promise<void> {
  const c = sb();
  if (!c) return;
  // NOTE: access-code agents have NO auth session, but they still need to
  // push (register farmers, log harvests). The RLS policies allow anon
  // inserts, so we do NOT require a session here — the anon key suffices.

  switch (op.kind) {
    case "CREATE_FARMER":
    case "UPDATE_FARMER": {
      const row = farmerToRow(op.farmer);
      const { error } = await c.from("farmers").upsert(row, { onConflict: "id" });
      if (error) throw new Error(error.message);
      break;
    }
    case "DELETE_FARMERS": {
      const { error } = await c.from("farmers").delete().in("id", op.ids);
      if (error) throw new Error(error.message);
      break;
    }
    case "CREATE_LOG":
    case "UPDATE_LOG": {
      const row = logToRow(op.log);
      const { error } = await c.from("produce_logs").upsert(row, { onConflict: "id" });
      if (error) {
        // Surface the real reason: 401 = bad/missing anon key or session,
        // 403 = RLS denial, other = server issue.
        const status = (error as { status?: number }).status;
        const hint =
          status === 401
            ? "AUTH/KEY ERROR (check NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel)"
            : status === 403
              ? "RLS DENIED (check policies)"
              : "SERVER ERROR";
        throw new Error(`[${hint}] ${error.message}`);
      }
      break;
    }
    case "DELETE_LOGS": {
      const { error } = await c.from("produce_logs").delete().in("id", op.ids);
      if (error) throw new Error(error.message);
      break;
    }
  }
}

// ------------------------------------------------------------------
// Team management (admin only — enforced by RLS)
// ------------------------------------------------------------------
export interface TeamMember {
  id: string;
  email: string | null;
  role: string;
  farmer_id: string | null;
  full_name: string | null;
  created_at: string;
}

/** Admin: list all profiles. Non-admins get their own row only. */
export async function fetchAllProfiles(): Promise<TeamMember[]> {
  const c = sb();
  if (!c) return [];
  const { data, error } = await c.from("profiles").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMember[];
}

/** Admin: update a profile's role and optional farmer link. */
export async function updateProfileRole(
  uid: string,
  role: string,
  farmerId?: string | null
): Promise<void> {
  const c = sb();
  if (!c) return;
  const patch: Record<string, unknown> = { role };
  if (farmerId !== undefined) patch.farmer_id = farmerId || null;
  const { error } = await c.from("profiles").update(patch).eq("id", uid);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------------
// Agent access code — stored HASHED in the cloud settings row (id=1)
// so every device sees the same code. Admin-only update (RLS).
// ------------------------------------------------------------------
export async function fetchAgentCodeHash(): Promise<string | null> {
  const c = sb();
  if (!c) return null;
  // NOTE: must work WITHOUT a session — the agent enters the code before
  // signing in (anonymous). RLS for this column allows anon read.
  const { data, error } = await c.from("settings").select("agent_code_hash").eq("id", 1).maybeSingle();
  if (error) {
    // column missing (migration not run) or RLS: degrade gracefully
    console.warn("[Roki] could not read agent code hash from settings:", error.message);
    return null;
  }
  if (!data) return null;
  return (data.agent_code_hash as string) ?? null;
}

export async function updateAgentCodeHash(hash: string): Promise<void> {
  const c = sb();
  if (!c) return;
  // UPSERT: if the settings row (id=1) doesn't exist yet, create it —
  // a plain update on a missing row affects 0 rows with no error, which
  // silently "succeeded" before and never actually saved the code.
  const { error } = await c.from("settings").upsert(
    { id: 1, agent_code_hash: hash, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (error) throw new Error(error.message);
}
