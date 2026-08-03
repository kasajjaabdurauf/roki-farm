// ------------------------------------------------------------------
// Static reference data, crops (with rule-engine thresholds per acre),
// harvest windows, and Uganda admin geography. All deterministic.
// ------------------------------------------------------------------

export const CROPS = [
  // Roki's core fruit & vegetable lines first
  "Tomato",
  "Onion",
  "Cabbage",
  "Carrots",
  "Watermelon",
  "Eggplant",
  "Passion Fruit",
  "Chilli Pepper",
  "Coffee",
  "Maize",
  "Beans",
  "Cassava",
  "Bananas",
  "Groundnuts",
  "Millet",
  "Rice",
  "Sorghum",
  "Sweet Potatoes",
  "Irish Potatoes",
  "Soybean",
  "Sunflower",
  "Sugarcane",
  "Avocado",
  "Mango",
  "Pineapple",
  "Tea",
  "Cotton",
  "Tobacco",
  "Vegetables",
  "Other",
] as const;

export type CropName = (typeof CROPS)[number];

export interface CropDefaults {
  maxPerAcreKg: number; // ceiling: yield_kg > acreage × max → NEEDS_AUDIT
  typicalPerAcreKg: number; // baseline for Low / Expected / Bumper scoring + forecast
}

/**
 * Deterministic per-crop thresholds (kg per acre) for Uganda.
 * Generous ceilings so plausible harvests never false-flag, while
 * inflated entries (typos, double-counting, fraud) are caught.
 * Admin-editable in Settings → Validation Rules.
 */
export const CROP_DEFAULTS: Record<string, CropDefaults> = {
  Tomato: { maxPerAcreKg: 12000, typicalPerAcreKg: 6000 },
  Onion: { maxPerAcreKg: 9000, typicalPerAcreKg: 4000 },
  Cabbage: { maxPerAcreKg: 12000, typicalPerAcreKg: 6000 },
  Carrots: { maxPerAcreKg: 10000, typicalPerAcreKg: 5000 },
  Watermelon: { maxPerAcreKg: 18000, typicalPerAcreKg: 9000 },
  Eggplant: { maxPerAcreKg: 10000, typicalPerAcreKg: 5000 },
  "Passion Fruit": { maxPerAcreKg: 8000, typicalPerAcreKg: 3500 },
  "Chilli Pepper": { maxPerAcreKg: 6000, typicalPerAcreKg: 2500 },
  Coffee: { maxPerAcreKg: 1500, typicalPerAcreKg: 700 },
  Maize: { maxPerAcreKg: 3000, typicalPerAcreKg: 1600 },
  Beans: { maxPerAcreKg: 1200, typicalPerAcreKg: 600 },
  Cassava: { maxPerAcreKg: 7000, typicalPerAcreKg: 4000 },
  Bananas: { maxPerAcreKg: 10000, typicalPerAcreKg: 5500 },
  Groundnuts: { maxPerAcreKg: 1500, typicalPerAcreKg: 700 },
  Millet: { maxPerAcreKg: 1500, typicalPerAcreKg: 700 },
  Rice: { maxPerAcreKg: 2500, typicalPerAcreKg: 1300 },
  Sorghum: { maxPerAcreKg: 1500, typicalPerAcreKg: 800 },
  "Sweet Potatoes": { maxPerAcreKg: 8000, typicalPerAcreKg: 4500 },
  "Irish Potatoes": { maxPerAcreKg: 7000, typicalPerAcreKg: 3500 },
  Soybean: { maxPerAcreKg: 1500, typicalPerAcreKg: 800 },
  Sunflower: { maxPerAcreKg: 1300, typicalPerAcreKg: 700 },
  Sugarcane: { maxPerAcreKg: 35000, typicalPerAcreKg: 20000 },
  Avocado: { maxPerAcreKg: 9000, typicalPerAcreKg: 5000 },
  Mango: { maxPerAcreKg: 7000, typicalPerAcreKg: 4000 },
  Pineapple: { maxPerAcreKg: 25000, typicalPerAcreKg: 12000 },
  Tea: { maxPerAcreKg: 4000, typicalPerAcreKg: 2000 },
  Cotton: { maxPerAcreKg: 1500, typicalPerAcreKg: 700 },
  Tobacco: { maxPerAcreKg: 2000, typicalPerAcreKg: 900 },
  Vegetables: { maxPerAcreKg: 6000, typicalPerAcreKg: 3000 },
  Other: { maxPerAcreKg: 5000, typicalPerAcreKg: 2500 },
};

/** Default harvest windows (month numbers 1-12) used when a farmer hasn't
 *  set their own plan window. Drives Production Forecast fallbacks. */
export const CROP_HARVEST_WINDOW: Record<string, [number, number]> = {
  Tomato: [7, 9],
  Onion: [10, 12],
  Cabbage: [5, 7],
  Carrots: [6, 8],
  Watermelon: [11, 1], // Nov–Jan (wraps year)
  Eggplant: [8, 10],
  "Passion Fruit": [10, 2], // Oct–Feb
  "Chilli Pepper": [7, 10],
  Coffee: [10, 12],
  Maize: [7, 9],
  Beans: [6, 8],
  Cassava: [12, 2],
  Bananas: [1, 12], // year-round
  Groundnuts: [8, 10],
  Millet: [7, 9],
  Rice: [10, 12],
  Sorghum: [7, 9],
  "Sweet Potatoes": [9, 11],
  "Irish Potatoes": [6, 8],
  Soybean: [9, 11],
  Sunflower: [8, 10],
  Sugarcane: [1, 12],
  Avocado: [2, 5],
  Mango: [11, 2],
  Pineapple: [1, 12],
  Tea: [1, 12],
  Cotton: [9, 11],
  Tobacco: [8, 10],
  Vegetables: [1, 12],
  Other: [1, 12],
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const DISTRICTS = [
  "Kampala",
  "Wakiso",
  "Mukono",
  "Masaka",
  "Mbarara",
  "Kabale",
  "Mbale",
  "Jinja",
  "Arua",
  "Gulu",
  "Lira",
  "Soroti",
  "Kabarole (Fort Portal)",
  "Hoima",
  "Bushenyi",
  "Ntungamo",
  "Mubende",
  "Luwero",
  "Iganga",
  "Tororo",
  "Rukungiri",
  "Kasese",
  "Rakai",
  "Kayunga",
];

/** Representative sub-counties per district (used by the form + seeds). */
export const SUB_COUNTIES: Record<string, string[]> = {
  Kampala: ["Kawempe", "Makindye", "Nakawa", "Rubaga", "Central"],
  Wakiso: ["Nansana", "Kira", "Entebbe", "Kajjansi", "Buloba", "Kakiri"],
  Mukono: ["Kasawo", "Nama", "Nakifuma", "Mukono Town Council"],
  Masaka: ["Kyanamukaaka", "Bukakata", "Kimaanya-Kyabakuza"],
  Mbarara: ["Kashari", "Rubindi", "Nyakayojo"],
  Kabale: ["Ndorwa", "Rubanda", "Bufundi"],
  Mbale: ["Bungokho", "Bubulo", "Bumasifwa"],
  Jinja: ["Butembe", "Kimaka", "Mafubira"],
  Arua: ["Ayivu", "Vurra", "Madi-Okollo"],
  Gulu: ["Pece", "Bardege", "Layibi"],
  Lira: ["Erute", "Amach", "Barapwo"],
  Soroti: ["Arapai", "Asuret", "Tubur"],
  "Kabarole (Fort Portal)": ["Buraliya", "Kisomoro", "Karambi"],
  Hoima: ["Bujenje", "Kigorobya", "Mparo"],
  Bushenyi: ["Igara", "Bunyaruguru", "Ruhumuro"],
  Ntungamo: ["Ruhaama", "Kajara", "Ruhama"],
  Mubende: ["Bagezza", "Kasambya", "Kiyuni"],
  Luwero: ["Nyimbwa", "Bamunanika", "Zirobwe"],
  Iganga: ["Nakalama", "Nawandigi", "Busembatia"],
  Tororo: ["West Budama", "Osukuru", "Merikit"],
  Rukungiri: ["Rubabo", "Buyanja", "Nyakagyeme"],
  Kasese: ["Busongora", "Mwamba", "Kisinga"],
  Rakai: ["Kakuuto", "Kyotera", "Lwamaggwa"],
  Kayunga: ["Bweyogerere", "Kangulumira", "Busana"],
};

export const DEFAULT_SETTINGS_RULES = {
  anomalyDetection: true,
  duplicateGuard: true,
  incompleteProfile: true,
  yieldScoring: true,
};
