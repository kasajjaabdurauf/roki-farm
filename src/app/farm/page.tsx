"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClipboardPlus, Droplets, LandPlot, MapPin, PhoneCall, Sprout, Wheat } from "lucide-react";
import { useDb } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { fmtKg, fmtNumber } from "@/lib/rules";
import { IRRIGATION_OPTIONS } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Stat } from "@/components/ui";
import { GradeBadge, RokiTierBadge, StatusBadge, TierBadge, YieldBadge } from "@/components/badges";

export default function FarmPage() {
  const db = useDb();
  const farmer = db.farmers.find((f) => f.id === db.meta.demoFarmerId);

  const logs = useMemo(
    () =>
      db.logs
        .filter((l) => l.farmerId === farmer?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.logs, farmer?.id]
  );

  if (!farmer) {
    return (
      <EmptyState
        icon={<Sprout className="h-6 w-6" />}
        title="No demo farmer selected"
        description="An admin needs to switch this device to a farmer profile first."
      />
    );
  }

  const totalKg = logs.reduce((s, l) => s + l.quantityKg, 0);
  const perAcre = farmer.acreage > 0 ? totalKg / farmer.acreage : 0;
  const irrigationLabel = IRRIGATION_OPTIONS.find((o) => o.value === farmer.irrigationType)?.label ?? "Rain-fed";

  return (
    <div className="space-y-6">
      {/* profile card */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-forest-800 text-xl font-bold text-white">
            {farmer.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-semibold text-forest-900">{farmer.fullName}</h2>
              <RokiTierBadge tier={farmer.rokiTier} />
              <TierBadge tier={farmer.scaleTier} />
            </div>
            <p className="mt-1 text-sm font-medium text-stone-400 tabular">{farmer.id} · registered {fmtDate(farmer.createdAt.slice(0, 10))}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-600">
              <MapPin className="h-4 w-4 text-ochre-500" />
              {farmer.village ? `${farmer.village}, ` : ""}{farmer.subCounty}, {farmer.district}
            </p>
          </div>
          <Link href="/logs">
            <Button variant="accent" size="lg"><ClipboardPlus className="h-4 w-4" /> Log today&apos;s harvest</Button>
          </Link>
        </div>
        <div className="mt-5 grid gap-3 border-t border-stone-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={<PhoneCall className="h-4 w-4" />} label="Phone" value={farmer.phone || "N/A"} />
          <Fact icon={<LandPlot className="h-4 w-4" />} label="Acreage" value={`${fmtNumber(farmer.acreage)} acres`} />
          <Fact icon={<Droplets className="h-4 w-4" />} label="Irrigation" value={irrigationLabel} />
          <Fact
            icon={<Sprout className="h-4 w-4" />}
            label="Crops"
            value={
              <span className="flex flex-wrap gap-1">
                {farmer.primaryCrops.map((c) => <Badge key={c} tone="forest">{c}</Badge>)}
              </span>
            }
          />
        </div>
      </Card>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Total harvested" value={fmtKg(totalKg)} icon={<Wheat className="h-5 w-5" />} />
        <Stat label="Harvest logs" value={logs.length.toLocaleString()} icon={<Sprout className="h-5 w-5" />} />
        <Stat label="Average per acre" value={`${fmtNumber(perAcre)} kg`} icon={<LandPlot className="h-5 w-5" />} />
        <Stat label="Payout-ready entries" value={logs.filter((l) => l.qualityGrade !== "REJECT").length.toLocaleString()} icon={<Wheat className="h-5 w-5" />} tone="ochre" />
      </div>

      {/* history */}
      <Card>
        <h3 className="mb-3 font-display text-lg font-semibold text-forest-900">My harvests</h3>
        {logs.length === 0 ? (
          <EmptyState
            icon={<Sprout className="h-6 w-6" />}
            title="No harvests yet"
            description="Log your first harvest, it takes under a minute and works offline."
            action={
              <Link href="/logs">
                <Button variant="accent">Log a harvest</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {logs.map((l) => (
              <div key={l.id} className="rounded-xl border border-stone-200/80 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-stone-800">{l.cropType}</p>
                    <p className="font-mono text-[11px] text-stone-400">{l.id}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-stone-600">
                  <span className="font-bold text-forest-800 tabular">{fmtKg(l.quantityKg)}</span>
                  <GradeBadge grade={l.qualityGrade} />
                  <YieldBadge score={l.yieldScore} />
                </div>
                <p className="mt-2 text-[12px] text-stone-400">Harvested {fmtDate(l.harvestDate)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-stone-500">{icon}</span>
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">{label}</p>
        <div className="text-sm font-semibold text-stone-800">{value}</div>
      </div>
    </div>
  );
}
