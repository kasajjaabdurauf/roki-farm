"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, UserPlus, Users, UserCog, Wheat } from "lucide-react";
import { useDb } from "@/lib/db";
import { downloadCSV, stamp, type ExportColumn } from "@/lib/export";
import { fmtDateTime, fmtDateTimeCSV } from "@/lib/format";
import { Button, Card, EmptyState, Input, Stat } from "@/components/ui";

/**
 * Agents analytics (admin) — who registered whom, for performance pay.
 * Groups farmers by the agent named at registration ("registered by").
 */
export default function AgentsPage() {
  const db = useDb();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const map = new Map<string, { farmers: typeof db.farmers; logs: number }>();
    const unnamed: typeof db.farmers = [];
    for (const f of db.farmers) {
      // loggedBy is the primary attribution; older records may only have
      // the name inside the survey (enumeratorName) — use it as fallback.
      const agent = (f.loggedBy ?? f.survey?.enumeratorName ?? "").trim();
      if (!agent) { unnamed.push(f); continue; }
      const key = agent.toLowerCase();
      const entry = map.get(key) ?? { farmers: [], logs: 0 };
      entry.farmers.push(f);
      entry.logs += db.logs.filter((l) => l.farmerId === f.id).length;
      map.set(key, entry);
    }
    const out = [...map.entries()]
      .map(([key, e]) => ({
        name: e.farmers[0].loggedBy || e.farmers[0].survey?.enumeratorName || key,
        key,
        count: e.farmers.length,
        logs: e.logs,
        farmers: e.farmers.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }))
      .sort((a, b) => b.count - a.count);
    return { agents: out, unnamed };
  }, [db.farmers, db.logs]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return {
      agents: rows.agents.filter((a) => a.name.toLowerCase().includes(query)),
      unnamed: rows.unnamed,
    };
  }, [rows, q]);

  function exportAgents() {
    const cols: ExportColumn[] = [
      { key: "agent", label: "Agent Name" },
      { key: "farmersRegistered", label: "Farmers Registered" },
      { key: "harvestLogs", label: "Harvest Logs" },
      { key: "sample", label: "Sample Farmers", value: (r) => (r.sample as string[]).join("; ") },
    ];
    downloadCSV(
      filtered.agents.map((a) => ({
        agent: a.name,
        farmersRegistered: a.count,
        harvestLogs: a.logs,
        sample: a.farmers.slice(0, 5).map((f) => f.fullName || f.id),
      })),
      cols,
      `roki-agent-performance-${stamp("agents")}.csv`
    );
  }

  const totalRegistered = rows.agents.reduce((s, a) => s + a.count, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-forest-900">Agent performance</h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Who registered which farmer, at a glance — for crediting and performance pay.
          </p>
        </div>
        <Button variant="outline" size="lg" onClick={exportAgents} disabled={filtered.agents.length === 0}>
          <Download className="h-4 w-4" /> Download agent report
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Stat label="Named agents" value={rows.agents.length} icon={<UserCog className="h-5 w-5" />} />
        <Stat label="Farmers registered" value={totalRegistered} sub="by a named agent" icon={<Users className="h-5 w-5" />} />
        <Stat label="Farmers without agent" value={rows.unnamed.length} sub="registered before agent tracking" icon={<Users className="h-5 w-5" />} tone="warning" />
      </div>

      <div className="relative max-w-md">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search agent name…"
          className="pl-9"
        />
      </div>

      {filtered.agents.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6" />}
          title="No agent data yet"
          description="Farmers registered from now on are stamped with the agent's name. Older farmers (before agent tracking) can't be recovered."
        />
      ) : (
        <div className="space-y-4">
          {filtered.agents.map((a) => (
            <Card key={a.key} className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display text-xl font-semibold text-forest-900">{a.name}</p>
                  <p className="text-[12.5px] text-stone-400">
                    {a.count} farmer{a.count === 1 ? "" : "s"} registered · {a.logs} harvest log{a.logs === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href="/farmers/new">
                    <Button variant="outline" size="sm"><UserPlus className="h-4 w-4" /> Add farmer</Button>
                  </Link>
                  <button
                    onClick={() => {
                      const cols: ExportColumn[] = [
                        { key: "id", label: "Farmer ID" },
                        { key: "fullName", label: "Farmer Name" },
                        { key: "phone", label: "Phone" },
                        { key: "district", label: "District" },
                        { key: "createdAt", label: "Registered At (exact)", value: (r) => fmtDateTimeCSV((r as { createdAt?: string }).createdAt) },
                      ];
                      downloadCSV(a.farmers, cols, `roki-${a.name.replace(/\s+/g, "-")}-farmers.csv`);
                    }}
                  >
                    <Button variant="ghost" size="sm"><Download className="h-4 w-4" /> {a.name}&apos;s list</Button>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-stone-200 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                      <th className="py-2 pr-3 pl-1">Farmer</th>
                      <th className="py-2 pr-3">ID</th>
                      <th className="py-2 pr-3">Phone</th>
                      <th className="py-2 pr-3">District</th>
                      <th className="py-2 pr-3">Registered</th>
                      <th className="py-2">Logs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {a.farmers.slice(0, 8).map((f) => (
                      <tr key={f.id} className="hover:bg-stone-50/60">
                        <td className="py-2 pr-3 pl-1">
                          <Link href={`/farmers/${f.id}`} className="font-semibold text-forest-800 hover:underline">
                            {f.fullName || f.email || f.id}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 font-mono text-[11px] text-stone-400">{f.id}</td>
                        <td className="py-2 pr-3 text-stone-600 tabular">{f.phone || "—"}</td>
                        <td className="py-2 pr-3 text-stone-600">{f.district}</td>
                        <td className="py-2 pr-3 text-stone-400">{fmtDateTime(f.createdAt)}</td>
                        <td className="py-2 text-stone-500 tabular">{db.logs.filter((l) => l.farmerId === f.id).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {a.farmers.length > 8 && (
                <p className="mt-2 text-[12px] text-stone-400">+{a.farmers.length - 8} more — use the download for the full list.</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {rows.unnamed.length > 0 && (
        <Card className="border-warning-200 bg-warning-bg/30 p-5">
          <p className="font-display text-lg font-semibold text-warning-dark">
            {rows.unnamed.length} farmer{rows.unnamed.length === 1 ? "" : "s"} without an agent recorded
          </p>
          <p className="mt-1 text-[13px] text-stone-600">
            Some may be recoverable: names captured inside the old survey (enumerator field) can be copied back with
            the recovery script (migration v15 in Supabase). Anything still blank can be fixed by opening the farmer
            and adding the agent's name — or simply left if the farmer was registered before agent tracking started.
          </p>
        </Card>
      )}
    </div>
  );
}
