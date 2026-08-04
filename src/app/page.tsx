"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  ClipboardPlus,
  FileText,
  Flag,
  RefreshCw,
  Home,
  Leaf,
  MapPin,
  PackagePlus,
  Shield,
  Sprout,
  Truck,
  UploadCloud,
  UserRound,
  Users,
  Wheat,
} from "lucide-react";
import { useDb } from "@/lib/db";
import { cx, fmtDate, fmtDateTime, isoDaysAgo, relTime } from "@/lib/format";
import { fmtKg, fmtNumber } from "@/lib/rules";
import { downloadSummaryPdf } from "@/lib/report";
import { getSession } from "@/lib/remote";
import { t, type Lang } from "@/lib/i18n";
import { GENDER_LABEL, REFUGEE_LABEL, type LogStatus } from "@/lib/types";
import { Button, Card, EmptyState, Stat } from "@/components/ui";
import { GradeBadge, RokiTierBadge, SourceChip, StatusBadge, TierBadge } from "@/components/badges";

export default function DashboardPage() {
  const db = useDb();
  // Each role gets its own calibrated dashboard: farmers see only their
  // own world; staff (admin/field agent) see the operations overview.
  return db.meta.role === "FARMER" ? <FarmerHome /> : <StaffDashboard />;
}

// =====================================================================
// FARMER DASHBOARD — their own farming, logs and tips. No admin metrics.
// =====================================================================
function FarmerHome() {
  const db = useDb();
  const farmer = db.farmers.find((f) => f.id === db.meta.demoFarmerId);
  const lang = (db.meta.language as Lang) || "en";
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    getSession()
      .then((s) => setAccountEmail(s?.user?.email ?? null))
      .catch(() => setAccountEmail(null));
  }, []);

  const myLogs = useMemo(
    () => db.logs.filter((l) => farmer && l.farmerId === farmer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.logs, farmer]
  );
  const since90 = isoDaysAgo(90);
  const recentMine = useMemo(() => myLogs.filter((l) => l.harvestDate >= since90), [myLogs, since90]);
  const totalKg = recentMine.reduce((s, l) => s + l.quantityKg, 0);
  const perAcre = farmer && farmer.acreage > 0 ? totalKg / farmer.acreage : 0;

  const name = farmer?.fullName ?? accountEmail?.split("@")[0] ?? "Farmer";

  return (
    <div className="space-y-4">
      {/* greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-forest-900">Karibu, {name} 🌱</h2>
          <p className="mt-1 text-sm text-stone-500">Your farm at a glance · {fmtDate(new Date().toISOString().slice(0, 10))}</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
          <Link href="/farm">
            <Button variant="outline" className="w-full">
              <Home className="h-4 w-4" /> My Farm
            </Button>
          </Link>
          <Link href="/logs" className="col-span-2 sm:col-span-1">
            <Button variant="accent" className="w-full">
              <ClipboardPlus className="h-4 w-4" /> Log my harvest
            </Button>
          </Link>
        </div>
      </div>

      {/* unlinked: calm account view (no admin gate, no admin language) */}
      {!farmer && (
        <Card className="border-ochre-200 bg-ochre-50/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ochre-500 text-white">
                <UserRound className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold text-forest-900">
                  {accountEmail ?? name}
                </p>
                <p className="text-[13px] text-stone-600">
                  Your Roki account is ready. Once Roki registers your farm, your profile, harvests and tier will
                  appear right here, and you'll be able to log harvests from your phone.
                </p>
              </div>
            </div>
            <Link href="/survey">
              <Button variant="accent">
                <ClipboardPlus className="h-4 w-4" /> Complete my farmer survey
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* linked: profile summary */}
      {farmer && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-forest-800 text-lg font-bold text-white">
              {farmer.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0 flex-1 basis-52">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-xl font-semibold text-forest-900">{farmer.fullName}</p>
                <RokiTierBadge tier={farmer.rokiTier} />
                <TierBadge tier={farmer.scaleTier} />
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-stone-500">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-ochre-500" />
                <span className="truncate">
                  {farmer.village ? `${farmer.village}, ` : ""}{farmer.subCounty}, {farmer.district}
                </span>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* my stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label={t(lang, "myHarvests90")} value={recentMine.length.toLocaleString()} sub={t(lang, "thisSeason")} icon={<Sprout className="h-5 w-5" />} />
        <Stat label={t(lang, "myProduce")} value={fmtKg(totalKg)} sub={t(lang, "last90")} icon={<Wheat className="h-5 w-5" />} />
        <Stat label={t(lang, "avgPerAcre")} value={`${fmtNumber(perAcre)} kg`} sub={farmer ? `${fmtNumber(farmer.acreage)} acres` : "—"} icon={<Wheat className="h-5 w-5" />} tone="ochre" />
        <Stat label={t(lang, "harvestLogs")} value={myLogs.length.toLocaleString()} sub={t(lang, "allTime")} icon={<ClipboardPlus className="h-5 w-5" />} />
      </div>

      {/* my recent harvests */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-forest-900">My recent harvests</h3>
          <Link href="/logs" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ochre-600 hover:text-ochre-700">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {myLogs.length === 0 ? (
          <EmptyState
            icon={<PackagePlus className="h-6 w-6" />}
            title={t(lang, "noHarvests")}
            description={t(lang, "noHarvestsDesc")}
            action={
              <Link href="/logs">
                <Button variant="accent">Log a harvest</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2.5">
            {myLogs.slice(0, 6).map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-3.5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
                  <Wheat className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-stone-800">{l.cropType}</p>
                  <p className="mt-0.5 truncate text-[12px] text-stone-500">
                    <span className="font-semibold text-forest-800 tabular">{fmtKg(l.quantityKg)}</span> · harvested {fmtDate(l.harvestDate)} · {relTime(l.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={l.status} />
                  <GradeBadge grade={l.qualityGrade} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* farming tips (blog) */}
      <Card>
        <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
          <Leaf className="h-5 w-5 text-ochre-500" /> Farming tips
        </h3>
        <p className="mb-3 text-[12px] text-stone-400">Fresh tips from the Roki agronomy team</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {TIPS.map((t) => (
            <div key={t.title} className="rounded-2xl border border-stone-200 bg-stone-50/50 p-3.5">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-forest-800">
                <Sprout className="h-4 w-4 shrink-0 text-ochre-500" /> {t.title}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-stone-600">{t.body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const TIPS = [
  { title: "Water smart", body: "Water tomato and vegetable beds early in the morning or late evening to cut evaporation and save water." },
  { title: "Rotate your beds", body: "Swap onion and cabbage beds between seasons to break pest and disease cycles in the soil." },
  { title: "Dry crops off the ground", body: "Dry maize and beans on a raised mat, never the bare ground, to avoid rot and aflatoxin." },
  { title: "Grade before you deliver", body: "Separating Grade A from Grade B at harvest earns better prices at the aggregation hub." },
  { title: "Keep honest records", body: "Accurate harvest dates and quantities power Roki's forecast, and your tier, and your payouts." },
  { title: "Ask for support", body: "Facing a pest or a strange leaf? Tell your field agent, they can arrange agronomy advice through Roki." },
];

// =====================================================================
// STAFF DASHBOARD — admin / field agent operations overview
// =====================================================================
function StaffDashboard() {
  const db = useDb();
  const isAgent = db.meta.role === "FIELD_AGENT";
  const [refreshing, setRefreshing] = useState(false);

  function doRefresh() {
    setRefreshing(true);
    import("@/lib/db")
      .then((m) => m.refreshNow())
      .finally(() => setRefreshing(false));
  }

  const scopedLogs = db.logs;
  const since90 = isoDaysAgo(90);
  const recentLogs = useMemo(() => scopedLogs.filter((l) => l.harvestDate >= since90), [scopedLogs, since90]);
  const totalKg = useMemo(() => recentLogs.reduce((s, l) => s + l.quantityKg, 0), [recentLogs]);
  const needsAudit = useMemo(() => scopedLogs.filter((l) => l.status === "NEEDS_AUDIT").length, [scopedLogs]);
  const flagged = useMemo(() => scopedLogs.filter((l) => l.status === "FLAGGED").length, [scopedLogs]);

  const nameOf = useMemo(() => {
    const map = new Map(db.farmers.map((f) => [f.id, f.fullName]));
    return (id: string) => map.get(id) ?? "Unknown";
  }, [db.farmers]);

  const farmerStats = useMemo(() => {
    const refugee = db.farmers.filter((f) => f.refugeeStatus === "REFUGEE").length;
    const host = db.farmers.filter((f) => f.refugeeStatus === "HOST").length;
    const women = db.farmers.filter((f) => f.gender === "F").length;
    const men = db.farmers.filter((f) => f.gender === "M").length;
    const tier1 = db.farmers.filter((f) => f.rokiTier === 1).length;
    const tier2 = db.farmers.filter((f) => f.rokiTier === 2).length;
    const tier3 = db.farmers.filter((f) => f.rokiTier === 3).length;
    const districts = new Map<string, number>();
    for (const f of db.farmers) districts.set(f.district, (districts.get(f.district) ?? 0) + 1);
    const locationMap = [...districts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { refugee, host, women, men, tier1, tier2, tier3, locationMap, total: db.farmers.length };
  }, [db.farmers]);

  const alerts = useMemo(() => {
    type A = { type: LogStatus | "PROFILE"; title: string; detail: string; link: string; time: string };
    const out: A[] = [];
    for (const log of scopedLogs) {
      if (log.status !== "VERIFIED") {
        out.push({
          type: log.status,
          title: `${nameOf(log.farmerId)} · ${log.cropType}`,
          detail: log.auditNotes[0] ?? "",
          link: `/logs?focus=${log.id}`,
          time: log.createdAt,
        });
      }
    }
    for (const f of db.farmers) {
      if (f.flags.includes("INCOMPLETE_PROFILE")) {
        out.push({
          type: "PROFILE",
          title: f.fullName,
          detail: "Incomplete profile, critical contact details missing",
          link: `/farmers/${f.id}`,
          time: f.updatedAt,
        });
      }
    }
    return out.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6);
  }, [scopedLogs, db.farmers, nameOf]);

  const recentLogsSorted = useMemo(
    () => [...recentLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
    [recentLogs]
  );
  const maxDistricts = farmerStats.locationMap[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="space-y-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-forest-900">Roki Farmer Dashboard</h2>
          <p className="mt-1 text-sm text-stone-500">
            Registered farmers, demographics and production outlook · {fmtDate(new Date().toISOString().slice(0, 10))}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
          <Link href="/farmers/new">
            <Button variant="primary" className="w-full">
              <Users className="h-4 w-4" /> New Survey
            </Button>
          </Link>
          <Link href="/forecast">
            <Button variant="outline" className="w-full">
              <CalendarRange className="h-4 w-4" /> Forecast
            </Button>
          </Link>
          <Link href="/supply">
            <Button variant="outline" className="w-full">
              <Truck className="h-4 w-4" /> Supply
            </Button>
          </Link>
          {!isAgent && (
            <button onClick={() => void downloadSummaryPdf(db)}>
              <Button variant="outline" className="w-full">
                <FileText className="h-4 w-4" /> Report (PDF)
              </Button>
            </button>
          )}
          <button onClick={doRefresh} disabled={refreshing} className="col-span-2 sm:col-span-1">
            <Button variant="outline" className="w-full" disabled={refreshing}>
              <RefreshCw className={cx("h-4 w-4", refreshing && "animate-spin")} /> {refreshing ? "Refreshing…" : "Refresh data"}
            </Button>
          </button>
          <Link href="/logs" className="col-span-2 sm:col-span-1">
            <Button variant="accent" className="w-full">
              <ClipboardPlus className="h-4 w-4" /> Log Harvest
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Registered farmers" value={farmerStats.total.toLocaleString()} sub="surveyed & active" icon={<Users className="h-5 w-5" />} />
        <Stat label="Refugee vs host" value={`${farmerStats.refugee} / ${farmerStats.host}`} sub="refugee / host-community" icon={<Shield className="h-5 w-5" />} tone="ochre" />
        <Stat label="Women farmers" value={`${farmerStats.women} (${farmerStats.total ? Math.round((farmerStats.women / farmerStats.total) * 100) : 0}%)`} sub={`${farmerStats.men} men`} icon={<UserRound className="h-5 w-5" />} />
        <Stat label="Export-ready (Tier 1)" value={farmerStats.tier1} sub={`${farmerStats.tier2} developing · ${farmerStats.tier3} new`} icon={<Truck className="h-5 w-5" />} tone="success" />
      </div>

      {/* gender + location mapping */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="min-w-0">
          <h3 className="mb-4 font-display text-lg font-semibold text-forest-900">Gender distribution</h3>
          <div className="mb-4 flex h-3.5 w-full overflow-hidden rounded-full bg-stone-100">
            <div className="h-full bg-forest-600" style={{ width: `${farmerStats.total ? (farmerStats.women / farmerStats.total) * 100 : 0}%` }} />
            <div className="h-full bg-ochre-500" style={{ width: `${farmerStats.total ? (farmerStats.men / farmerStats.total) * 100 : 0}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-forest-50 px-3.5 py-3">
              <p className="text-[11px] font-bold tracking-wide text-forest-700 uppercase">Women</p>
              <p className="font-display text-xl font-semibold text-forest-900 tabular">{farmerStats.women}</p>
            </div>
            <div className="rounded-xl bg-ochre-50 px-3.5 py-3">
              <p className="text-[11px] font-bold tracking-wide text-ochre-700 uppercase">Men</p>
              <p className="font-display text-xl font-semibold text-ochre-800 tabular">{farmerStats.men}</p>
            </div>
          </div>
        </Card>

        <Card className="min-w-0">
          <h3 className="mb-4 font-display text-lg font-semibold text-forest-900">Location mapping</h3>
          {farmerStats.locationMap.length === 0 ? (
            <p className="text-sm text-stone-400">No location data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {farmerStats.locationMap.map(([district, count]) => (
                <div key={district} className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0 text-ochre-500" />
                  <span className="w-36 truncate text-[13px] font-medium text-stone-600 sm:w-44">{district}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-forest-600" style={{ width: `${(count / maxDistricts) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-[13px] font-bold text-forest-800 tabular">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* tier distribution */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-forest-900">Farmer scoring system</h3>
          <Link href="/farmers" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ochre-600 hover:text-ochre-700">
            All farmers <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { tier: 1 as const, count: farmerStats.tier1, desc: "Export-ready, consistent Grade-A volume", cls: "border-forest-700 bg-forest-800 text-white" },
            { tier: 2 as const, count: farmerStats.tier2, desc: "Developing commercial farmers", cls: "border-ochre-500 bg-ochre-50" },
            { tier: 3 as const, count: farmerStats.tier3, desc: "New farmers requiring support", cls: "border-stone-200 bg-stone-50" },
          ].map((t) => (
            <div key={t.tier} className={cx("rounded-2xl border p-4", t.cls)}>
              <div className="flex items-center justify-between">
                <RokiTierBadge tier={t.tier} />
                <span className="font-display text-2xl font-bold tabular">{t.count}</span>
              </div>
              <p className={cx("mt-2 text-[12px] leading-snug", t.tier === 1 ? "text-white/80" : "text-stone-500")}>{t.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* rule findings */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-forest-900">Rule engine findings</h3>
          <Link href="/logs" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ochre-600 hover:text-ochre-700">
            All logs <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {alerts.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="No findings, all clear"
            description="The rule engine checks every entry for yield anomalies, duplicates and incomplete profiles."
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {alerts.map((a, i) => (
              <li key={i}>
                <Link href={a.link} className="flex items-center gap-3 rounded-xl px-1.5 py-2.5 active:bg-stone-50">
                  <span className="shrink-0">
                    {a.type === "NEEDS_AUDIT" && <StatusBadge status="NEEDS_AUDIT" />}
                    {a.type === "FLAGGED" && <StatusBadge status="FLAGGED" />}
                    {a.type === "PROFILE" && (
                      <span className="inline-flex rounded-full bg-warning-bg px-2.5 py-1 text-[11px] font-semibold text-warning-dark ring-1 ring-inset ring-warning/30">
                        Profile
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-800">{a.title}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-stone-500">{a.detail}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-stone-400">{relTime(a.time)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* recent harvests */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-forest-900">Recent harvests</h3>
          <Link href="/logs" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ochre-600 hover:text-ochre-700">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {recentLogsSorted.length === 0 ? (
          <EmptyState
            icon={<PackagePlus className="h-6 w-6" />}
            title="No harvest logs yet"
            description="Log the first harvest to get started."
            action={
              <Link href="/logs">
                <Button variant="accent">Log a harvest</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                    <th className="py-2.5 pr-4">Farmer</th>
                    <th className="py-2.5 pr-4">Crop</th>
                    <th className="py-2.5 pr-4 text-right">Qty</th>
                    <th className="py-2.5 pr-4">Harvested</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Source</th>
                    <th className="py-2.5">Logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {recentLogsSorted.map((l) => (
                    <tr key={l.id} className="hover:bg-stone-50/60">
                      <td className="py-3 pr-4">
                        <Link href={`/farmers/${l.farmerId}`} className="font-semibold text-forest-800 hover:underline">
                          {nameOf(l.farmerId)}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-stone-600">{l.cropType}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-stone-800 tabular">{fmtKg(l.quantityKg)}</td>
                      <td className="py-3 pr-4 text-stone-500">{fmtDate(l.harvestDate)}</td>
                      <td className="py-3 pr-4"><StatusBadge status={l.status} /></td>
                      <td className="py-3 pr-4"><SourceChip source={l.source} /></td>
                      <td className="py-3 text-stone-400">{fmtDateTime(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2.5 md:hidden">
              {recentLogsSorted.map((l) => (
                <Link
                  key={l.id}
                  href={`/farmers/${l.farmerId}`}
                  className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-card transition-colors active:bg-stone-50"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
                    <Wheat className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-stone-800">{nameOf(l.farmerId)}</p>
                    <p className="mt-0.5 truncate text-[12px] text-stone-500">
                      {l.cropType} · <span className="font-semibold text-forest-800 tabular">{fmtKg(l.quantityKg)}</span> · {fmtDate(l.harvestDate)}
                    </p>
                  </div>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
