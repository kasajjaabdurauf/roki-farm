"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  GitMerge,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import { resyncFromCloud, useDb } from "@/lib/db";
import { Button, Card, EmptyState, Stat } from "@/components/ui";
import { cx } from "@/lib/format";
import { normalizeUgPhone } from "@/lib/phone";

/**
 * Data Check (admin) — one big button that validates the whole database:
 *  1. device vs cloud counts (drift from before a cloud reset)
 *  2. farmers without an agent (uncredited registrations)
 *  3. duplicate phones & duplicate names (same person twice?)
 *  4. possible agent-as-farmer records (team members registered as farmers)
 *  5. company-like names in the farmer list
 * Everything is READ-ONLY except the explicit Resync button. Nothing is
 * deleted or changed here — findings link to the tools that fix them.
 */
export default function DataCheckPage() {
  const db = useDb();
  const [cloud, setCloud] = useState<{ farmers: number; logs: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState("");

  async function checkCloud() {
    setChecking(true);
    try {
      const { fetchCloudCounts } = await import("@/lib/remote");
      const c = await fetchCloudCounts();
      setCloud(c);
    } finally {
      setChecking(false);
    }
  }

  async function doResync() {
    setResyncing(true);
    setResyncMsg("");
    try {
      const r = await resyncFromCloud();
      setResyncMsg(
        r.ok
          ? `✅ This device now matches the cloud: ${r.farmers} farmers, ${r.logs} logs.`
          : `⛔ Not resynced — ${r.reason ?? "unknown error"}`
      );
    } finally {
      setResyncing(false);
    }
  }

  // ---------- audit computations (local store) ----------
  const audit = useMemo(() => {
    const farmers = db.farmers;

    const noAgent = farmers.filter(
      (f) => !(f.loggedBy ?? "").trim() && !(f.survey?.enumeratorName ?? "").trim()
    );

    // duplicate phones (normalized, non-empty)
    const phoneGroups = new Map<string, typeof farmers>();
    for (const f of farmers) {
      const ph = f.phone ? normalizeUgPhone(f.phone).normalized ?? f.phone : "";
      if (!ph) continue;
      const g = phoneGroups.get(ph) ?? [];
      g.push(f);
      phoneGroups.set(ph, g);
    }
    const dupPhones = [...phoneGroups.entries()]
      .filter(([, g]) => g.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    // duplicate names (normalized)
    const nameGroups = new Map<string, typeof farmers>();
    for (const f of farmers) {
      const n = (f.fullName ?? "").trim().toLowerCase().replace(/\s+/g, " ");
      if (!n) continue;
      const g = nameGroups.get(n) ?? [];
      g.push(f);
      nameGroups.set(n, g);
    }
    const dupNames = [...nameGroups.entries()]
      .filter(([, g]) => g.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    // agent-as-farmer: farmer's name matches an agent name (exact, case-insensitive)
    const agentNames = new Set(
      farmers
        .map((f) => (f.loggedBy ?? f.survey?.enumeratorName ?? "").trim().toLowerCase())
        .filter((n) => n && n !== "none")
    );
    const agentsAsFarmers = farmers.filter((f) => {
      const n = (f.fullName ?? "").trim().toLowerCase();
      return agentNames.has(n);
    });

    // company-like names
    const companyRe = /ltd|limited|company|agro|processing|exports|enterprise|&/i;
    const companies = farmers.filter((f) => companyRe.test(f.fullName ?? ""));

    return { noAgent, dupPhones, dupNames, agentsAsFarmers, companies };
  }, [db.farmers]);

  const drift = cloud ? db.farmers.length - cloud.farmers : null;
  const unsynced = db.meta.outbox.length;

  const allClean =
    cloud !== null &&
    drift === 0 &&
    unsynced === 0 &&
    audit.noAgent.length === 0 &&
    audit.dupPhones.length === 0 &&
    audit.dupNames.length === 0 &&
    audit.agentsAsFarmers.length === 0 &&
    audit.companies.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-forest-900">
            <BadgeCheck className="h-6 w-6 text-ochre-500" /> Data Check
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">
            One button to validate the whole database. Everything here is read-only — fixing happens in the tools
            each finding links to.
          </p>
        </div>
        <Button size="lg" variant="accent" onClick={checkCloud} disabled={checking}>
          <RefreshCw className={cx("h-4 w-4", checking && "animate-spin")} />
          {checking ? "Checking…" : cloud ? "Re-check cloud" : "Run data check"}
        </Button>
      </div>

      {/* overall verdict */}
      {cloud !== null && (
        <Card className={cx("p-5", allClean ? "border-success-dark/40 bg-success-bg/40" : "border-ochre-300 bg-ochre-50/50")}>
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
            {allClean ? <CheckCircle2 className="h-5 w-5 text-success-dark" /> : <ShieldAlert className="h-5 w-5 text-ochre-600" />}
            {allClean ? "All clear — data is consistent" : "Found things to look at below"}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
            {allClean
              ? "This device matches the cloud, nothing is uncredited or duplicated."
              : "None of these are deleted automatically — review each finding and fix with the linked tools."}
          </p>
        </Card>
      )}

      {/* headline numbers */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="On this device"
          value={db.farmers.length}
          sub={cloud ? `cloud: ${cloud.farmers}` : "cloud: — (run check)"}
          icon={<Users className="h-5 w-5" />}
          tone={drift === null ? undefined : drift === 0 ? "success" : "warning"}
        />
        <Stat
          label="Farmers without agent"
          value={audit.noAgent.length}
          sub="no credit recorded"
          icon={<UserRound className="h-5 w-5" />}
          tone={audit.noAgent.length === 0 ? "success" : "warning"}
        />
        <Stat
          label="Duplicate phones"
          value={audit.dupPhones.length}
          sub={`${audit.dupPhones.reduce((s, [, g]) => s + g.length, 0)} farmers affected`}
          icon={<PhoneCall className="h-5 w-5" />}
          tone={audit.dupPhones.length === 0 ? "success" : "danger"}
        />
        <Stat
          label="Unsynced changes"
          value={unsynced}
          sub={unsynced === 0 ? "all synced" : "sync before resync"}
          icon={<RefreshCw className="h-5 w-5" />}
          tone={unsynced === 0 ? "success" : "danger"}
        />
      </div>

      {/* device vs cloud */}
      {cloud !== null && drift !== null && drift !== 0 && (
        <Card className="border-ochre-300 bg-ochre-50/40 p-5">
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
            <ShieldAlert className="h-5 w-5 text-ochre-600" /> This device differs from the cloud
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
            Device shows <b>{db.farmers.length}</b> farmers, the cloud has <b>{cloud.farmers}</b> (difference:{" "}
            <b>{Math.abs(drift)}</b>). This happens when a device kept local-only records (e.g. from before a
            cloud reset). The cloud is the source of truth.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="accent"
              disabled={resyncing || unsynced > 0}
              onClick={() => void doResync()}
            >
              <RefreshCw className={cx("h-4 w-4", resyncing && "animate-spin")} />
              {resyncing ? "Resyncing…" : "Resync device from cloud"}
            </Button>
            {unsynced > 0 && (
              <span className="text-[12.5px] font-semibold text-danger-600">
                {unsynced} unsynced change(s) — tap Sync now in Settings first.
              </span>
            )}
          </div>
          {resyncMsg && <p className="mt-2 text-[13px] font-semibold text-forest-800">{resyncMsg}</p>}
        </Card>
      )}

      {/* farmers without agent */}
      {audit.noAgent.length > 0 && (
        <Finding
          icon={<UserRound className="h-5 w-5" />}
          title={`${audit.noAgent.length} farmers have no agent recorded`}
          body="They were registered before agent tracking, or the name wasn't saved. You can assign an agent on each farmer's page."
        >
          <div className="flex flex-wrap gap-1.5">
            {audit.noAgent.slice(0, 12).map((f) => (
              <Link
                key={f.id}
                href={`/farmers/${f.id}`}
                className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-stone-600 hover:border-forest-500 hover:text-forest-800"
              >
                {f.fullName || f.id}
              </Link>
            ))}
            {audit.noAgent.length > 12 && (
              <span className="self-center px-1 text-[11.5px] font-semibold text-stone-400">
                +{audit.noAgent.length - 12} more
              </span>
            )}
          </div>
        </Finding>
      )}

      {/* duplicate phones */}
      {audit.dupPhones.length > 0 && (
        <Finding
          icon={<PhoneCall className="h-5 w-5" />}
          title={`${audit.dupPhones.length} phone number(s) shared by multiple farmers`}
          body="One number on several records usually means the agent typed their own phone for everyone (different people — keep them) or the same person registered twice (merge)."
        >
          <div className="space-y-2">
            {audit.dupPhones.slice(0, 6).map(([ph, g]) => (
              <p key={ph} className="text-[12.5px] text-stone-600">
                <b className="tabular">{ph}</b> — {g.length} farmers:{" "}
                <span className="text-stone-500">{g.slice(0, 5).map((f) => f.fullName || f.id).join("; ")}{g.length > 5 ? ` +${g.length - 5}` : ""}</span>
              </p>
            ))}
          </div>
          <Link href="/duplicates" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-forest-700 underline hover:text-forest-800">
            <GitMerge className="h-4 w-4" /> Open the duplicates tool
          </Link>
        </Finding>
      )}

      {/* duplicate names */}
      {audit.dupNames.length > 0 && (
        <Finding
          icon={<Users className="h-5 w-5" />}
          title={`${audit.dupNames.length} exact duplicate name(s)`}
          body="Same full name more than once — usually the same person registered twice. Compare phones and merge in the duplicates tool."
        >
          <div className="space-y-2">
            {audit.dupNames.slice(0, 6).map(([n, g]) => (
              <p key={n} className="text-[12.5px] text-stone-600">
                <b>{g[0].fullName}</b> ×{g.length} —{" "}
                <span className="text-stone-500">{g.map((f) => `${f.id}${f.phone ? ` (${f.phone})` : ""}`).join(" · ")}</span>
              </p>
            ))}
          </div>
          <Link href="/duplicates" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-forest-700 underline hover:text-forest-800">
            <GitMerge className="h-4 w-4" /> Open the duplicates tool
          </Link>
        </Finding>
      )}

      {/* agent-as-farmer */}
      {audit.agentsAsFarmers.length > 0 && (
        <Finding
          icon={<UserRound className="h-5 w-5" />}
          title={`${audit.agentsAsFarmers.length} farmer(s) whose name matches an agent`}
          body="Team members who also appear in the farmer list (self-registered or registered by a colleague). Decide whether they should stay as farmers or be removed — nothing is deleted here."
        >
          <div className="flex flex-wrap gap-1.5">
            {audit.agentsAsFarmers.map((f) => (
              <Link
                key={f.id}
                href={`/farmers/${f.id}`}
                className="rounded-full border border-ochre-300 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ochre-800 hover:border-ochre-500"
              >
                {f.fullName} · {f.id}
              </Link>
            ))}
          </div>
        </Finding>
      )}

      {/* companies */}
      {audit.companies.length > 0 && (
        <Finding
          icon={<AlertTriangle className="h-5 w-5" />}
          title={`${audit.companies.length} company-like name(s) in the farmer list`}
          body="These look like organisations, not individual farmers. Confirm whether they belong, then edit or remove."
        >
          <div className="flex flex-wrap gap-1.5">
            {audit.companies.map((f) => (
              <Link
                key={f.id}
                href={`/farmers/${f.id}`}
                className="rounded-full border border-danger-200 bg-danger-bg/50 px-2.5 py-1 text-[11.5px] font-semibold text-danger-700 hover:border-danger-400"
              >
                {f.fullName} · {f.id}
              </Link>
            ))}
          </div>
        </Finding>
      )}

      {cloud === null && (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="Press “Run data check”"
          description="It compares this device with the cloud and scans for uncredited, duplicated or suspicious records."
        />
      )}
    </div>
  );
}

function Finding({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 font-display text-lg font-semibold text-forest-900">{icon} {title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-stone-600">{body}</p>
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}
