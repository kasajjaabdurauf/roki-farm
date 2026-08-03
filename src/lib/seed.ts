// ------------------------------------------------------------------
// Demo seed data, 36 farmers across 24 districts, ~250 harvest logs,
// full survey answers (gender, refugee status, land ownership, age,
// production plans) and intentional anomalies/duplicates so the rule
// engine has real findings. Deterministic (seeded RNG).
// ------------------------------------------------------------------

import type {
  Db,
  Farmer,
  FarmerSurvey,
  Gender,
  PlannedProduction,
  ProduceLog,
  QualityGrade,
  RefugeeStatus,
} from "./types";
import {
  CLIMATE_CHALLENGES,
  CLIMATE_PRACTICES,
  DEFAULT_SURVEY,
  FARMING_TYPES,
  FINANCE_SOURCES,
  INPUT_SOURCES,
  PRODUCTION_LIMITS,
  RECORD_TYPES,
  REFUGEE_ORIGINS,
  SALES_CHANNELS,
  SELLING_CHALLENGES,
  SELL_TO,
  SUPPLY_CROPS,
} from "./types";
import { CROP_DEFAULTS, CROP_HARVEST_WINDOW, DEFAULT_SETTINGS_RULES } from "./reference";
import { computeRokiTier, evaluateLog } from "./rules";
import { MONTHS } from "./reference";

/** mulberry32, tiny deterministic PRNG */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SeedFarmer {
  name: string;
  district: string;
  subCounty: string;
  village: string;
  acres: number;
  crops: string[];
  noPhone?: boolean;
  refugee?: boolean;
  female?: boolean;
}

const SEED_FARMERS: SeedFarmer[] = [
  { name: "Aisha Namukwaya", district: "Wakiso", subCounty: "Nansana", village: "Busukuma", acres: 1.5, crops: ["Tomato", "Onion", "Bananas"], female: true },
  { name: "John Bosco Okello", district: "Gulu", subCounty: "Pece", village: "Laroo", acres: 3.2, crops: ["Maize", "Groundnuts", "Millet"] },
  { name: "Grace Achieng", district: "Lira", subCounty: "Erute", village: "Barapwo", acres: 2.0, crops: ["Onion", "Millet", "Groundnuts"], female: true, refugee: true },
  { name: "Moses Ssemanda", district: "Mukono", subCounty: "Nama", village: "Nakyesanja", acres: 4.5, crops: ["Tomato", "Cabbage", "Maize"] },
  { name: "Sarah Nakanwagi", district: "Kampala", subCounty: "Nakawa", village: "Kyambogo", acres: 0.8, crops: ["Vegetables"], noPhone: true, female: true },
  { name: "Peter Odongo", district: "Soroti", subCounty: "Arapai", village: "Awoja", acres: 6.0, crops: ["Maize", "Groundnuts", "Millet"] },
  { name: "Joyce Auma", district: "Gulu", subCounty: "Bardege", village: "Unyama", acres: 2.5, crops: ["Sweet Potatoes", "Cassava", "Beans"], female: true, refugee: true },
  { name: "Robert Mugisha", district: "Mbarara", subCounty: "Kashari", village: "Kashongore", acres: 12.0, crops: ["Bananas", "Coffee", "Maize"] },
  { name: "Agnes Kobusingye", district: "Bushenyi", subCounty: "Igara", village: "Kyabugimbi", acres: 3.0, crops: ["Coffee", "Bananas", "Beans"], female: true },
  { name: "Daniel Opio", district: "Lira", subCounty: "Amach", village: "Aromo", acres: 1.2, crops: ["Cassava", "Millet"] },
  { name: "Betty Amongin", district: "Iganga", subCounty: "Nakalama", village: "Bukoyo", acres: 5.0, crops: ["Rice", "Maize", "Beans"], female: true },
  { name: "Charles Byaruhanga", district: "Ntungamo", subCounty: "Ruhaama", village: "Rukoni", acres: 8.0, crops: ["Bananas", "Coffee", "Beans"] },
  { name: "Florence Namatovu", district: "Kayunga", subCounty: "Kangulumira", village: "Busagazi", acres: 2.2, crops: ["Cassava", "Maize", "Groundnuts"], female: true },
  { name: "George Ochen", district: "Arua", subCounty: "Ayivu", village: "Oli", acres: 7.5, crops: ["Cassava", "Millet", "Groundnuts"], refugee: true },
  { name: "Harriet Kemigisha", district: "Kabale", subCounty: "Ndorwa", village: "Maziba", acres: 1.8, crops: ["Irish Potatoes", "Beans", "Maize"], female: true },
  { name: "Isaac Tumusiime", district: "Mbarara", subCounty: "Rubindi", village: "Rwampara", acres: 25.0, crops: ["Bananas", "Coffee", "Maize"] },
  { name: "Janet Namuddu", district: "Luwero", subCounty: "Nyimbwa", village: "Katikamu", acres: 3.5, crops: ["Tomato", "Beans", "Coffee"], female: true },
  { name: "Joseph Kato", district: "Masaka", subCounty: "Kyanamukaaka", village: "Kyamulibwa", acres: 4.0, crops: ["Coffee", "Bananas", "Maize"] },
  { name: "Kevin Mukasa", district: "Wakiso", subCounty: "Kira", village: "Namugongo", acres: 1.0, crops: ["Vegetables", "Maize"] },
  { name: "Linda Apio", district: "Gulu", subCounty: "Layibi", village: "Bardege", acres: 2.8, crops: ["Sorghum", "Groundnuts", "Cassava"], female: true, refugee: true },
  { name: "Mary Nakato", district: "Mubende", subCounty: "Bagezza", village: "Kiyuni", acres: 9.0, crops: ["Coffee", "Bananas", "Maize"], noPhone: true, female: true },
  { name: "Patrick Okwir", district: "Soroti", subCounty: "Asuret", village: "Katine", acres: 15.0, crops: ["Maize", "Millet", "Groundnuts"] },
  { name: "Rebecca Nabirye", district: "Jinja", subCounty: "Butembe", village: "Mafubira", acres: 2.4, crops: ["Tomato", "Cabbage", "Cassava"], female: true },
  { name: "Samuel Wamala", district: "Mukono", subCounty: "Kasawo", village: "Seeta", acres: 6.5, crops: ["Coffee", "Bananas"] },
  { name: "Tracy Anying", district: "Kasese", subCounty: "Busongora", village: "Kilembe", acres: 3.0, crops: ["Tomato", "Bananas", "Beans"], female: true, refugee: true },
  { name: "Vincent Ouma", district: "Lira", subCounty: "Barapwo", village: "Ogur", acres: 4.4, crops: ["Maize", "Groundnuts"] },
  { name: "Winnie Nakimuli", district: "Wakiso", subCounty: "Entebbe", village: "Kigungu", acres: 1.6, crops: ["Bananas", "Vegetables"], female: true },
  { name: "Yusuf Kiggundu", district: "Masaka", subCounty: "Bukakata", village: "Kasanje", acres: 5.5, crops: ["Coffee", "Cassava", "Maize"] },
  { name: "Zainab Nalwoga", district: "Kampala", subCounty: "Rubaga", village: "Lubaga", acres: 0.5, crops: ["Vegetables"], female: true },
  { name: "Dennis Ayesiga", district: "Rukungiri", subCounty: "Rubabo", village: "Nyakagyeme", acres: 3.8, crops: ["Coffee", "Bananas"] },
  { name: "Catherine Nankya", district: "Luwero", subCounty: "Bamunanika", village: "Zirobwe", acres: 2.6, crops: ["Tomato", "Onion"], female: true },
  { name: "Fred Kyazze", district: "Hoima", subCounty: "Bujenje", village: "Kigorobya", acres: 18.0, crops: ["Maize", "Cassava", "Sugarcane"] },
  { name: "Gloria Namugga", district: "Mukono", subCounty: "Nakifuma", village: "Nagojje", acres: 1.2, crops: ["Maize", "Beans"], noPhone: true, female: true },
  { name: "Henry Kirumira", district: "Mubende", subCounty: "Kasambya", village: "Butoloogo", acres: 30.0, crops: ["Coffee", "Bananas", "Maize"] },
  { name: "Irene Nabukenya", district: "Mbale", subCounty: "Bungokho", village: "Bumasifwa", acres: 2.9, crops: ["Onion", "Beans", "Maize"], female: true },
  { name: "James Mpanga", district: "Tororo", subCounty: "West Budama", village: "Nagongera", acres: 11.0, crops: ["Maize", "Rice", "Cassava"] },
];

/** Per-crop realistic per-acre ranges (kg/ac) for the seed generator. */
const PER_ACRE_RANGE: Record<string, [number, number]> = {
  Tomato: [3000, 9000],
  Onion: [2500, 6000],
  Cabbage: [3000, 9000],
  Carrots: [2500, 7000],
  Watermelon: [5000, 14000],
  Eggplant: [2500, 7000],
  "Passion Fruit": [1500, 5000],
  "Chilli Pepper": [1200, 4000],
  Coffee: [350, 1050],
  Maize: [700, 2200],
  Beans: [250, 800],
  Cassava: [2500, 6500],
  Bananas: [3500, 8500],
  Groundnuts: [300, 950],
  Millet: [350, 850],
  Rice: [900, 1800],
  Sorghum: [300, 900],
  "Sweet Potatoes": [2500, 6500],
  "Irish Potatoes": [2500, 6000],
  Soybean: [400, 1100],
  Sunflower: [400, 1000],
  Sugarcane: [15000, 30000],
  Vegetables: [2500, 5500],
};

const STORAGE = [
  "Roki Hub, Entebbe Road",
  "Kawempe Collection Centre",
  "Nakasero Market Depot",
  "Kisenyi Warehouse",
  "Village aggregation point",
  "Farm store",
];

const PHONE_PREFIXES = ["77", "78", "76", "70", "75", "74"];
const AGE_GROUPS = ["18-25", "26-35", "36-45", "46-60", "60+"] as const;

export function buildSeed(): Db {
  const rng = mulberry32(20260803);
  const now = Date.now();

  const farmers: Farmer[] = [];
  const logs: ProduceLog[] = [];

  for (let i = 0; i < SEED_FARMERS.length; i++) {
    const s = SEED_FARMERS[i];
    let phone = "";
    if (!s.noPhone) {
      const prefix = PHONE_PREFIXES[Math.floor(rng() * PHONE_PREFIXES.length)];
      const tail = Array.from({ length: 7 }, () => Math.floor(rng() * 10)).join("");
      phone = `+256${prefix}${tail}`;
    }
    const registeredDaysAgo = 180 + Math.floor(rng() * 320);

    // --- production plan from the survey ---------------------------------
    const plannedProductions: PlannedProduction[] = [];
    const planCrops = s.crops.slice(0, rng() < 0.5 ? 2 : 3);
    for (const crop of planCrops) {
      const acres = Math.max(0.25, +(s.acres * (0.28 + rng() * 0.22)).toFixed(2));
      const typical = CROP_DEFAULTS[crop]?.typicalPerAcreKg ?? 2500;
      const window = CROP_HARVEST_WINDOW[crop] ?? [1, 12];
      let start = window[0];
      let end = window[1];
      if (window[1] !== 12 || window[0] !== 1) {
        start = 1 + Math.floor(rng() * 12);
        end = Math.min(12, start + 1 + Math.floor(rng() * 2));
        if (end > 12) end = 12;
      }
      plannedProductions.push({
        id: `PP-${i + 1}-${crop.slice(0, 4).toUpperCase()}`,
        crop,
        acres,
        expectedVolumeKg: Math.round(acres * typical * (0.75 + rng() * 0.5)),
        harvestStartMonth: start,
        harvestEndMonth: end,
      });
    }

    // --- full questionnaire (15 sections) -----------------------------
    const isRefugee = s.refugee || rng() < 0.08;
    const survey: FarmerSurvey = {
      ...DEFAULT_SURVEY,
      enumeratorName: "Roki Field Team",
      enumeratorId: `EN-${100 + i}`,
      ageYears: 24 + Math.floor(rng() * 35),
      altPhone: rng() < 0.4 ? `+2567${PHONE_PREFIXES[Math.floor(rng() * PHONE_PREFIXES.length)]}${Array.from({ length: 7 }, () => Math.floor(rng() * 10)).join("")}` : undefined,
      parish: s.village,
      countryOfOrigin: isRefugee ? REFUGEE_ORIGINS[Math.floor(rng() * (REFUGEE_ORIGINS.length - 1))] : undefined,
      yearArrivedUganda: isRefugee ? 2013 + Math.floor(rng() * 10) : undefined,
      refugeeSettlement: isRefugee ? "Nakivale Refugee Settlement" : undefined,
      refugeeHouseholdNo: isRefugee ? `RH-${10000 + Math.floor(rng() * 89999)}` : undefined,
      householdAdults: 2 + Math.floor(rng() * 4),
      householdChildren: Math.floor(rng() * 5),
      femaleHeaded: genderRoll(s, rng),
      youthFarmer: true,
      personWithDisability: rng() < 0.06,
      elderlyFarmer: rng() < 0.1,
      farmingYears: (["LESS_1", "Y1_5", "Y6_10", "OVER_10"] as const)[Math.floor(rng() * 4)],
      farmingTypes: pickSome(FARMING_TYPES, 1 + Math.floor(rng() * 2), rng),
      previousCrops: s.crops.slice(0, 2).map((c) => ({
        crop: c,
        yearsProduced: 1 + Math.floor(rng() * 8),
        avgAreaAcres: +(0.5 + rng() * 2).toFixed(1),
      })),
      soldCommercially: rng() < 0.6,
      salesChannels: pickSome(SALES_CHANNELS, 1 + Math.floor(rng() * 2), rng),
      hasLandAccess: true,
      cultivatedAcreage: +Math.min(s.acres, s.acres * (0.5 + rng() * 0.5)).toFixed(1),
      expansionAvailable: rng() < 0.45,
      expansionAcreage: rng() < 0.45 ? +(0.5 + rng() * 2).toFixed(1) : undefined,
      currentCrops: s.crops.slice(0, 3).map((crop) => ({
        crop,
        areaAcres: +(0.25 + rng() * 1.5).toFixed(2),
        expectedHarvestDate: new Date(now + (30 + Math.floor(rng() * 150)) * 86400000).toISOString().slice(0, 10),
        expectedQtyKg: Math.round((200 + rng() * 3000) * (CROP_DEFAULTS[crop]?.typicalPerAcreKg ?? 1000) / 1000),
      })),
      productionSeason: (["FIRST", "SECOND", "YEAR_ROUND"] as const)[Math.floor(rng() * 3)],
      productionSystem: rng() < 0.75 ? "OPEN_FIELD" : rng() < 0.9 ? "IRRIGATED" : "GREENHOUSE",
      currentCapacityCrop: s.crops[0],
      currentCapacityKg: 500 + Math.floor(rng() * 4000),
      futureCapacityCrop: s.crops[0],
      futureCapacityKg: 1500 + Math.floor(rng() * 6000),
      productionLimits: pickSome(PRODUCTION_LIMITS, 2 + Math.floor(rng() * 3), rng),
      inputSource: INPUT_SOURCES[Math.floor(rng() * INPUT_SOURCES.length)],
      usesImprovedSeed: rng() < 0.5,
      extensionSupport: rng() < 0.45,
      extensionFrom: rng() < 0.45 ? "NGO programme" : undefined,
      hasIrrigation: rng() < 0.3,
      irrigationType: rng() < 0.3 ? "DRIP" : "SPRINKLER",
      keepsRecords: rng() < 0.4,
      recordTypes: pickSome(RECORD_TYPES, 1 + Math.floor(rng() * 2), rng),
      willingDigitalRecords: rng() < 0.85,
      sellTo: pickSome(SELL_TO, 1 + Math.floor(rng() * 2), rng),
      avgPriceCrop: s.crops[0],
      avgPriceUgx: 500 + Math.floor(rng() * 4000),
      sellingChallenges: pickSome(SELLING_CHALLENGES, 1 + Math.floor(rng() * 2), rng),
      wantsToSupplyRoki: rng() < 0.85,
      supplyCrops: pickSome(SUPPLY_CROPS, 1 + Math.floor(rng() * 3), rng),
      willingRokiSpecs: rng() < 0.8,
      willingExportStandards: rng() < 0.75,
      acceptForwardPurchase: rng() < 0.65,
      accessedFinance: rng() < 0.35,
      financeSources: pickSome(FINANCE_SOURCES, 1 + Math.floor(rng() * 2), rng),
      needsFinancing: rng() < 0.7,
      climateChallenges: pickSome(CLIMATE_CHALLENGES, 1 + Math.floor(rng() * 3), rng),
      willingClimateSmart: rng() < 0.8,
      climatePractices: pickSome(CLIMATE_PRACTICES, 1 + Math.floor(rng() * 3), rng),
      consent: true,
      consentDate: new Date(now - registeredDaysAgo * 86400000).toISOString().slice(0, 10),
      landAvailability: (["HIGH", "MEDIUM", "LOW"] as const)[Math.floor(rng() * 3)],
      productionPotential: (["HIGH", "MEDIUM", "LOW"] as const)[Math.floor(rng() * 3)],
      recommendedCategory: (["COMMERCIAL", "EMERGING", "BEGINNER"] as const)[Math.floor(rng() * 3)],
    };

    const gender: Gender = s.female ? "F" : rng() < 0.08 ? "F" : "M";
    const refugeeStatus: RefugeeStatus = isRefugee ? "REFUGEE" : rng() < 0.6 ? "HOST" : "NONE";
    const landOwnership = rng() < 0.55 ? "OWN" : rng() < 0.72 ? "FAMILY" : rng() < 0.88 ? "RENTED" : "ALLOCATED";

    const farmer: Farmer = {
      id: `RFV-UG-${String(i + 1).padStart(5, "0")}`,
      fullName: s.name,
      phone,
      district: s.district,
      subCounty: s.subCounty,
      village: s.village,
      acreage: s.acres,
      primaryCrops: [...s.crops],
      irrigationType: rng() < 0.7 ? "NONE" : rng() < 0.85 ? "DRIP" : rng() < 0.95 ? "SPRINKLER" : "PUMP",
      scaleTier: s.acres < 2 ? "MICRO" : s.acres <= 10 ? "MID_SCALE" : "LARGE_SCALE",
      rokiTier: 3,
      gender,
      refugeeStatus,
      ageGroup: AGE_GROUPS[Math.floor(rng() * AGE_GROUPS.length)],
      landOwnership,
      householdSize: 2 + Math.floor(rng() * 8),
      plannedProductions,
      survey,
      flags: [],
      createdAt: new Date(now - registeredDaysAgo * 86400000).toISOString(),
      updatedAt: new Date(now - registeredDaysAgo * 86400000).toISOString(),
    };
    if (!phone) farmer.flags = ["INCOMPLETE_PROFILE"];
    farmers.push(farmer);

    // --- harvest logs ------------------------------------------------------
    const nLogs = 3 + Math.floor(rng() * 8);
    for (let j = 0; j < nLogs; j++) {
      const crop = s.crops[Math.floor(rng() * s.crops.length)];
      const range = PER_ACRE_RANGE[crop] ?? [300, 1500];
      const perAcre = range[0] + rng() * (range[1] - range[0]);
      let qty = s.acres * perAcre * (0.55 + rng() * 0.75);

      // intentional anomaly (breaches the max-per-acre ceiling)
      const anomaly = rng() < 0.055;
      if (anomaly) qty = s.acres * perAcre * (3.4 + rng() * 2.2);

      const daysAgo = Math.floor(rng() * 85);
      const createdAt = new Date(now - daysAgo * 86400000 - Math.floor(rng() * 20) * 3600000).toISOString();
      const harvestOffset = 1 + Math.floor(rng() * 12);
      const harvestDate = new Date(now - (daysAgo + harvestOffset) * 86400000).toISOString().slice(0, 10);

      const g = rng();
      const grade: QualityGrade = g < 0.55 ? "A" : g < 0.92 ? "B" : "REJECT";
      const srcRoll = rng();
      const source = srcRoll < 0.45 ? "FIELD_AGENT" : srcRoll < 0.75 ? "FARMER" : srcRoll < 0.85 ? "ADMIN" : "BULK_IMPORT";

      logs.push({
        id: `RFV-LOG-${String(logs.length + 1).padStart(5, "0")}`,
        farmerId: farmer.id,
        cropType: crop,
        quantityKg: Math.round(qty),
        qualityGrade: grade,
        harvestDate,
        batchId: rng() < 0.8 ? `B-${harvestDate.replace(/-/g, "")}-${100 + Math.floor(rng() * 900)}` : undefined,
        storageLocation: STORAGE[Math.floor(rng() * STORAGE.length)],
        status: "VERIFIED",
        auditNotes: [],
        yieldScore: "EXPECTED",
        source,
        createdAt,
      });
    }
  }

  // --- intentional duplicate pairs (same farmer + crop + date, < 24 h apart)
  const dupTargets = [0, 8, 27];
  for (const ti of dupTargets) {
    const farmer = farmers[ti];
    const crop = farmer.primaryCrops[Math.floor(rng() * farmer.primaryCrops.length)];
    const base = logs.filter((l) => l.farmerId === farmer.id && l.cropType === crop);
    if (base.length === 0) continue;
    const original = base[Math.floor(rng() * base.length)];
    const dupAt = new Date(new Date(original.createdAt).getTime() + (1 + Math.floor(rng() * 20)) * 3600000).toISOString();
    logs.push({
      id: `RFV-LOG-${String(logs.length + 1).padStart(5, "0")}`,
      farmerId: farmer.id,
      cropType: crop,
      quantityKg: Math.round(original.quantityKg * (0.9 + rng() * 0.2)),
      qualityGrade: original.qualityGrade,
      harvestDate: original.harvestDate,
      batchId: original.batchId,
      storageLocation: original.storageLocation,
      status: "VERIFIED",
      auditNotes: [],
      yieldScore: "EXPECTED",
      source: "FIELD_AGENT",
      createdAt: dupAt,
    });
  }

  // --- run the rule engine over every log --------------------------------
  const settings = { rules: { ...DEFAULT_SETTINGS_RULES }, crops: { ...CROP_DEFAULTS } };
  for (const log of logs) {
    const farmer = farmers.find((f) => f.id === log.farmerId);
    const ev = evaluateLog(log, farmer, logs, settings);
    log.status = ev.status;
    log.auditNotes = ev.auditNotes;
    log.yieldScore = ev.yieldScore;
  }

  // --- Roki scoring (tiers depend on log history) -------------------------
  for (const farmer of farmers) {
    farmer.rokiTier = computeRokiTier(farmer, logs);
  }

  return {
    farmers,
    logs,
    settings,
    meta: {
      nextFarmerSeq: farmers.length + 1,
      nextLogSeq: logs.length + 1,
      outbox: [],
      role: "ADMIN",
      demoFarmerId: farmers[0]?.id ?? "",
      seededAt: new Date(now).toISOString(),
    },
  };
}

function pickSome<T>(arr: readonly T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}

function genderRoll(s: { refugee?: boolean }, rng: () => number): boolean {
  // female-headed households are more common among refugees
  return s.refugee ? rng() < 0.35 : rng() < 0.2;
}
