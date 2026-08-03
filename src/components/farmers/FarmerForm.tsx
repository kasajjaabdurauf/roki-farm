"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Info, Plus, Trash2 } from "lucide-react";
import { addFarmer, setDemoFarmer, updateFarmer, useDb } from "@/lib/db";
import { normalizeUgPhone } from "@/lib/phone";
import { CROPS, CROP_DEFAULTS, DISTRICTS, MONTHS, SUB_COUNTIES } from "@/lib/reference";
import { computeRokiTier, rokiTierCriteria } from "@/lib/rules";
import {
  AGE_GROUPS,
  CARRIER_LABEL,
  CLIMATE_CHALLENGES,
  CLIMATE_PRACTICES,
  FARMING_TYPES,
  FARMING_YEARS_OPTIONS,
  FINANCE_SOURCES,
  GENDER_LABEL,
  INPUT_SOURCES,
  IRRIGATION_OPTIONS,
  IRRIGATION_TYPES,
  LAND_OWNERSHIP_LABEL,
  PRODUCTION_LIMITS,
  PRODUCTION_SEASONS,
  PRODUCTION_SYSTEMS,
  RECOMMENDED_CATEGORIES,
  RECORD_TYPES,
  REFUGEE_LABEL,
  REFUGEE_ORIGINS,
  ROKI_TIER_LABEL,
  SALES_CHANNELS,
  SELLING_CHALLENGES,
  SELL_TO,
  SUPPLY_CROPS,
  type AgeGroup,
  type Farmer,
  type FarmerSurvey,
  type Gender,
  type IrrigationType,
  type LandOwnership,
  type PlannedProduction,
  type RefugeeStatus,
} from "@/lib/types";
import { Button, Field, Input, Select } from "@/components/ui";
import { cx } from "@/lib/format";

// ------------------------------------------------------------------
// Draft = the full questionnaire (15 sections) + core identity fields
// ------------------------------------------------------------------
interface SurveyDraft extends FarmerSurvey {
  fullName: string;
  phone: string;
  nin: string;
  district: string;
  subCounty: string;
  village: string;
  acreage: string;
  productions: PlannedProduction[]; // Section 10.3, production plan for Roki
  // mirrors kept on the farmer record
  gender: Gender;
  refugeeStatus: RefugeeStatus;
  landOwnership: LandOwnership;
}

function draftFromFarmer(f: Farmer | undefined): SurveyDraft {
  const sv = f?.survey;
  return {
    enumeratorName: sv?.enumeratorName ?? "",
    enumeratorId: sv?.enumeratorId ?? "",
    ageYears: sv?.ageYears,
    altPhone: sv?.altPhone ?? "",
    parish: sv?.parish ?? "",
    gpsLat: sv?.gpsLat,
    gpsLon: sv?.gpsLon,
    countryOfOrigin: sv?.countryOfOrigin ?? "",
    yearArrivedUganda: sv?.yearArrivedUganda,
    refugeeSettlement: sv?.refugeeSettlement ?? "",
    refugeeHouseholdNo: sv?.refugeeHouseholdNo ?? "",
    householdAdults: sv?.householdAdults,
    householdChildren: sv?.householdChildren,
    femaleHeaded: sv?.femaleHeaded ?? false,
    youthFarmer: sv?.youthFarmer ?? false,
    personWithDisability: sv?.personWithDisability ?? false,
    elderlyFarmer: sv?.elderlyFarmer ?? false,
    farmingYears: sv?.farmingYears ?? "Y1_5",
    farmingTypes: sv?.farmingTypes ?? [],
    previousCrops: sv?.previousCrops ?? [],
    soldCommercially: sv?.soldCommercially ?? false,
    salesChannels: sv?.salesChannels ?? [],
    hasLandAccess: sv?.hasLandAccess ?? true,
    landOwnershipOther: sv?.landOwnershipOther ?? "",
    cultivatedAcreage: sv?.cultivatedAcreage ?? (f?.acreage ? f.acreage : 0),
    expansionAvailable: sv?.expansionAvailable ?? false,
    expansionAcreage: sv?.expansionAcreage,
    currentCrops: sv?.currentCrops ?? [],
    productionSeason: sv?.productionSeason ?? "FIRST",
    productionSystem: sv?.productionSystem ?? "OPEN_FIELD",
    currentCapacityCrop: sv?.currentCapacityCrop ?? "",
    currentCapacityKg: sv?.currentCapacityKg,
    futureCapacityCrop: sv?.futureCapacityCrop ?? "",
    futureCapacityKg: sv?.futureCapacityKg,
    productionLimits: sv?.productionLimits ?? [],
    inputSource: sv?.inputSource ?? "LOCAL_SHOPS",
    usesImprovedSeed: sv?.usesImprovedSeed ?? false,
    extensionSupport: sv?.extensionSupport ?? false,
    extensionFrom: sv?.extensionFrom ?? "",
    hasIrrigation: sv?.hasIrrigation ?? false,
    irrigationType: sv?.irrigationType ?? "",
    keepsRecords: sv?.keepsRecords ?? false,
    recordTypes: sv?.recordTypes ?? [],
    willingDigitalRecords: sv?.willingDigitalRecords ?? true,
    sellTo: sv?.sellTo ?? [],
    avgPriceCrop: sv?.avgPriceCrop ?? "",
    avgPriceUgx: sv?.avgPriceUgx,
    sellingChallenges: sv?.sellingChallenges ?? [],
    wantsToSupplyRoki: sv?.wantsToSupplyRoki ?? true,
    supplyCrops: sv?.supplyCrops ?? [],
    willingRokiSpecs: sv?.willingRokiSpecs ?? false,
    willingExportStandards: sv?.willingExportStandards ?? false,
    acceptForwardPurchase: sv?.acceptForwardPurchase ?? false,
    accessedFinance: sv?.accessedFinance ?? false,
    financeSources: sv?.financeSources ?? [],
    needsFinancing: sv?.needsFinancing ?? false,
    climateChallenges: sv?.climateChallenges ?? [],
    willingClimateSmart: sv?.willingClimateSmart ?? false,
    climatePractices: sv?.climatePractices ?? [],
    consent: sv?.consent ?? false,
    consentDate: sv?.consentDate ?? new Date().toISOString().slice(0, 10),
    landAvailability: sv?.landAvailability ?? "MEDIUM",
    productionPotential: sv?.productionPotential ?? "MEDIUM",
    recommendedCategory: sv?.recommendedCategory ?? "EMERGING",
    // identity / mirrors
    fullName: f?.fullName ?? "",
    phone: f?.phone ?? "",
    nin: f?.nin ?? "",
    district: f?.district ?? "",
    subCounty: f?.subCounty ?? "",
    village: f?.village ?? "",
    acreage: f ? String(f.acreage) : "",
    productions: f?.plannedProductions ?? [],
    gender: f?.gender ?? "F",
    refugeeStatus: f?.refugeeStatus ?? "HOST",
    landOwnership: f?.landOwnership ?? "OWN",
  };
}

const STEPS = [
  { id: "identity", label: "Section 1 · Identification & bio-data" },
  { id: "community", label: "Section 2 · Refugee & host community status" },
  { id: "experience", label: "Section 3 · Farming experience & history" },
  { id: "land", label: "Section 4 · Land & farm assets" },
  { id: "activities", label: "Sections 5–6 · Current activities & capacity" },
  { id: "inputs", label: "Sections 7–8 · Inputs, technology & management" },
  { id: "market", label: "Sections 9–10 · Market & interest in Roki" },
  { id: "contract", label: "Sections 11–13 · Contract, finance & climate" },
  { id: "consent", label: "Sections 14–15 · Consent, assessment & review" },
] as const;

// ------------------------------------------------------------------
// Small form primitives
// ------------------------------------------------------------------
function ChipGroup({
  options,
  value,
  onChange,
  cols = "flex-wrap",
}: {
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  cols?: string;
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className={cx("flex gap-2", cols)}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={cx(
              "touch-target inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
              on
                ? "border-forest-700 bg-forest-800 text-white"
                : "border-stone-300 bg-white text-stone-600 hover:border-forest-400 hover:text-forest-800"
            )}
          >
            {on && <CheckCircle2 className="h-3.5 w-3.5" />}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="flex gap-2">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={cx(
            "touch-target h-11 min-w-[84px] rounded-xl border px-4 text-[13px] font-semibold transition-colors",
            value === v
              ? v
                ? "border-forest-700 bg-forest-800 text-white"
                : "border-stone-400 bg-stone-200 text-stone-600"
              : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
          )}
        >
          {v ? "Yes" : "No"}
        </button>
      ))}
      {label && <span className="self-center text-[13px] text-stone-500">{label}</span>}
    </div>
  );
}

function SectionNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-forest-50 px-3.5 py-3 text-[12.5px] leading-snug text-forest-800">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// ------------------------------------------------------------------
// The wizard
// ------------------------------------------------------------------
export function FarmerForm({ existing, onDone, selfRegistration }: { existing?: Farmer; onDone?: () => void; selfRegistration?: boolean }) {
  const router = useRouter();
  const db = useDb();
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [claimedId, setClaimedId] = useState<string | undefined>(undefined);
  const [d, setD] = useState<SurveyDraft>(() => draftFromFarmer(existing));

  const set = <K extends keyof SurveyDraft>(k: K, v: SurveyDraft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const phoneResult = useMemo(() => normalizeUgPhone(d.phone), [d.phone]);
  const districtSubs = d.district ? SUB_COUNTIES[d.district] ?? [] : [];

  // --- automatic linking for phone-based records (Scenario: uploaded list) ---
  // If the phone the farmer enters matches an existing record (that isn't
  // already theirs), offer to claim it so their new login becomes that farmer.
  const phoneMatch = useMemo(() => {
    if (!selfRegistration || !phoneResult.ok) return undefined;
    const ownId = existing?.id ?? claimedId;
    const normalized = phoneResult.normalized!;
    return db.farmers.find((f) => f.phone === normalized && f.id !== ownId);
  }, [selfRegistration, phoneResult, db.farmers, existing?.id, claimedId]);

  const [linking, setLinking] = useState(false);

  async function claimPhoneMatch() {
    if (!phoneMatch) return;
    setLinking(true);
    try {
      setDemoFarmer(phoneMatch.id);
      try {
        await linkAccountToFarmer(phoneMatch.id);
      } catch {
        /* local claim is enough; cloud retries on sync */
      }
      setClaimedId(phoneMatch.id);
      setD(draftFromFarmer(phoneMatch));
    } finally {
      setLinking(false);
    }
  }

  const tierPreview = useMemo(
    () => computeRokiTier({ id: existing?.id ?? "x", acreage: parseFloat(d.acreage) || 0 }, []),
    [d.acreage, existing]
  );

  // ---------- per-step validation ----------
  function stepErrors(i: number): string[] {
    const errs: string[] = [];
    if (i === 0) {
      if (!d.fullName.trim()) errs.push("Full name is required (1.2)");
      if (!d.phone.trim()) errs.push("Primary phone number is required (1.5)");
      else if (!phoneResult.ok) errs.push(phoneResult.reason ?? "Invalid phone number");
      if (d.ageYears !== undefined && (isNaN(d.ageYears) || d.ageYears < 10 || d.ageYears > 110))
        errs.push("Age in years (1.4) must be between 10 and 110");
    }
    if (i === 1) {
      if (d.refugeeStatus === "REFUGEE" && !d.countryOfOrigin) errs.push("Country of origin is required for refugee farmers (2.2)");
    }
    if (i === 3) {
      const ac = parseFloat(d.acreage);
      if (!d.acreage.trim() || isNaN(ac) || ac <= 0) errs.push("Total acreage must be greater than 0 (4.3)");
      else if (d.cultivatedAcreage > ac + 0.001) errs.push("Land under cultivation (4.4) cannot exceed total acreage");
      if (!d.hasLandAccess) errs.push("Farmer has no land access, confirm with the enumerator before completing (4.1)");
    }
    if (i === 4) {
      for (const c of d.currentCrops) {
        if (!c.crop) errs.push("Every current crop row needs a crop (5.1)");
        if (c.areaAcres <= 0) errs.push(`${c.crop || "Row"}: area planted must be greater than 0`);
        if (c.expectedQtyKg <= 0) errs.push(`${c.crop || "Row"}: expected quantity must be greater than 0`);
      }
    }
    if (i === 6) {
      for (const p of d.productions) {
        if (!p.crop) errs.push("Every production row needs a crop (10.3)");
        if (p.acres <= 0) errs.push(`${p.crop || "Row"}: area planned must be greater than 0`);
        if (p.expectedVolumeKg <= 0) errs.push(`${p.crop || "Row"}: expected quantity must be greater than 0`);
        if (!p.harvestStartMonth || !p.harvestEndMonth) errs.push(`${p.crop || "Row"}: pick the expected harvest period`);
      }
      if (d.wantsToSupplyRoki && d.productions.length === 0)
        errs.push("Add at least one crop to the expected production plan for Roki (10.3), or set interest to No (10.1)");
    }
    if (i === 8) {
      if (!d.consent) errs.push("Farmer consent is required to register them on the digital platform (Section 14)");
    }
    return errs;
  }

  const currentErrors = tried ? stepErrors(step) : [];

  function next() {
    setTried(true);
    if (stepErrors(step).length > 0) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      setTried(false);
    } else {
      submit();
    }
  }

  function back() {
    if (step > 0) {
      setStep(step - 1);
      setTried(false);
    } else router.back();
  }

  async function submit() {
    const survey: FarmerSurvey = {
      enumeratorName: d.enumeratorName,
      enumeratorId: d.enumeratorId,
      ageYears: d.ageYears,
      altPhone: d.altPhone || undefined,
      parish: d.parish || undefined,
      gpsLat: d.gpsLat,
      gpsLon: d.gpsLon,
      countryOfOrigin: d.refugeeStatus === "REFUGEE" ? d.countryOfOrigin : undefined,
      yearArrivedUganda: d.refugeeStatus === "REFUGEE" ? d.yearArrivedUganda : undefined,
      refugeeSettlement: d.refugeeStatus === "REFUGEE" ? d.refugeeSettlement : undefined,
      refugeeHouseholdNo: d.refugeeStatus === "REFUGEE" ? d.refugeeHouseholdNo : undefined,
      householdAdults: d.householdAdults,
      householdChildren: d.householdChildren,
      femaleHeaded: d.femaleHeaded,
      youthFarmer: d.youthFarmer,
      personWithDisability: d.personWithDisability,
      elderlyFarmer: d.elderlyFarmer,
      farmingYears: d.farmingYears,
      farmingTypes: d.farmingTypes,
      previousCrops: d.previousCrops,
      soldCommercially: d.soldCommercially,
      salesChannels: d.soldCommercially ? d.salesChannels : [],
      hasLandAccess: d.hasLandAccess,
      landOwnershipOther: d.landOwnershipOther || undefined,
      cultivatedAcreage: d.cultivatedAcreage,
      expansionAvailable: d.expansionAvailable,
      expansionAcreage: d.expansionAvailable ? d.expansionAcreage : undefined,
      currentCrops: d.currentCrops,
      productionSeason: d.productionSeason,
      productionSystem: d.productionSystem,
      currentCapacityCrop: d.currentCapacityCrop || undefined,
      currentCapacityKg: d.currentCapacityKg,
      futureCapacityCrop: d.futureCapacityCrop || undefined,
      futureCapacityKg: d.futureCapacityKg,
      productionLimits: d.productionLimits,
      inputSource: d.inputSource,
      usesImprovedSeed: d.usesImprovedSeed,
      extensionSupport: d.extensionSupport,
      extensionFrom: d.extensionSupport ? d.extensionFrom : undefined,
      hasIrrigation: d.hasIrrigation,
      irrigationType: d.hasIrrigation ? d.irrigationType : undefined,
      keepsRecords: d.keepsRecords,
      recordTypes: d.keepsRecords ? d.recordTypes : [],
      willingDigitalRecords: d.willingDigitalRecords,
      sellTo: d.sellTo,
      avgPriceCrop: d.avgPriceCrop || undefined,
      avgPriceUgx: d.avgPriceUgx,
      sellingChallenges: d.sellingChallenges,
      wantsToSupplyRoki: d.wantsToSupplyRoki,
      supplyCrops: d.wantsToSupplyRoki ? d.supplyCrops : [],
      willingRokiSpecs: d.willingRokiSpecs,
      willingExportStandards: d.willingExportStandards,
      acceptForwardPurchase: d.acceptForwardPurchase,
      accessedFinance: d.accessedFinance,
      financeSources: d.accessedFinance ? d.financeSources : [],
      needsFinancing: d.needsFinancing,
      climateChallenges: d.climateChallenges,
      willingClimateSmart: d.willingClimateSmart,
      climatePractices: d.willingClimateSmart ? d.climatePractices : [],
      consent: d.consent,
      consentDate: d.consent ? d.consentDate : undefined,
      landAvailability: d.landAvailability,
      productionPotential: d.productionPotential,
      recommendedCategory: d.recommendedCategory,
    };

    const input = {
      fullName: d.fullName,
      phone: d.phone,
      nin: d.nin || undefined,
      district: d.district,
      subCounty: d.subCounty,
      village: d.village || undefined,
      acreage: parseFloat(d.acreage) || 0,
      primaryCrops: d.currentCrops.map((c) => c.crop).filter(Boolean),
      irrigationType: (d.hasIrrigation ? d.irrigationType : "NONE") as IrrigationType,
      gender: d.gender,
      refugeeStatus: d.refugeeStatus,
      ageGroup: ageGroupOf(d.ageYears),
      landOwnership: landOwnershipOf(d.landOwnership, d.landOwnershipOther ?? ""),
      householdSize: (d.householdAdults ?? 0) + (d.householdChildren ?? 0) || undefined,
      plannedProductions: d.productions,
      survey,
    };

    const target = existing ?? (claimedId ? db.farmers.find((f) => f.id === claimedId) : undefined);
    if (target) {
      // accounts ARE farmers: self-registration updates the account's OWN
      // record (created automatically at signup, or claimed via phone).
      updateFarmer(target.id, input);
      if (selfRegistration) {
        try {
          await linkAccountToFarmer(target.id);
        } catch {
          /* retried on next sync */
        }
      }
      onDone?.();
    } else {
      const created = addFarmer(input);
      if (selfRegistration) {
        // defensive: if the account somehow has no record yet, create one
        // and claim it (server normally creates it at signup)
        setDemoFarmer(created.id);
        try {
          await linkAccountToFarmer(created.id);
        } catch {
          // local claim is enough for now; cloud linking retries on sync
        }
        router.push("/farm");
      } else {
        router.push(`/farmers/${created.id}`);
      }
    }
  }

  // ---------- production plan helpers (10.3) ----------
  function addProduction() {
    const crop = CROPS.find((c) => !d.productions.some((p) => p.crop === c)) ?? "Tomato";
    const typical = CROP_DEFAULTS[crop]?.typicalPerAcreKg ?? 4000;
    set("productions", [
      ...d.productions,
      { id: `pp-${Date.now()}`, crop, acres: 1, expectedVolumeKg: typical, harvestStartMonth: 7, harvestEndMonth: 9 },
    ]);
  }
  function updateProduction(id: string, patch: Partial<PlannedProduction>) {
    set(
      "productions",
      d.productions.map((p) => {
        if (p.id !== id) return p;
        const np = { ...p, ...patch };
        if ((patch.crop || patch.acres) && !patch.expectedVolumeKg) {
          np.expectedVolumeKg = Math.round(np.acres * (CROP_DEFAULTS[np.crop]?.typicalPerAcreKg ?? 4000));
        }
        return np;
      })
    );
  }

  // ---------- table helpers ----------
  function addCurrentCrop() {
    set("currentCrops", [
      ...d.currentCrops,
      { crop: CROPS.find((c) => !d.currentCrops.some((x) => x.crop === c)) ?? "Tomato", areaAcres: 1, expectedHarvestDate: "", expectedQtyKg: 2000 },
    ]);
  }
  function addPreviousCrop() {
    set("previousCrops", [...d.previousCrops, { crop: "Tomato", yearsProduced: 1, avgAreaAcres: 0.5 }]);
  }

  const totalPlanAcres = d.productions.reduce((s, p) => s + p.acres, 0);
  const totalPlanKg = d.productions.reduce((s, p) => s + p.expectedVolumeKg, 0);
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="space-y-6">
      {/* progress */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-bold text-forest-800">
            Step {step + 1} of {STEPS.length} · {STEPS[step].label}
          </p>
          <p className="text-[12px] font-semibold text-stone-400">{Math.round(progress)}%</p>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => i < step && setStep(i)}
              className={cx("h-2 flex-1 rounded-full transition-colors", i <= step ? "bg-forest-700" : "bg-stone-200")}
              aria-label={`Step ${i + 1}: ${s.label}`}
            />
          ))}
        </div>
      </div>

      {/* ============ STEP 1 · SECTION 1, IDENTIFICATION ============ */}
      {step === 0 && (
        <div className="space-y-6">
          <SectionNote>
            Matches Section 1 of the Roki questionnaire, farmer identification and bio-data. Farmer ID (1.1) is
            auto-generated by the system.
          </SectionNote>
          {!selfRegistration && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Enumerator name" hint="1.1">
                <Input value={d.enumeratorName} onChange={(e) => set("enumeratorName", e.target.value)} placeholder="Field officer name" />
              </Field>
              <Field label="Enumerator ID" hint="1.1">
                <Input value={d.enumeratorId} onChange={(e) => set("enumeratorId", e.target.value)} placeholder="e.g. EN-104" />
              </Field>
            </div>
          )}
          {selfRegistration && (
            <SectionNote>
              Welcome! This is the official Roki farmer registration survey. It takes about 10 minutes and helps us
              plan production, connect you to markets and grow your farm. Your answers are confidential.
            </SectionNote>
          )}
          <Field label="Full name" required hint="1.2">
            <Input value={d.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Aisha Namukwaya" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Gender" required hint="1.3">
              <div className="grid grid-cols-3 gap-2">
                {(["M", "F", "OTHER"] as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set("gender", g)}
                    className={cx(
                      "touch-target h-11 rounded-xl border text-[13px] font-semibold transition-colors",
                      d.gender === g ? "border-forest-700 bg-forest-800 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                    )}
                  >
                    {GENDER_LABEL[g]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Age (years)" hint="1.4">
              <Input type="number" min={10} max={110} value={d.ageYears ?? ""} onChange={(e) => set("ageYears", e.target.value ? parseInt(e.target.value, 10) : undefined)} placeholder="e.g. 34" inputMode="numeric" />
            </Field>
            <Field label="National ID / NIN" hint="optional">
              <Input value={d.nin} onChange={(e) => set("nin", e.target.value)} placeholder="e.g. CM12345678" />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Primary phone number"
              required
              hint="1.5 · MTN / Airtel Uganda"
              error={tried ? stepErrors(0).find((e) => e.includes("phone")) : undefined}
            >
              <Input
                value={d.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="07XX XXX XXX or +2567…"
                inputMode="tel"
                invalid={d.phone.trim() !== "" && !phoneResult.ok}
              />
              {phoneResult.ok && phoneResult.carrier && (
                <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-success-dark">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {CARRIER_LABEL[phoneResult.carrier]} · {phoneResult.normalized}
                </span>
              )}
            </Field>
            <Field label="Alternative contact" hint="1.5 · optional">
              <Input value={d.altPhone} onChange={(e) => set("altPhone", e.target.value)} placeholder="Spouse / relative phone" inputMode="tel" />
            </Field>
          </div>
          {selfRegistration && phoneMatch && (
            <div className="rounded-2xl border-2 border-ochre-400 bg-ochre-50 p-4">
              <p className="text-[13px] font-bold text-ochre-800">Existing record found for this phone</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-stone-600">
                <b>{phoneMatch.fullName || phoneMatch.email || phoneMatch.id}</b> · {phoneMatch.id}
                {phoneMatch.district ? ` · ${phoneMatch.district}` : ""} — is this you? If so, link your login to
                this record and your history will appear on your account.
              </p>
              <button
                type="button"
                onClick={() => void claimPhoneMatch()}
                disabled={linking}
                className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-ochre-500 px-4 text-[13px] font-bold text-white transition-colors hover:bg-ochre-600 disabled:opacity-50"
              >
                {linking ? "Linking…" : "Yes, link my account to this record"}
              </button>
              <p className="mt-2 text-[11.5px] text-stone-400">
                Your phone number will be associated with that farmer record. No ID needed.
              </p>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="District" required hint="1.6">
              <Select value={d.district} onChange={(e) => { set("district", e.target.value); set("subCounty", ""); }}>
                <option value="">Select district…</option>
                {DISTRICTS.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </Select>
            </Field>
            <Field label="Sub-county" required hint="1.6">
              <Select value={d.subCounty} onChange={(e) => set("subCounty", e.target.value)} disabled={!d.district}>
                <option value="">{d.district ? "Select sub-county…" : "Pick district first"}</option>
                {districtSubs.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </Select>
            </Field>
            <Field label="Parish">
              <Input value={d.parish} onChange={(e) => set("parish", e.target.value)} placeholder="Parish name" />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Village">
              <Input value={d.village} onChange={(e) => set("village", e.target.value)} placeholder="e.g. Busukuma" />
            </Field>
            <Field label="GPS latitude" hint="1.6 · optional">
              <Input type="number" step="any" value={d.gpsLat ?? ""} onChange={(e) => set("gpsLat", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="e.g. -0.7194" inputMode="decimal" />
            </Field>
            <Field label="GPS longitude" hint="1.6 · optional">
              <Input type="number" step="any" value={d.gpsLon ?? ""} onChange={(e) => set("gpsLon", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="e.g. 30.9053" inputMode="decimal" />
            </Field>
          </div>
        </div>
      )}

      {/* ============ STEP 2 · SECTION 2, COMMUNITY & HOUSEHOLD ============ */}
      {step === 1 && (
        <div className="space-y-6">
          <Field label="Are you a refugee or member of the host community?" required hint="2.1">
            <div className="grid grid-cols-2 gap-2 sm:max-w-md">
              {(["REFUGEE", "HOST"] as RefugeeStatus[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set("refugeeStatus", r)}
                  className={cx(
                    "touch-target h-12 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                    d.refugeeStatus === r ? "border-ochre-500 bg-ochre-500 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                  )}
                >
                  {REFUGEE_LABEL[r]}
                </button>
              ))}
            </div>
          </Field>

          {d.refugeeStatus === "REFUGEE" && (
            <div className="space-y-4 rounded-2xl border border-ochre-200 bg-ochre-50/50 p-4">
              <p className="text-[12px] font-bold tracking-wide text-ochre-700 uppercase">If refugee, provide details (2.2)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Country of origin" required>
                  <Select value={d.countryOfOrigin} onChange={(e) => set("countryOfOrigin", e.target.value)}>
                    <option value="">Select country…</option>
                    {REFUGEE_ORIGINS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Year arrived in Uganda">
                  <Input type="number" min={1970} max={2026} value={d.yearArrivedUganda ?? ""} onChange={(e) => set("yearArrivedUganda", e.target.value ? parseInt(e.target.value, 10) : undefined)} placeholder="e.g. 2016" inputMode="numeric" />
                </Field>
                <Field label="Refugee settlement">
                  <Input value={d.refugeeSettlement} onChange={(e) => set("refugeeSettlement", e.target.value)} placeholder="e.g. Nakivale Refugee Settlement" />
                </Field>
                <Field label="Refugee household number" hint="if applicable">
                  <Input value={d.refugeeHouseholdNo} onChange={(e) => set("refugeeHouseholdNo", e.target.value)} placeholder="e.g. RH-45123" />
                </Field>
              </div>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Adults in household" hint="2.3">
              <Input type="number" min={0} max={30} value={d.householdAdults ?? ""} onChange={(e) => set("householdAdults", e.target.value ? parseInt(e.target.value, 10) : undefined)} inputMode="numeric" />
            </Field>
            <Field label="Children in household" hint="2.3">
              <Input type="number" min={0} max={30} value={d.householdChildren ?? ""} onChange={(e) => set("householdChildren", e.target.value ? parseInt(e.target.value, 10) : undefined)} inputMode="numeric" />
            </Field>
            <Field label="Total household members" hint="2.3 · auto">
              <Input value={((d.householdAdults ?? 0) + (d.householdChildren ?? 0)) || ""} disabled placeholder="Adults + children" />
            </Field>
          </div>

          <Field label="Does the household include…" hint="2.4 · vulnerability characteristics">
            <div className="grid gap-2 sm:grid-cols-2">
              <ToggleRow label="Female-headed household" value={d.femaleHeaded} onChange={(v) => set("femaleHeaded", v)} />
              <ToggleRow label="Youth farmer (18–35 years)" value={d.youthFarmer} onChange={(v) => set("youthFarmer", v)} />
              <ToggleRow label="Person with disability" value={d.personWithDisability} onChange={(v) => set("personWithDisability", v)} />
              <ToggleRow label="Elderly farmer" value={d.elderlyFarmer} onChange={(v) => set("elderlyFarmer", v)} />
            </div>
          </Field>
        </div>
      )}

      {/* ============ STEP 3 · SECTION 3, FARMING EXPERIENCE ============ */}
      {step === 2 && (
        <div className="space-y-6">
          <Field label="How long have you been involved in farming?" required hint="3.1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FARMING_YEARS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set("farmingYears", o.value)}
                  className={cx(
                    "touch-target h-12 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                    d.farmingYears === o.value ? "border-forest-700 bg-forest-800 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="What type of farming do you practice?" hint="3.2 · multiple">
            <ChipGroup options={FARMING_TYPES} value={d.farmingTypes} onChange={(v) => set("farmingTypes", v)} />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-stone-600">Crops produced before</p>
              <p className="text-[12px] text-stone-400">3.3 · crop, years produced, average area</p>
            </div>
            <div className="space-y-2">
              {d.previousCrops.map((p, idx) => (
                <div key={idx} className="grid grid-cols-2 items-center gap-2.5 rounded-xl border border-stone-200 bg-white p-3 sm:grid-cols-[1fr_120px_120px_40px]">
                  <Input value={p.crop} onChange={(e) => set("previousCrops", d.previousCrops.map((x, i) => (i === idx ? { ...x, crop: e.target.value } : x)))} placeholder="Crop" />
                  <Input type="number" min={0} value={p.yearsProduced ?? ""} onChange={(e) => set("previousCrops", d.previousCrops.map((x, i) => (i === idx ? { ...x, yearsProduced: e.target.value ? parseInt(e.target.value, 10) : undefined } : x)))} placeholder="Years" inputMode="numeric" />
                  <Input type="number" min={0} step="0.1" value={p.avgAreaAcres ?? ""} onChange={(e) => set("previousCrops", d.previousCrops.map((x, i) => (i === idx ? { ...x, avgAreaAcres: e.target.value ? parseFloat(e.target.value) : undefined } : x)))} placeholder="Acres (ac)" inputMode="decimal" />
                  <button
                    onClick={() => set("previousCrops", d.previousCrops.filter((_, i) => i !== idx))}
                    className="grid h-11 w-9 place-items-center rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addPreviousCrop}>
                <Plus className="h-3.5 w-3.5" /> Add crop
              </Button>
            </div>
          </div>

          <Field label="Have you previously sold produce commercially?" hint="3.4">
            <YesNo value={d.soldCommercially} onChange={(v) => set("soldCommercially", v)} />
          </Field>
          {d.soldCommercially && (
            <Field label="Where did you sell?" hint="3.4 · multiple">
              <ChipGroup options={SALES_CHANNELS} value={d.salesChannels} onChange={(v) => set("salesChannels", v)} />
            </Field>
          )}
        </div>
      )}

      {/* ============ STEP 4 · SECTION 4, LAND & ASSETS ============ */}
      {step === 3 && (
        <div className="space-y-6">
          <Field label="Do you currently have access to land for farming?" required hint="4.1">
            <YesNo value={d.hasLandAccess} onChange={(v) => set("hasLandAccess", v)} />
          </Field>

          <Field label="Land ownership status" hint="4.2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(LAND_OWNERSHIP_LABEL) as LandOwnership[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => set("landOwnership", o)}
                  className={cx(
                    "touch-target h-12 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                    d.landOwnership === o ? "border-forest-700 bg-forest-800 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                  )}
                >
                  {LAND_OWNERSHIP_LABEL[o]}
                </button>
              ))}
            </div>
          </Field>
          {d.landOwnership === "OTHER" && (
            <Field label="Other land ownership (specify)">
              <Input value={d.landOwnershipOther} onChange={(e) => set("landOwnershipOther", e.target.value)} placeholder="Specify…" />
            </Field>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Total acreage" required hint="4.3 · acres">
              <Input type="number" min={0} step="0.1" value={d.acreage} onChange={(e) => set("acreage", e.target.value)} placeholder="e.g. 3.5" inputMode="decimal" />
            </Field>
            <Field label="Land currently under cultivation" hint="4.4 · acres">
              <Input type="number" min={0} step="0.1" value={d.cultivatedAcreage || ""} onChange={(e) => set("cultivatedAcreage", parseFloat(e.target.value) || 0)} placeholder="e.g. 2.0" inputMode="decimal" />
            </Field>
          </div>

          <Field label="Additional land available for expansion?" hint="4.5">
            <YesNo value={d.expansionAvailable} onChange={(v) => set("expansionAvailable", v)} />
          </Field>
          {d.expansionAvailable && (
            <Field label="Additional acreage" hint="4.5 · acres">
              <Input type="number" min={0} step="0.1" value={d.expansionAcreage ?? ""} onChange={(e) => set("expansionAcreage", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="e.g. 1.5" inputMode="decimal" />
            </Field>
          )}
        </div>
      )}

      {/* ============ STEP 5 · SECTIONS 5–6, ACTIVITIES & CAPACITY ============ */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-stone-600">Current crops grown</p>
              <p className="text-[12px] text-stone-400">5.1 · crop, area planted, expected harvest date, expected quantity</p>
            </div>
            <div className="space-y-2.5">
              {d.currentCrops.map((c, idx) => (
                <div key={idx} className="grid grid-cols-1 items-center gap-2.5 rounded-xl border border-stone-200 bg-white p-3.5 sm:grid-cols-[1fr_100px_150px_120px_36px]">
                  <Select value={c.crop} onChange={(e) => set("currentCrops", d.currentCrops.map((x, i) => (i === idx ? { ...x, crop: e.target.value } : x)))}>
                    {CROPS.map((o) => (
                      <option key={o} value={o} disabled={d.currentCrops.some((x) => x.crop === o && x !== c)}>{o}</option>
                    ))}
                  </Select>
                  <Input type="number" min={0} step="0.1" value={c.areaAcres || ""} onChange={(e) => set("currentCrops", d.currentCrops.map((x, i) => (i === idx ? { ...x, areaAcres: parseFloat(e.target.value) || 0 } : x)))} placeholder="Acres (ac)" inputMode="decimal" />
                  <Input type="date" value={c.expectedHarvestDate} onChange={(e) => set("currentCrops", d.currentCrops.map((x, i) => (i === idx ? { ...x, expectedHarvestDate: e.target.value } : x)))} />
                  <Input type="number" min={0} value={c.expectedQtyKg || ""} onChange={(e) => set("currentCrops", d.currentCrops.map((x, i) => (i === idx ? { ...x, expectedQtyKg: parseFloat(e.target.value) || 0 } : x)))} placeholder="Qty (kg)" inputMode="numeric" />
                  <button
                    onClick={() => set("currentCrops", d.currentCrops.filter((_, i) => i !== idx))}
                    className="grid h-11 w-9 place-items-center justify-self-end rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCurrentCrop}>
                <Plus className="h-3.5 w-3.5" /> Add current crop
              </Button>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Current production season" hint="5.2">
              <Select value={d.productionSeason} onChange={(e) => set("productionSeason", e.target.value)}>
                {PRODUCTION_SEASONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Production system" hint="5.3">
              <Select value={d.productionSystem} onChange={(e) => set("productionSystem", e.target.value)}>
                {PRODUCTION_SYSTEMS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-5 rounded-2xl border border-stone-200 bg-stone-50/50 p-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[12px] font-bold tracking-wide text-stone-400 uppercase">6.1 · Current quantity produced</p>
              <div className="grid grid-cols-2 gap-2">
                <Input value={d.currentCapacityCrop} onChange={(e) => set("currentCapacityCrop", e.target.value)} placeholder="Crop" />
                <Input type="number" min={0} value={d.currentCapacityKg ?? ""} onChange={(e) => set("currentCapacityKg", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="kg" inputMode="numeric" />
              </div>
            </div>
            <div>
              <p className="mb-2 text-[12px] font-bold tracking-wide text-stone-400 uppercase">6.2 · Expected future capacity (after support)</p>
              <div className="grid grid-cols-2 gap-2">
                <Input value={d.futureCapacityCrop} onChange={(e) => set("futureCapacityCrop", e.target.value)} placeholder="Crop" />
                <Input type="number" min={0} value={d.futureCapacityKg ?? ""} onChange={(e) => set("futureCapacityKg", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="kg" inputMode="numeric" />
              </div>
            </div>
          </div>

          <Field label="What limits your production currently?" hint="6.3 · multiple">
            <ChipGroup options={PRODUCTION_LIMITS} value={d.productionLimits} onChange={(v) => set("productionLimits", v)} />
          </Field>
        </div>
      )}

      {/* ============ STEP 6 · SECTIONS 7–8, INPUTS & MANAGEMENT ============ */}
      {step === 5 && (
        <div className="space-y-6">
          <Field label="Where do you obtain farm inputs?" hint="7.1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {INPUT_SOURCES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => set("inputSource", o)}
                  className={cx(
                    "touch-target h-12 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                    d.inputSource === o ? "border-forest-700 bg-forest-800 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Do you use improved seed varieties?" hint="7.2">
              <YesNo value={d.usesImprovedSeed} onChange={(v) => set("usesImprovedSeed", v)} />
            </Field>
            <Field label="Do you receive agricultural extension support?" hint="7.3">
              <YesNo value={d.extensionSupport} onChange={(v) => set("extensionSupport", v)} />
            </Field>
          </div>
          {d.extensionSupport && (
            <Field label="From whom?">
              <Input value={d.extensionFrom} onChange={(e) => set("extensionFrom", e.target.value)} placeholder="e.g. NGO, extension officer…" />
            </Field>
          )}

          <Field label="Do you have irrigation?" hint="7.4">
            <YesNo value={d.hasIrrigation} onChange={(v) => set("hasIrrigation", v)} />
          </Field>
          {d.hasIrrigation && (
            <Field label="Type of irrigation" hint="7.4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {IRRIGATION_TYPES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => set("irrigationType", o)}
                    className={cx(
                      "touch-target h-12 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                      d.irrigationType === o ? "border-ochre-500 bg-ochre-500 text-white" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                    )}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Do you keep farming records?" hint="8.1">
              <YesNo value={d.keepsRecords} onChange={(v) => set("keepsRecords", v)} />
            </Field>
            <Field label="Willing to adopt digital farm records?" hint="8.3">
              <YesNo value={d.willingDigitalRecords} onChange={(v) => set("willingDigitalRecords", v)} />
            </Field>
          </div>
          {d.keepsRecords && (
            <Field label="What records do you keep?" hint="8.2 · multiple">
              <ChipGroup options={RECORD_TYPES} value={d.recordTypes} onChange={(v) => set("recordTypes", v)} />
            </Field>
          )}
        </div>
      )}

      {/* ============ STEP 7 · SECTIONS 9–10, MARKET & ROKI ============ */}
      {step === 6 && (
        <div className="space-y-6">
          <Field label="Who do you currently sell to?" hint="9.1 · multiple">
            <ChipGroup options={SELL_TO} value={d.sellTo} onChange={(v) => set("sellTo", v)} />
          </Field>

          <div className="grid gap-5 rounded-2xl border border-stone-200 bg-stone-50/50 p-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[12px] font-bold tracking-wide text-stone-400 uppercase">9.2 · Average selling price</p>
              <div className="grid grid-cols-2 gap-2">
                <Input value={d.avgPriceCrop} onChange={(e) => set("avgPriceCrop", e.target.value)} placeholder="Crop" />
                <Input type="number" min={0} value={d.avgPriceUgx ?? ""} onChange={(e) => set("avgPriceUgx", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="UGX / kg" inputMode="numeric" />
              </div>
            </div>
            <div>
              <p className="mb-2 text-[12px] font-bold tracking-wide text-stone-400 uppercase">9.3 · Selling challenges</p>
              <ChipGroup options={SELLING_CHALLENGES} value={d.sellingChallenges} onChange={(v) => set("sellingChallenges", v)} cols="flex-wrap" />
            </div>
          </div>

          <Field label="Would you like to supply produce to Roki?" required hint="10.1">
            <YesNo value={d.wantsToSupplyRoki} onChange={(v) => set("wantsToSupplyRoki", v)} />
          </Field>
          {d.wantsToSupplyRoki && (
            <Field label="Which crops would you like to supply?" hint="10.2 · multiple">
              <ChipGroup options={SUPPLY_CROPS} value={d.supplyCrops} onChange={(v) => set("supplyCrops", v)} />
            </Field>
          )}

          {d.wantsToSupplyRoki && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-stone-600">Expected production for Roki</p>
                <p className="text-[12px] text-stone-400">10.3 · crop, area planned, harvest period, expected quantity</p>
              </div>
              <div className="space-y-2.5">
                {d.productions.map((p) => (
                  <div key={p.id} className="grid grid-cols-1 items-center gap-2.5 rounded-xl border border-stone-200 bg-white p-3.5 sm:grid-cols-[1fr_100px_120px_120px_1fr_36px]">
                    <Select value={p.crop} onChange={(e) => updateProduction(p.id, { crop: e.target.value })}>
                      {CROPS.map((o) => (
                        <option key={o} value={o} disabled={d.productions.some((x) => x.crop === o && x.id !== p.id)}>{o}</option>
                      ))}
                    </Select>
                    <Input type="number" min={0} step="0.1" value={p.acres || ""} onChange={(e) => updateProduction(p.id, { acres: parseFloat(e.target.value) || 0 })} placeholder="Acres (ac)" inputMode="decimal" />
                    <Select value={p.harvestStartMonth} onChange={(e) => updateProduction(p.id, { harvestStartMonth: parseInt(e.target.value, 10) })}>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </Select>
                    <Select value={p.harvestEndMonth} onChange={(e) => updateProduction(p.id, { harvestEndMonth: parseInt(e.target.value, 10) })}>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </Select>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={0} value={p.expectedVolumeKg || ""} onChange={(e) => updateProduction(p.id, { expectedVolumeKg: parseFloat(e.target.value) || 0 })} placeholder="Quantity (kg)" inputMode="numeric" />
                      <button
                        onClick={() => set("productions", d.productions.filter((x) => x.id !== p.id))}
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addProduction}>
                  <Plus className="h-3.5 w-3.5" /> Add crop to Roki plan
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ STEP 8 · SECTIONS 11–13, CONTRACT, FINANCE, CLIMATE ============ */}
      {step === 7 && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4">
            <p className="mb-3 text-[12px] font-bold tracking-wide text-stone-400 uppercase">Section 11 · Contract farming & commercial agreements</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Produce to Roki specifications?">
                <YesNo value={d.willingRokiSpecs} onChange={(v) => set("willingRokiSpecs", v)} />
              </Field>
              <Field label="Follow export quality standards?">
                <YesNo value={d.willingExportStandards} onChange={(v) => set("willingExportStandards", v)} />
              </Field>
              <Field label="Accept forward purchasing?">
                <YesNo value={d.acceptForwardPurchase} onChange={(v) => set("acceptForwardPurchase", v)} />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4">
            <p className="mb-3 text-[12px] font-bold tracking-wide text-stone-400 uppercase">Section 12 · Financial access</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Have you ever accessed agricultural finance?">
                <YesNo value={d.accessedFinance} onChange={(v) => set("accessedFinance", v)} />
              </Field>
              <Field label="Would you require production financing support?">
                <YesNo value={d.needsFinancing} onChange={(v) => set("needsFinancing", v)} />
              </Field>
            </div>
            {d.accessedFinance && (
              <div className="mt-4">
                <Field label="Source of finance" hint="12.2 · multiple">
                  <ChipGroup options={FINANCE_SOURCES} value={d.financeSources} onChange={(v) => set("financeSources", v)} />
                </Field>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4">
            <p className="mb-3 text-[12px] font-bold tracking-wide text-stone-400 uppercase">Section 13 · Climate change & resilience</p>
            <Field label="Have you experienced climate challenges?" hint="13.1 · multiple">
              <ChipGroup options={CLIMATE_CHALLENGES} value={d.climateChallenges} onChange={(v) => set("climateChallenges", v)} />
            </Field>
            <div className="mt-4">
              <Field label="Willing to adopt climate-smart practices?">
                <YesNo value={d.willingClimateSmart} onChange={(v) => set("willingClimateSmart", v)} />
              </Field>
            </div>
            {d.willingClimateSmart && (
              <div className="mt-4">
                <Field label="Practices of interest" hint="13.2 · multiple">
                  <ChipGroup options={CLIMATE_PRACTICES} value={d.climatePractices} onChange={(v) => set("climatePractices", v)} />
                </Field>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ STEP 9 · SECTIONS 14–15, CONSENT, ASSESSMENT, REVIEW ============ */}
      {step === 8 && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-ochre-200 bg-ochre-50/50 p-4">
            <p className="mb-2 text-[12px] font-bold tracking-wide text-ochre-700 uppercase">Section 14 · Digital platform registration, consent</p>
            <p className="text-[13px] leading-relaxed text-stone-700">
              I agree that Roki may register my farming information in the digital farmer management system to support
              production planning and market linkage.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => set("consent", !d.consent)}
                className={cx(
                  "touch-target inline-flex h-12 items-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-colors",
                  d.consent ? "border-forest-700 bg-forest-800 text-white" : "border-stone-300 bg-white text-stone-600"
                )}
              >
                {d.consent && <Check className="h-4 w-4" />}
                {d.consent ? "Consent given" : "Tap to record consent"}
              </button>
              <Input type="date" value={d.consentDate} onChange={(e) => set("consentDate", e.target.value)} className="h-12 w-44" />
            </div>
          </div>

          {!selfRegistration && (
            <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4">
              <p className="mb-3 text-[12px] font-bold tracking-wide text-stone-400 uppercase">Section 15 · Enumerator observation</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Land availability">
                  <Select value={d.landAvailability} onChange={(e) => set("landAvailability", e.target.value)}>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </Select>
                </Field>
                <Field label="Production potential">
                  <Select value={d.productionPotential} onChange={(e) => set("productionPotential", e.target.value)}>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </Select>
                </Field>
                <Field label="Recommended farmer category">
                  <Select value={d.recommendedCategory} onChange={(e) => set("recommendedCategory", e.target.value)}>
                    {RECOMMENDED_CATEGORIES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {/* review summary */}
          <div className="rounded-2xl border border-stone-200 p-4">
            <p className="mb-3 text-[12px] font-bold tracking-wide text-stone-400 uppercase">Review</p>
            <div className="space-y-2 text-[13.5px]">
              <ReviewRow label="Farmer" value={d.fullName || "N/A"} />
              <ReviewRow label="Phone" value={d.phone ? `${d.phone} · ${GENDER_LABEL[d.gender]}` : "N/A"} />
              <ReviewRow label="Location" value={[d.parish, d.village, d.subCounty, d.district].filter(Boolean).join(", ") || "N/A"} />
              <ReviewRow label="Community" value={REFUGEE_LABEL[d.refugeeStatus]} />
              <ReviewRow label="Land" value={`${LAND_OWNERSHIP_LABEL[d.landOwnership]} · ${d.acreage || 0} ac (${d.cultivatedAcreage || 0} cultivated)`} />
              <ReviewRow label="Experience" value={`${FARMING_YEARS_OPTIONS.find((o) => o.value === d.farmingYears)?.label ?? ""} · ${d.farmingTypes.join(", ") || "N/A"}`} />
              <ReviewRow label="Current crops" value={d.currentCrops.map((c) => c.crop).join(", ") || "N/A"} />
              <ReviewRow label="Roki production plan" value={d.productions.length === 0 ? "N/A" : `${d.productions.length} crops · ${totalPlanAcres.toFixed(1)} ac · ≈ ${(totalPlanKg / 1000).toFixed(1)} t`} />
            </div>
            <div className="mt-4 rounded-xl bg-ochre-50 px-3.5 py-3">
              <p className="text-[11px] font-bold tracking-wide text-ochre-700 uppercase">Roki farmer scoring</p>
              <p className="mt-0.5 font-display text-lg font-semibold text-forest-900">
                {existing ? ROKI_TIER_LABEL[existing.rokiTier] : ROKI_TIER_LABEL[tierPreview]}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-stone-600">
                {existing
                  ? rokiTierCriteria(existing.rokiTier)
                  : "Assigned by the rule engine from acreage, harvest activity and Grade-A volume, recalculated as harvests are logged."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* errors */}
      {tried && currentErrors.length > 0 && (
        <div className="space-y-1 rounded-xl bg-danger-bg px-4 py-3">
          {currentErrors.map((e, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[13px] font-semibold text-danger-dark">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e}
            </p>
          ))}
        </div>
      )}

      {/* nav */}
      <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-4">
        <Button variant="outline" onClick={back}>
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
        </Button>
        <Button variant={step === STEPS.length - 1 ? "accent" : "primary"} size="lg" onClick={next}>
          {step === STEPS.length - 1 ? (
            <>
              <Check className="h-4 w-4" /> {existing ? "Save survey" : "Complete registration"}
            </>
          ) : (
            <>
              Next <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-left hover:bg-stone-50"
    >
      <span className="text-[13px] font-semibold text-stone-700">{label}</span>
      <span className={cx("relative h-6 w-10 shrink-0 rounded-full transition-colors", value ? "bg-forest-700" : "bg-stone-300")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", value ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-2">
      <span className="shrink-0 text-[11px] font-bold tracking-wide text-stone-400 uppercase">{label}</span>
      <span className="text-right text-[13px] font-semibold text-stone-700">{value}</span>
    </div>
  );
}

function ageGroupOf(years?: number): AgeGroup {
  if (!years) return "36-45";
  if (years <= 25) return "18-25";
  if (years <= 35) return "26-35";
  if (years <= 45) return "36-45";
  if (years <= 60) return "46-60";
  return "60+";
}

function landOwnershipOf(o: LandOwnership, other: string): LandOwnership {
  if (o === "OTHER" && other.trim()) return "OTHER";
  return o;
}

// keep IRRIGATION_OPTIONS import referenced (types re-export)
void IRRIGATION_OPTIONS;

/** Link the signed-in account to the farmer record they just created. */
async function linkAccountToFarmer(farmerId: string) {
  try {
    const { getSession, updateProfileRole } = await import("@/lib/remote");
    const session = await getSession();
    if (session?.user) {
      await updateProfileRole(session.user.id, "FARMER", farmerId);
    }
  } catch {
    /* preview mode or offline: local link is enough for now */
  }
}
