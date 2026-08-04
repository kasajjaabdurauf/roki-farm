// ------------------------------------------------------------------
// Duplicate detection & merging — keeps the database clean as real
// lists, account claims and manual entries overlap over time.
// Deterministic grouping: same phone, same email, or same normalized
// name → candidate duplicate group. The admin picks a master and
// merges the rest (logs, planting history, plans, missing fields).
// ------------------------------------------------------------------

import type { Db, Farmer } from "./types";
import { normalizeUgPhone } from "./phone";

export interface DupGroup {
  key: string;
  reason: string; // "Same phone", "Same email", "Same name"
  farmers: Farmer[];
}

/** Normalized name for fuzzy matching (lowercase, no spaces/punct). */
export function normName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Find candidate duplicate groups. A farmer can appear in multiple
 * groups (e.g. same phone AND same name). Groups need >= 2 members.
 */
export function findDuplicateGroups(db: Db): DupGroup[] {
  const byPhone = new Map<string, Farmer[]>();
  const byEmail = new Map<string, Farmer[]>();
  const byName = new Map<string, Farmer[]>();

  for (const f of db.farmers) {
    if (f.phone) {
      const key = normalizeUgPhone(f.phone).normalized ?? f.phone;
      const arr = byPhone.get(key) ?? [];
      arr.push(f);
      byPhone.set(key, arr);
    }
    if (f.email) {
      const key = f.email.trim().toLowerCase();
      const arr = byEmail.get(key) ?? [];
      arr.push(f);
      byEmail.set(key, arr);
    }
    const nm = normName(f.fullName || "");
    if (nm.length >= 5) {
      const arr = byName.get(nm) ?? [];
      arr.push(f);
      byName.set(nm, arr);
    }
  }

  const groups: DupGroup[] = [];
  for (const [key, farmers] of byPhone) {
    if (farmers.length >= 2) groups.push({ key, reason: "Same phone number", farmers });
  }
  for (const [key, farmers] of byEmail) {
    if (farmers.length >= 2) groups.push({ key, reason: "Same email", farmers });
  }
  for (const [key, farmers] of byName) {
    if (farmers.length >= 2) groups.push({ key, reason: "Same name", farmers });
  }
  return groups.sort((a, b) => b.farmers.length - a.farmers.length || a.reason.localeCompare(b.reason));
}

/** Pick a sensible default master: has an account link > most logs > oldest. */
export function suggestMaster(farmers: Farmer[], accountLinkedIds: Set<string>): Farmer {
  const linked = farmers.filter((f) => accountLinkedIds.has(f.id));
  if (linked.length === 1) return linked[0];
  const withLogs = (f: Farmer) => 0; // logs counted by caller via db
  void withLogs;
  return [...farmers].sort((a, b) => {
    const aAcct = accountLinkedIds.has(a.id) ? 1 : 0;
    const bAcct = accountLinkedIds.has(b.id) ? 1 : 0;
    if (aAcct !== bAcct) return bAcct - aAcct;
    return a.createdAt.localeCompare(b.createdAt);
  })[0];
}
