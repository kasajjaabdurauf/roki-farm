// Verifies the role-switch fix: mutations must produce a NEW snapshot
// reference so useSyncExternalStore subscribers re-render immediately.
const store = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
(globalThis as any).navigator = { onLine: true };

import { loadDb, setRole } from "../src/lib/db";

const before = loadDb();
const roleBefore = before.meta.role;

setRole("FARMER");

const after = loadDb();
const checks = [
  ["role updated in store", after.meta.role === "FARMER"],
  ["new snapshot object reference", before !== after],
  ["new farmers array reference", before.farmers !== after.farmers],
  ["new logs array reference", before.logs !== after.logs],
  ["new meta reference", before.meta !== after.meta],
  ["same farmer data preserved", after.farmers.length === before.farmers.length],
];
let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}`);
  if (!ok) fail++;
}

setRole(roleBefore);
console.log(fail === 0 ? "\nRole switch is now instant — subscribers re-render on the same frame." : `\n${fail} checks failed`);
process.exit(fail ? 1 : 0);
