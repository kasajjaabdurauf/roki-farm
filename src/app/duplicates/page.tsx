"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, GitMerge, Loader2, ShieldCheck, Users } from "lucide-react";
import { mergeFarmers, useDb } from "@/lib/db";
import { findDuplicateGroups, suggestMaster, type DupGroup } from "@/lib/dedup";
import { fetchAllProfiles } from "@/lib/remote";
import { Badge, Button, Card, EmptyState, Stat } from "@/components/ui";
import { cx } from "@/lib/format";

/**
 * Duplicate detection & merge (admin).
 * Finds records that look like the same farmer (same phone / email /
 * name) and lets the admin merge them into one, keeping history.
 */
export default function DuplicatesPage() {
  const db = useDb();
  const [accountLinked, setAccountLinked] = useState<Set<string>>(new Set());
  const [masters, setMasters] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchAllProfiles()
      .then((ps) => setAccountLinked(new Set(ps.map((p) => p.farmer_id).filter(Boolean) as string[])))
      .catch(() => setAccountLinked(new Set()));
  }, []);

  const logCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of db.logs) m.set(l.farmerId, (m.get(l.farmerId) ?? 0) + 1);
    return m;
  }, [db.logs]);

  const groups = useMemo(() => findDuplicateGroups(db), [db]);

  // default master per group (prefer account-linked, else most logs, else oldest)
  useEffect(() => {
    setMasters((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (!next[g.key]) {
          next[g.key] = suggestMaster(g.farmers, accountLinked).id;
        }
      }
      return next;
    });
  }, [groups, accountLinked]);

  function doMerge(g: DupGroup) {
    const masterId = masters[g.key];
    if (!masterId) return;
    setBusy(g.key);
    setMessage("");
    const others = g.farmers.filter((f) => f.id !== masterId);
    const blocked = others.filter((f) => accountLinked.has(f.id));
    if (blocked.length > 0) {
      setMessage(
        `Cannot merge ${blocked.map((f) => f.id).join(", ")} — it is linked to an account. Choose it as the master instead.`
      );
      setBusy(null);
      return;
    }
    const res = mergeFarmers(masterId, others.map((f) => f.id));
    setMessage(`Merged ${res.merged} record${res.merged === 1 ? "" : "s"} into ${masterId}.`);
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-forest-900">Duplicate records</h2>
          <p className="mt-0.5 text-sm text-stone-500">
            The engine flags farmers that look like the same person (same phone, email or name). Pick the master
            record and merge — harvests, planting history and plans are combined.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Duplicate groups" value={groups.length} icon={<Copy className="h-5 w-5" />} tone="warning" />
        <Stat
          label="Records involved"
          value={groups.reduce((s, g) => s + g.farmers.length, 0)}
          icon={<Users className="h-5 w-5" />}
        />
        <Stat label="Farmers (total)" value={db.farmers.length.toLocaleString()} icon={<Users className="h-5 w-5" />} />
      </div>

      {message && (
        <p className="rounded-xl bg-success-bg px-4 py-3 text-[13px] font-semibold text-success-dark">{message}</p>
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon={<GitMerge className="h-6 w-6" />}
          title="No duplicates found"
          description="When duplicates appear (same phone, email or name on two records), they'll be listed here for one-click merging."
        />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.key} className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display text-base font-semibold text-forest-900">{g.reason}</p>
                  <p className="text-[12px] text-stone-400">
                    {g.farmers.length} records · key: <span className="font-mono">{g.key}</span>
                  </p>
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  disabled={busy === g.key}
                  onClick={() => doMerge(g)}
                >
                  {busy === g.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
                  Merge into selected
                </Button>
              </div>

              <div className="space-y-2">
                {g.farmers.map((f) => {
                  const isMaster = masters[g.key] === f.id;
                  const hasAccount = accountLinked.has(f.id);
                  const canMergeAway = !hasAccount;
                  return (
                    <label
                      key={f.id}
                      className={cx(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                        isMaster ? "border-forest-600 bg-forest-50/60" : "border-stone-200 bg-white hover:bg-stone-50",
                        !canMergeAway && !isMaster && "opacity-80"
                      )}
                    >
                      <input
                        type="radio"
                        name={g.key}
                        checked={isMaster}
                        onChange={() => setMasters((prev) => ({ ...prev, [g.key]: f.id }))}
                        className="h-4 w-4 accent-forest-700"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-stone-800">
                          {f.fullName || f.email || f.id}
                        </p>
                        <p className="truncate font-mono text-[11px] text-stone-400">
                          {f.id}
                          {f.phone ? ` · ${f.phone}` : ""}
                          {f.email ? ` · ${f.email}` : ""}
                        </p>
                        <p className="text-[11px] text-stone-400">
                          {logCounts.get(f.id) ?? 0} logs · {f.plantingHistory?.length ?? 0} plantings ·{" "}
                          {f.plannedProductions.length} plan{f.plannedProductions.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {isMaster && <Badge tone="success">Keep this</Badge>}
                        {hasAccount && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-bold text-forest-700">
                            <ShieldCheck className="h-3 w-3" /> Account linked
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-[11.5px] text-stone-400">
                Records linked to an account can only be the master (they can&apos;t be merged away, to protect logins).
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
