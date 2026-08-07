"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ClipboardPlus,
  Droplets,
  LandPlot,
  MapPin,
  Pencil,
  PhoneCall,
  Sprout,
  Trash2,
  Users,
  Wheat,
  FileText,
  X,
} from "lucide-react";
import { deleteFarmers, updateFarmer, useDb } from "@/lib/db";
import { downloadFarmerSurveyPdf } from "@/lib/report";
import { fmtDate, fmtDateTime, relTime } from "@/lib/format";
import { fmtKg, fmtNumber, rokiTierCriteria } from "@/lib/rules";
import { IRRIGATION_OPTIONS, LAND_OWNERSHIP_LABEL, REFUGEE_LABEL, ROKI_TIER_LABEL, GENDER_LABEL, type Farmer } from "@/lib/types";
import { MONTHS } from "@/lib/reference";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Modal, Stat } from "@/components/ui";
import { GradeBadge, RokiTierBadge, StatusBadge, TierBadge, YieldBadge } from "@/components/badges";
import { FarmerForm } from "@/components/farmers/FarmerForm";

export default function FarmerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useDb();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // --- inline "Registered by (agent)" editor (admin only) ------------
  const [agentEdit, setAgentEdit] = useState(false);
  const [agentDraft, setAgentDraft] = useState("");

  const [stashed, setStashed] = useState<Farmer | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("roki-just-created");
      if (raw) {
        const f = JSON.parse(raw) as Farmer;
        if (f.id === id) setStashed(f);
        sessionStorage.removeItem("roki-just-created");
      }
    } catch { /* ignore */ }
  }, [id]);
  const farmer = db.farmers.find((f) => f.id === id) ?? stashed;
  const logs = useMemo(
    () =>
      db.logs
        .filter((l) => l.farmerId === farmer?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.logs, farmer?.id]
  );

  const totalKg = logs.reduce((s, l) => s + l.quantityKg, 0);
  const byCrop = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of logs) m[l.cropType] = (m[l.cropType] ?? 0) + l.quantityKg;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [logs]);
  const topCrop = byCrop[0]?.[0] ?? "N/A";
  const perAcre = (farmer?.acreage ?? 0) > 0 ? totalKg / (farmer?.acreage ?? 1) : 0;
  const irrigationLabel = farmer ? (IRRIGATION_OPTIONS.find((o) => o.value === farmer.irrigationType)?.label ?? farmer.irrigationType) : "N/A";

  const flaggedLogs = logs.filter((l) => l.status !== "VERIFIED");

  if (!farmer) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="Farmer not found"
        description={`No profile matches ${id}. It may have been deleted, or the link is wrong.`}
        action={
          <Link href="/farmers">
            <Button variant="primary">Browse farmers</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/farmers" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-stone-500 hover:text-forest-800">
        <ArrowLeft className="h-4 w-4" /> All farmers
      </Link>

      {/* header card */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-forest-800 text-xl font-bold text-white">
              {farmer.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-semibold text-forest-900">{farmer.fullName}</h2>
                <RokiTierBadge tier={farmer.rokiTier} />
                <TierBadge tier={farmer.scaleTier} />
                {farmer.flags.map((fl) => (
                  <Badge key={fl} tone="warning" dot>{fl === "INCOMPLETE_PROFILE" ? "Incomplete profile" : fl}</Badge>
                ))}
              </div>
              <p className="mt-1 text-sm font-medium text-stone-400 tabular">{farmer.id} · registered {fmtDate(farmer.createdAt.slice(0, 10))}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-600">
                <MapPin className="h-4 w-4 text-ochre-500" />
                {farmer.village ? `${farmer.village}, ` : ""}{farmer.subCounty}, {farmer.district}
              </p>
              <RegisteredByEditor farmer={farmer} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/logs?farmer=${farmer.id}`}>
              <Button variant="accent"><ClipboardPlus className="h-4 w-4" /> Log Harvest</Button>
            </Link>
            <Button variant="outline" onClick={() => void downloadFarmerSurveyPdf(farmer)}>
              <FileText className="h-4 w-4" /> Survey PDF
            </Button>
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="ghost" className="text-danger-600 hover:bg-danger-50" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* facts */}
        <div className="mt-5 grid gap-3 border-t border-stone-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-stone-500"><PhoneCall className="h-4.5 w-4.5" /></span>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">Phone</p>
              <p className="text-sm font-semibold text-stone-800 tabular">{farmer.phone || <span className="text-danger-600">Missing</span>}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-stone-500"><LandPlot className="h-4.5 w-4.5" /></span>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">Acreage</p>
              <p className="text-sm font-semibold text-stone-800 tabular">{fmtNumber(farmer.acreage)} acres</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-stone-500"><Droplets className="h-4.5 w-4.5" /></span>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">Irrigation</p>
              <p className="text-sm font-semibold text-stone-800">{irrigationLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-stone-500"><Sprout className="h-4.5 w-4.5" /></span>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">Crops</p>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {farmer.primaryCrops.map((c) => <Badge key={c} tone="forest">{c}</Badge>)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Total harvested" value={fmtKg(totalKg)} icon={<Wheat className="h-5 w-5" />} />
        <Stat label="Harvest logs" value={logs.length.toLocaleString()} icon={<Sprout className="h-5 w-5" />} />
        <Stat label="Avg per acre" value={`${fmtNumber(perAcre)} kg`} icon={<LandPlot className="h-5 w-5" />} />
        <Stat label="Top crop" value={topCrop} icon={<Wheat className="h-5 w-5" />} tone="ochre" />
      </div>

      {/* survey record */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <h3 className="mb-3 font-display text-lg font-semibold text-forest-900">Survey record</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <SurveyFact label="Gender" value={GENDER_LABEL[farmer.gender]} />
            <SurveyFact label="Community" value={REFUGEE_LABEL[farmer.refugeeStatus]} />
            <SurveyFact label="Age" value={farmer.survey?.ageYears ? `${farmer.survey.ageYears} years` : farmer.ageGroup} />
            <SurveyFact label="Household" value={farmer.householdSize ? `${farmer.householdSize} members` : "N/A"} />
            <SurveyFact label="Land ownership" value={LAND_OWNERSHIP_LABEL[farmer.landOwnership]} />
            <SurveyFact label="Irrigation" value={irrigationLabel} />
            <SurveyFact label="Enumerator" value={farmer.loggedBy || farmer.survey?.enumeratorName || "N/A"} />
            <SurveyFact label="Registered" value={fmtDate(farmer.createdAt.slice(0, 10))} />
            {farmer.survey?.preferredLanguage && (
              <SurveyFact label="Language" value={farmer.survey.preferredLanguage} />
            )}
            {farmer.survey?.hasSmartphone !== undefined && (
              <SurveyFact label="Smartphone" value={farmer.survey.hasSmartphone ? "Yes" : "No"} />
            )}
            {farmer.survey?.gpsLat !== undefined && (
              <SurveyFact
                label="GPS"
                value={`${farmer.survey.gpsLat.toFixed(4)}, ${farmer.survey.gpsLon?.toFixed(4) ?? "—"}`}
              />
            )}
          </dl>
          <div className="mt-4 rounded-xl bg-forest-50 px-3.5 py-3">
            <p className="text-[11px] font-bold tracking-wide text-forest-700 uppercase">
              Roki scoring · {ROKI_TIER_LABEL[farmer.rokiTier]}
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-forest-800">{rokiTierCriteria(farmer.rokiTier)}</p>
          </div>
          {farmer.survey && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
              <SurveyFact label="Experience" value={farmer.survey.farmingYears.replace("_", "-").replace("Y", "yrs ")} />
              <SurveyFact label="Assessment" value={`${farmer.survey.landAvailability} land · ${farmer.survey.productionPotential} potential`} />
              <SurveyFact label="Recommended" value={farmer.survey.recommendedCategory.toLowerCase()} />
              <SurveyFact label="Supplies Roki" value={farmer.survey.wantsToSupplyRoki ? "Yes" : "No"} />
            </div>
          )}
        </Card>

        <Card className="min-w-0">
          <h3 className="mb-3 font-display text-lg font-semibold text-forest-900">Production plan</h3>
          {farmer.plannedProductions.length === 0 ? (
            <p className="text-sm text-stone-400">No production plan captured yet, edit the survey to add one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-stone-200 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                    <th className="py-2 pr-3">Crop</th>
                    <th className="py-2 pr-3 text-right">Acres</th>
                    <th className="py-2 pr-3 text-right">Expected</th>
                    <th className="py-2">Harvest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {farmer.plannedProductions.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-3 font-semibold text-stone-800">{p.crop}</td>
                      <td className="py-2 pr-3 text-right text-stone-600 tabular">{p.acres.toFixed(1)}</td>
                      <td className="py-2 pr-3 text-right font-bold text-forest-800 tabular">{(p.expectedVolumeKg / 1000).toFixed(1)} t</td>
                      <td className="py-2 text-stone-500">
                        {MONTHS[p.harvestStartMonth - 1]}–{MONTHS[p.harvestEndMonth - 1]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* planting history (from uploads like the Farmers List) */}
      {farmer.plantingHistory && farmer.plantingHistory.length > 0 && (
        <Card>
          <h3 className="mb-3 font-display text-lg font-semibold text-forest-900">Planting history</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-stone-200 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                  <th className="py-2 pr-3">Crop</th>
                  <th className="py-2 pr-3 text-right">Acres</th>
                  <th className="py-2 pr-3">Planted</th>
                  <th className="py-2 pr-3">Source of seed</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {farmer.plantingHistory.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 font-semibold text-stone-800">{p.crop}</td>
                    <td className="py-2 pr-3 text-right text-stone-600 tabular">{p.acres.toFixed(1)}</td>
                    <td className="py-2 pr-3 text-stone-500">{p.plantingDate ? fmtDate(p.plantingDate) : "—"}</td>
                    <td className="py-2 pr-3 text-stone-600">{p.sourceOfSeed || "—"}</td>
                    <td className="py-2">
                      <Badge tone={p.status?.includes("SUPPLYING") ? "success" : "forest"}>{p.status || "—"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* rule findings for this farmer */}
      {flaggedLogs.length > 0 && (
        <Card className="border-warning-200 bg-warning-bg/40">
          <h3 className="mb-2 font-display text-lg font-semibold text-warning-dark">⚠ Rule engine findings ({flaggedLogs.length})</h3>
          <ul className="space-y-2">
            {flaggedLogs.slice(0, 5).map((l) => (
              <li key={l.id} className="text-[13px] text-stone-700">
                <span className="font-semibold">{l.id}</span> · {l.cropType} · {fmtKg(l.quantityKg)}, {l.auditNotes[0]}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* harvest history */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-forest-900">Harvest history</h3>
          <span className="text-[13px] text-stone-400">{logs.length} entries</span>
        </div>
        {logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">No harvests logged yet.</p>
        ) : (
          <>
            {/* desktop / tablet, table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                    <th className="py-2.5 pr-4">Log ID</th>
                    <th className="py-2.5 pr-4">Crop</th>
                    <th className="py-2.5 pr-4 text-right">Qty</th>
                    <th className="py-2.5 pr-4">Grade</th>
                    <th className="py-2.5 pr-4">Harvested</th>
                    <th className="py-2.5 pr-4">Yield</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5">Logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-stone-50/60">
                      <td className="py-3 pr-4 font-mono text-[12px] text-stone-400">{l.id}</td>
                      <td className="py-3 pr-4 font-semibold text-stone-800">{l.cropType}</td>
                      <td className="py-3 pr-4 text-right font-semibold tabular">{fmtKg(l.quantityKg)}</td>
                      <td className="py-3 pr-4"><GradeBadge grade={l.qualityGrade} /></td>
                      <td className="py-3 pr-4 text-stone-500">{fmtDate(l.harvestDate)}</td>
                      <td className="py-3 pr-4"><YieldBadge score={l.yieldScore} /></td>
                      <td className="py-3 pr-4"><StatusBadge status={l.status} /></td>
                      <td className="py-3 text-stone-400">{relTime(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile, stacked cards */}
            <div className="space-y-2.5 md:hidden">
              {logs.map((l) => (
                <div key={l.id} className="rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-stone-800">{l.cropType}</p>
                    <StatusBadge status={l.status} />
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-stone-400">{l.id} · logged {relTime(l.createdAt)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-stone-600">
                    <span className="font-bold text-forest-800 tabular">{fmtKg(l.quantityKg)}</span>
                    <GradeBadge grade={l.qualityGrade} />
                    <YieldBadge score={l.yieldScore} />
                  </div>
                  <p className="mt-1.5 text-[12px] text-stone-400">Harvested {fmtDate(l.harvestDate)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* edit modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${farmer.fullName}`} wide>
        <FarmerForm existing={farmer} onDone={() => setEditing(false)} />
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteFarmers([farmer.id]);
          router.push("/farmers");
        }}
        title="Delete farmer profile?"
        danger
        confirmLabel="Delete profile"
        message={
          <>
            This will permanently remove <b>{farmer.fullName}</b> ({farmer.id}) and all{" "}
            <b>{logs.length}</b> of their harvest log{logs.length === 1 ? "" : "s"}.
          </>
        }
      />
    </div>
  );
}

/**
 * "Registered by <agent>" line with an inline editor (admin only).
 * Admins can assign/change the agent credited for this farmer here —
 * saved straight to the cloud (UPDATE via the admin session).
 */
function RegisteredByEditor({ farmer }: { farmer: Farmer }) {
  const db = useDb();
  const isAdmin = db.meta.role === "ADMIN";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const current = farmer.loggedBy || farmer.survey?.enumeratorName || "";

  if (editing) {
    return (
      <div className="mt-0.5 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Agent name (e.g. John Okello)"
          autoFocus
          className="h-9 w-56 rounded-lg border border-stone-300 bg-white px-3 text-[13px] font-medium text-stone-700 outline-none focus:border-forest-500"
        />
        <button
          type="button"
          onClick={() => {
            const n = draft.trim();
            if (!n) return;
            updateFarmer(farmer.id, { loggedBy: n });
            setEditing(false);
          }}
          disabled={!draft.trim()}
          aria-label="Save agent name"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-forest-800 text-white transition-colors hover:bg-forest-700 disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancel"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      {current ? (
        <p className="text-[12px] font-semibold text-ochre-600">
          Registered by <span className="font-bold">{current}</span>
        </p>
      ) : (
        <p className="text-[12px] text-stone-400">No agent recorded</p>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={() => {
            setDraft(current);
            setEditing(true);
          }}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-stone-400 underline underline-offset-2 hover:text-forest-700"
        >
          <Pencil className="h-3 w-3" /> {current ? "change" : "add agent"}
        </button>
      )}
    </div>
  );
}

function SurveyFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold tracking-wide text-stone-400 uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-stone-800">{value}</dd>
    </div>
  );
}
