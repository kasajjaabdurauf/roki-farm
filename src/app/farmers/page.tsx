"use client";

import Link from "next/link";
import { Download, PhoneCall, Search, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { refreshNow, useDb } from "@/lib/db";
import { downloadCSV, stamp, type ExportColumn } from "@/lib/export";
import { fmtNumber } from "@/lib/rules";
import { REFUGEE_LABEL, type RokiTier, type ScaleTier } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Input, Select } from "@/components/ui";
import { RokiTierBadge, TierBadge } from "@/components/badges";

export default function FarmersPage() {
  const db = useDb();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<"ALL" | RokiTier>("ALL");
  const [crop, setCrop] = useState("ALL");
  const [district, setDistrict] = useState("ALL");
  const [attention, setAttention] = useState(false);

  // keep the list live so new registrations appear without a reload
  useEffect(() => {
    const t = setInterval(() => {
      void refreshNow();
    }, 20000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return db.farmers
      .filter((f) => {
        if (tier !== "ALL" && f.rokiTier !== tier) return false;
        if (attention && f.flags.length === 0) return false;
        // crop filter: profile crop OR a harvest log with that crop
        if (crop !== "ALL") {
          const grows = f.primaryCrops.includes(crop) ||
            db.logs.some((l) => l.farmerId === f.id && l.cropType === crop);
          if (!grows) return false;
        }
        // place filter: district / sub-county / village
        if (district !== "ALL") {
          if (f.district !== district && f.subCounty !== district && f.village !== district) return false;
        }
        if (!query) return true;
        const hay = `${f.id} ${f.fullName} ${f.email ?? ""} ${f.phone} ${f.district} ${f.subCounty} ${f.village ?? ""} ${REFUGEE_LABEL[f.refugeeStatus]}`.toLowerCase();
        return hay.includes(query);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // newest first
  }, [db.farmers, db.logs, q, tier, crop, district, attention]);

  function downloadFiltered() {
    const cols: ExportColumn[] = [
      { key: "id", label: "Farmer ID" },
      { key: "fullName", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone (+256)" },
      { key: "district", label: "District" },
      { key: "subCounty", label: "Sub-County" },
      { key: "village", label: "Village" },
      { key: "primaryCrops", label: "Crops", value: (r) => r.primaryCrops.join("; ") },
      { key: "rokiTier", label: "Roki Tier", value: (r) => `Tier ${r.rokiTier}` },
      { key: "acreage", label: "Acreage (acres)" },
      { key: "refugeeStatus", label: "Community", value: (r) => (r.refugeeStatus === "REFUGEE" ? "Refugee" : r.refugeeStatus === "HOST" ? "Host community" : "") },
      { key: "createdAt", label: "Registered", value: (r) => r.createdAt?.slice(0, 10) },
    ];
    const cropTag = crop === "ALL" ? "all-crops" : crop.toLowerCase().replace(/\s+/g, "-");
    const placeTag = district === "ALL" ? "all-places" : district.toLowerCase().replace(/\s+/g, "-");
    downloadCSV(filtered, cols, `roki-farmers-${cropTag}-${placeTag}-${stamp("list")}.csv`);
  }

  // distinct crops (from profiles + logs) and districts for the filters
  const cropOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of db.farmers) for (const c of f.primaryCrops) set.add(c);
    for (const l of db.logs) set.add(l.cropType);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [db.farmers, db.logs]);
  const districtOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of db.farmers) if (f.district) set.add(f.district);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [db.farmers]);

  const logCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of db.logs) map.set(l.farmerId, (map.get(l.farmerId) ?? 0) + 1);
    return map;
  }, [db.logs]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-forest-900">Farmer Profiles</h2>
          <p className="mt-0.5 text-sm text-stone-500">
            {db.farmers.length.toLocaleString()} registered · full survey records · instant search
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={downloadFiltered} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Download list ({filtered.length})
          </Button>
          <Link href="/farmers/new">
            <Button size="lg">
              <UserPlus className="h-4 w-4" /> New Survey
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px_150px_auto]">
        <div className="relative">
          <Search className="absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, district, village, RFV-UG-…"
            className="pl-10"
          />
        </div>
        <Select value={crop} onChange={(e) => setCrop(e.target.value)}>
          <option value="ALL">All crops</option>
          {cropOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="ALL">All places</option>
          {districtOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
        <Select value={String(tier)} onChange={(e) => setTier(e.target.value === "ALL" ? "ALL" : (Number(e.target.value) as RokiTier))}>
          <option value="ALL">All Roki tiers</option>
          <option value="1">Tier 1 · Export-ready</option>
          <option value="2">Tier 2 · Developing</option>
          <option value="3">Tier 3 · New</option>
        </Select>
        <button
          onClick={() => setAttention((v) => !v)}
          className={
            "h-12 rounded-xl border px-3 text-[13px] font-semibold transition-colors " +
            (attention
              ? "border-warning-500 bg-warning-bg text-warning-dark"
              : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50")
          }
        >
          ⚠ Needs attention
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No farmers match"
          description="Try a different search, or register a new farmer with the survey."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => (
            <Link key={f.id} href={`/farmers/${f.id}`} className="card group p-5 transition-shadow hover:shadow-pop">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest-800 text-[13px] font-bold text-white">
                    {f.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-stone-800 group-hover:text-forest-800">
                      {f.fullName || f.email || f.id}
                    </p>
                    <p className="truncate text-[12px] font-medium text-stone-400 tabular">
                      {f.id}{f.email && f.email !== f.fullName ? ` · ${f.email}` : ""}
                    </p>
                    {f.loggedBy && <p className="text-[11px] text-stone-400">registered by {f.loggedBy}</p>}
                  </div>
                </div>
                <RokiTierBadge tier={f.rokiTier} />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={f.gender === "F" ? "ochre" : "neutral"}>{f.gender === "F" ? "♀ Woman" : f.gender === "M" ? "♂ Man" : "Other"}</Badge>
                {f.refugeeStatus !== "NONE" && (
                  <Badge tone={f.refugeeStatus === "REFUGEE" ? "danger" : "forest"}>{REFUGEE_LABEL[f.refugeeStatus]}</Badge>
                )}
                <TierBadge tier={f.scaleTier} />
              </div>

              <div className="mt-3 space-y-1.5 text-[13px] text-stone-600">
                <p className="flex items-center gap-2">
                  <PhoneCall className="h-3.5 w-3.5 text-stone-400" />
                  {f.phone ? (
                    <span className="tabular">{f.phone}</span>
                  ) : (
                    <span className="font-semibold text-danger-600">No phone on file</span>
                  )}
                </p>
                <p className="truncate">
                  📍 {f.subCounty}, {f.district}
                </p>
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-forest-800 tabular">{fmtNumber(f.acreage)} ac</span>
                  {f.primaryCrops.slice(0, 3).map((c) => (
                    <Badge key={c} tone="forest">{c}</Badge>
                  ))}
                  {f.primaryCrops.length > 3 && <Badge tone="neutral">+{f.primaryCrops.length - 3}</Badge>}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                <span className="text-[12px] text-stone-400">
                  {logCount.get(f.id) ?? 0} harvest log{(logCount.get(f.id) ?? 0) === 1 ? "" : "s"} · {f.plannedProductions.length} plan{f.plannedProductions.length === 1 ? "" : "s"}
                </span>
                {isNew(f) && <Badge tone="success" dot>New</Badge>}
                {f.flags.length > 0 && !f.fullName && (
                  <Badge tone="warning" dot>Pending survey</Badge>
                )}
                {f.flags.length > 0 && f.fullName && (
                  <Badge tone="warning" dot>Incomplete profile</Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function isNew(f: { createdAt: string }): boolean {
  try {
    return Date.now() - new Date(f.createdAt).getTime() < 7 * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}
