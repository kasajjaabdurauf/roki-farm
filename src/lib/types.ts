// ------------------------------------------------------------------
// Roki Fruit & Vegetables, core data models (TypeScript)
// ------------------------------------------------------------------

export type ScaleTier = "MICRO" | "MID_SCALE" | "LARGE_SCALE";
export type RokiTier = 1 | 2 | 3; // 1 = Export-ready, 2 = Developing commercial, 3 = New (needs support)
export type LogStatus = "VERIFIED" | "NEEDS_AUDIT" | "FLAGGED";
export type QualityGrade = "A" | "B" | "REJECT";
export type YieldScore = "LOW" | "EXPECTED" | "BUMPER";
export type Role = "ADMIN" | "FIELD_AGENT" | "FARMER";
export type Carrier = "MTN" | "AIRTEL" | "OTHER";
export type IrrigationType = "NONE" | "DRIP" | "SPRINKLER" | "PUMP" | "OTHER";
export type LogSource = "FIELD_AGENT" | "FARMER" | "ADMIN" | "BULK_IMPORT";

export type Gender = "M" | "F" | "OTHER";
export type RefugeeStatus = "REFUGEE" | "HOST" | "NONE"; // host = host-community farmer
export type AgeGroup = "18-25" | "26-35" | "36-45" | "46-60" | "60+";
export type LandOwnership = "OWN" | "FAMILY" | "RENTED" | "ALLOCATED" | "OTHER";

export type FarmerFlag = "INCOMPLETE_PROFILE" | "PHONE_UNREACHABLE";

export interface PlannedProduction {
  id: string;
  crop: string;
  acres: number; // acres allocated to this crop
  expectedVolumeKg: number; // expected harvest volume
  harvestStartMonth: number; // 1-12
  harvestEndMonth: number; // 1-12
}

// ------------------------------------------------------------------
// Full farmer registration questionnaire (15 sections), mirrors the
// official Roki "Digital Farmer Registration, Profiling and Production
// Planning Questionnaire".
// ------------------------------------------------------------------
export interface FarmerSurvey {
  // --- Section 1 · Identification & bio-data -------------------------
  enumeratorName: string;
  enumeratorId: string;
  ageYears?: number;
  altPhone?: string;
  parish?: string;
  gpsLat?: number;
  gpsLon?: number;
  // --- Section 2 · Refugee / host community status -------------------
  countryOfOrigin?: string;
  yearArrivedUganda?: number;
  refugeeSettlement?: string;
  refugeeHouseholdNo?: string;
  householdAdults?: number;
  householdChildren?: number;
  femaleHeaded: boolean;
  youthFarmer: boolean;
  personWithDisability: boolean;
  elderlyFarmer: boolean;
  // --- Section 3 · Farming experience & history ----------------------
  farmingYears: string; // LESS_1 | Y1_5 | Y6_10 | OVER_10
  farmingTypes: string[];
  previousCrops: { crop: string; yearsProduced?: number; avgAreaAcres?: number }[];
  soldCommercially: boolean;
  salesChannels: string[];
  // --- Section 4 · Land & farm assets --------------------------------
  hasLandAccess: boolean;
  landOwnershipOther?: string;
  cultivatedAcreage: number;
  expansionAvailable: boolean;
  expansionAcreage?: number;
  // --- Section 5 · Current farming activities ------------------------
  currentCrops: { crop: string; areaAcres: number; expectedHarvestDate: string; expectedQtyKg: number }[];
  productionSeason: string; // FIRST | SECOND | YEAR_ROUND
  productionSystem: string; // OPEN_FIELD | GREENHOUSE | IRRIGATED | RAIN_FED
  // --- Section 6 · Production capacity assessment --------------------
  currentCapacityCrop?: string;
  currentCapacityKg?: number;
  futureCapacityCrop?: string;
  futureCapacityKg?: number;
  productionLimits: string[];
  // --- Section 7 · Farm inputs & technology --------------------------
  inputSource: string; // LOCAL_SHOPS | NGO | FARMER_GROUPS | COMPANIES | OTHER
  usesImprovedSeed: boolean;
  extensionSupport: boolean;
  extensionFrom?: string;
  hasIrrigation: boolean;
  irrigationType?: string; // DRIP | SPRINKLER | PUMP | OTHER
  // --- Section 8 · Farm management practices -------------------------
  keepsRecords: boolean;
  recordTypes: string[];
  willingDigitalRecords: boolean;
  // --- Section 9 · Market information & sales history ----------------
  sellTo: string[];
  avgPriceCrop?: string;
  avgPriceUgx?: number;
  sellingChallenges: string[];
  // --- Section 10 · Interest in working with Roki --------------------
  wantsToSupplyRoki: boolean;
  supplyCrops: string[];
  // --- Section 11 · Contract farming & agreements --------------------
  willingRokiSpecs: boolean;
  willingExportStandards: boolean;
  acceptForwardPurchase: boolean;
  // --- Section 12 · Financial access ---------------------------------
  accessedFinance: boolean;
  financeSources: string[];
  needsFinancing: boolean;
  // --- Section 13 · Climate change & resilience ----------------------
  climateChallenges: string[];
  willingClimateSmart: boolean;
  climatePractices: string[];
  // --- Section 14 · Digital platform registration (consent) ----------
  consent: boolean;
  consentDate?: string;
  // --- Section 15 · Enumerator observation ---------------------------
  landAvailability: string; // HIGH | MEDIUM | LOW
  productionPotential: string; // HIGH | MEDIUM | LOW
  recommendedCategory: string; // COMMERCIAL | EMERGING | BEGINNER
}

export interface Farmer {
  id: string; // RFV-UG-XXXXX
  fullName: string;
  phone: string; // normalized +2567XXXXXXXX
  nin?: string; // National ID (optional)
  district: string;
  subCounty: string;
  village?: string;
  acreage: number; // total acres
  primaryCrops: string[];
  irrigationType: IrrigationType;
  scaleTier: ScaleTier; // farm-size tag (rule engine)
  rokiTier: RokiTier; // export-readiness score (rule engine)
  // --- survey answers (farmer registration questionnaire) ---
  gender: Gender;
  refugeeStatus: RefugeeStatus;
  ageGroup: AgeGroup;
  landOwnership: LandOwnership;
  householdSize?: number;
  plannedProductions: PlannedProduction[];
  survey?: FarmerSurvey; // full questionnaire record
  // --- rule engine findings ---
  flags: FarmerFlag[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface ProduceLog {
  id: string; // RFV-LOG-XXXXX
  farmerId: string;
  cropType: string;
  quantityKg: number;
  qualityGrade: QualityGrade;
  harvestDate: string; // YYYY-MM-DD
  batchId?: string;
  storageLocation?: string;
  status: LogStatus; // computed by rule engine
  auditNotes: string[]; // rule engine flags stored here
  yieldScore: YieldScore; // computed by rule engine
  source: LogSource;
  createdAt: string; // ISO
}

export interface CropDefaults {
  maxPerAcreKg: number; // anomaly ceiling (yield > acreage × max → Needs Audit)
  typicalPerAcreKg: number; // baseline for Low / Expected / Bumper scoring
}

export interface RuleSettings {
  anomalyDetection: boolean;
  duplicateGuard: boolean;
  incompleteProfile: boolean;
  yieldScoring: boolean;
}

export interface Settings {
  rules: RuleSettings;
  crops: Record<string, CropDefaults>;
}

export type OutboxOp =
  | { kind: "CREATE_FARMER"; farmer: Farmer }
  | { kind: "UPDATE_FARMER"; farmer: Farmer }
  | { kind: "DELETE_FARMERS"; ids: string[] }
  | { kind: "CREATE_LOG"; log: ProduceLog }
  | { kind: "UPDATE_LOG"; log: ProduceLog }
  | { kind: "DELETE_LOGS"; ids: string[] };

export interface DbMeta {
  nextFarmerSeq: number;
  nextLogSeq: number;
  outbox: OutboxOp[];
  role: Role;
  demoFarmerId: string;
  seededAt: string;
}

export interface Db {
  farmers: Farmer[];
  logs: ProduceLog[];
  settings: Settings;
  meta: DbMeta;
}

// ------------------------------------------------------------------
// Staging (bulk upload) models
// ------------------------------------------------------------------

export type StageField =
  | "fullName"
  | "phone"
  | "nin"
  | "farmerId"
  | "district"
  | "subCounty"
  | "village"
  | "acreage"
  | "crops"
  | "cropType"
  | "harvestDate"
  | "quantityKg"
  | "qualityGrade"
  | "batchId"
  | "storageLocation"
  | "gender"
  | "refugeeStatus"
  | "ignore";

export interface ColumnMapping {
  sourceIndex: number;
  sourceHeader: string;
  target: StageField; // auto-detected target
  autoDetected: boolean;
  unit?: "KG" | "BAG" | "CRATE" | "TONNE"; // for quantity columns
  areaUnit?: "ACRES" | "HECTARES"; // for acreage columns
}

export interface StagingRow {
  key: string; // row key for React
  rowIndex: number; // 1-based spreadsheet row number (for display)
  cells: Record<string, string>; // sourceColumn -> raw string
  parsed: Record<string, string | number | boolean | undefined>;
  farmerId?: string; // resolved existing farmer (by ID or phone)
  farmerName?: string;
  resolveNote?: string;
  errors: string[];
  warnings: string[];
  isLogRow: boolean; // row carries produce data → creates a log
}

export interface StagingState {
  fileName: string;
  sheetName: string;
  columns: ColumnMapping[];
  rows: StagingRow[];
  headers: string[];
}

export const UNIT_FACTORS: Record<"KG" | "BAG" | "CRATE" | "TONNE", number> = {
  KG: 1,
  BAG: 100, // common grain bag ≈ 100 kg
  CRATE: 20, // banana crate ≈ 20 kg
  TONNE: 1000,
};

export const IRRIGATION_OPTIONS: { value: IrrigationType; label: string }[] = [
  { value: "NONE", label: "No irrigation" },
  { value: "DRIP", label: "Drip irrigation" },
  { value: "SPRINKLER", label: "Sprinkler" },
  { value: "PUMP", label: "Pump irrigation" },
  { value: "OTHER", label: "Other" },
];

export const CARRIER_LABEL: Record<Carrier, string> = {
  MTN: "MTN Uganda",
  AIRTEL: "Airtel Uganda",
  OTHER: "Other carrier",
};

export const TIER_LABEL: Record<ScaleTier, string> = {
  MICRO: "Micro",
  MID_SCALE: "Mid-Scale",
  LARGE_SCALE: "Large-Scale",
};

export const ROKI_TIER_LABEL: Record<RokiTier, string> = {
  1: "Tier 1 · Export-ready",
  2: "Tier 2 · Developing commercial",
  3: "Tier 3 · New, needs support",
};

export const STATUS_LABEL: Record<LogStatus, string> = {
  VERIFIED: "Verified",
  NEEDS_AUDIT: "Needs Audit",
  FLAGGED: "Flagged",
};

export const GRADE_LABEL: Record<QualityGrade, string> = {
  A: "Grade A",
  B: "Grade B",
  REJECT: "Reject",
};

export const YIELD_LABEL: Record<YieldScore, string> = {
  LOW: "Low",
  EXPECTED: "Expected",
  BUMPER: "Bumper",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin / Roki",
  FIELD_AGENT: "Field Agent",
  FARMER: "Farmer",
};

export const GENDER_LABEL: Record<Gender, string> = {
  M: "Male",
  F: "Female",
  OTHER: "Other",
};

export const REFUGEE_LABEL: Record<RefugeeStatus, string> = {
  REFUGEE: "Refugee",
  HOST: "Host community",
  NONE: "N/A",
};

export const AGE_GROUPS: AgeGroup[] = ["18-25", "26-35", "36-45", "46-60", "60+"];

export const LAND_OWNERSHIP_LABEL: Record<LandOwnership, string> = {
  OWN: "Own land",
  FAMILY: "Family land",
  RENTED: "Rented land",
  ALLOCATED: "Allocated settlement land",
  OTHER: "Other",
};

// ------------------------------------------------------------------
// Questionnaire option lists (Roki official survey)
// ------------------------------------------------------------------
export const FARMING_YEARS_OPTIONS = [
  { value: "LESS_1", label: "Less than 1 year" },
  { value: "Y1_5", label: "1–5 years" },
  { value: "Y6_10", label: "6–10 years" },
  { value: "OVER_10", label: "More than 10 years" },
] as const;

export const FARMING_TYPES = ["Horticulture", "Cereals", "Legumes", "Livestock", "Poultry", "Mixed farming", "Other"] as const;
export const REFUGEE_ORIGINS = ["South Sudan", "DR Congo", "Burundi", "Somalia", "Rwanda", "Other"] as const;
export const SALES_CHANNELS = ["Local market", "Traders", "Cooperatives", "Companies", "Export companies"] as const;
export const PRODUCTION_LIMITS = [
  "Lack of quality seed", "Lack of fertilisers", "Lack of pesticides", "Limited land",
  "Lack of irrigation", "Lack of technical knowledge", "Lack of finance", "Market uncertainty", "Other",
] as const;
export const INPUT_SOURCES = ["Local shops", "NGOs / projects", "Farmer groups", "Companies", "Other"] as const;
export const RECORD_TYPES = ["Production records", "Input records", "Sales records", "Cost records", "None"] as const;
export const SELL_TO = ["Middlemen", "Local traders", "Markets", "Companies", "Cooperatives", "Other"] as const;
export const SELLING_CHALLENGES = [
  "Low prices", "Lack of buyers", "Transport problems", "Quality rejection", "Market information shortage",
] as const;
export const SUPPLY_CROPS = ["Tomato", "Onion", "Pepper", "Eggplant", "Cabbage", "Fruits", "Other"] as const;
export const FINANCE_SOURCES = ["Bank", "SACCO", "NGO programme", "Savings", "Family"] as const;
export const CLIMATE_CHALLENGES = ["Drought", "Floods", "Pest outbreaks", "Disease outbreaks", "Other"] as const;
export const CLIMATE_PRACTICES = ["Irrigation", "Mulching", "Improved seeds", "Organic manure", "Water harvesting"] as const;
export const PRODUCTION_SEASONS = [
  { value: "FIRST", label: "First season" },
  { value: "SECOND", label: "Second season" },
  { value: "YEAR_ROUND", label: "Year-round production" },
] as const;
export const PRODUCTION_SYSTEMS = [
  { value: "OPEN_FIELD", label: "Open field" },
  { value: "GREENHOUSE", label: "Greenhouse" },
  { value: "IRRIGATED", label: "Irrigated farming" },
  { value: "RAIN_FED", label: "Rain-fed farming" },
] as const;
export const IRRIGATION_TYPES = ["Drip irrigation", "Sprinkler", "Pump irrigation", "Other"] as const;
export const RECOMMENDED_CATEGORIES = [
  { value: "COMMERCIAL", label: "Commercial farmer" },
  { value: "EMERGING", label: "Emerging farmer" },
  { value: "BEGINNER", label: "Beginner farmer" },
] as const;
export const DEFAULT_SURVEY: FarmerSurvey = {
  enumeratorName: "",
  enumeratorId: "",
  femaleHeaded: false,
  youthFarmer: false,
  personWithDisability: false,
  elderlyFarmer: false,
  farmingYears: "Y1_5",
  farmingTypes: [],
  previousCrops: [],
  soldCommercially: false,
  salesChannels: [],
  hasLandAccess: true,
  cultivatedAcreage: 0,
  expansionAvailable: false,
  currentCrops: [],
  productionSeason: "FIRST",
  productionSystem: "OPEN_FIELD",
  productionLimits: [],
  inputSource: "LOCAL_SHOPS",
  usesImprovedSeed: false,
  extensionSupport: false,
  hasIrrigation: false,
  keepsRecords: false,
  recordTypes: [],
  willingDigitalRecords: true,
  sellTo: [],
  sellingChallenges: [],
  wantsToSupplyRoki: true,
  supplyCrops: [],
  willingRokiSpecs: false,
  willingExportStandards: false,
  acceptForwardPurchase: false,
  accessedFinance: false,
  financeSources: [],
  needsFinancing: false,
  climateChallenges: [],
  willingClimateSmart: false,
  climatePractices: [],
  consent: true,
  landAvailability: "MEDIUM",
  productionPotential: "MEDIUM",
  recommendedCategory: "EMERGING",
};
