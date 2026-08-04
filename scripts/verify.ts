// Functional verification of the rule engine + utilities (runs in Node).
import { normalizeUgPhone } from "../src/lib/phone";
import { nextFarmerId } from "../src/lib/db";
import { validEmailish, validNumber, validText } from "../src/lib/security";
import { computeScaleTier, evaluateLog, computeFarmerFlags, anomalyCheck, duplicateCheck, fmtKg } from "../src/lib/rules";
import { buildSeed } from "../src/lib/seed";
import { buildStaging, autoDetect } from "../src/lib/sheet";
import { importStaging, mergeFarmers, EMPTY_DB } from "../src/lib/db";
import { findDuplicateGroups } from "../src/lib/dedup";
import { toCSVString } from "../src/lib/export";
import { CROP_DEFAULTS, DEFAULT_SETTINGS_RULES } from "../src/lib/reference";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, extra ?? ""); }
}

const settings = { rules: { ...DEFAULT_SETTINGS_RULES }, crops: { ...CROP_DEFAULTS } };

console.log("\n1) Phone validation (MTN / Airtel Uganda)");
{
  const t1 = normalizeUgPhone("0772 456 123");
  check("0772 456 123 → +256772456123 (MTN)", t1.ok && t1.normalized === "+256772456123" && t1.carrier === "MTN", t1);
  const t2 = normalizeUgPhone("+256702111222");
  check("+256702111222 → Airtel", t2.ok && t2.carrier === "AIRTEL", t2);
  const t3 = normalizeUgPhone("0755-000-111");
  check("0755-000-111 → Airtel", t3.ok && t3.normalized === "+256755000111", t3);
  const t4 = normalizeUgPhone("077X 12 345");
  check("077X 12 345 → invalid", !t4.ok, t4);
  const t5 = normalizeUgPhone("0414 555 666");
  check("Landline 0414 → invalid", !t5.ok, t5);
  const t6 = normalizeUgPhone("256773123456");
  check("256773123456 → +256773123456", t6.ok && t6.normalized === "+256773123456", t6);
}

console.log("\n2) Scale tier tagging");
check("1.5 ac → MICRO", computeScaleTier(1.5) === "MICRO");
check("2.0 ac → MID_SCALE", computeScaleTier(2) === "MID_SCALE");
check("10 ac → MID_SCALE", computeScaleTier(10) === "MID_SCALE");
check("10.1 ac → LARGE_SCALE", computeScaleTier(10.1) === "LARGE_SCALE");

console.log("\n3) Anomaly detection (yield_kg > acreage × max_per_acre)");
{
  const farmer = { acreage: 2, id: "RFV-UG-00001" } as any;
  const ok = anomalyCheck({ quantityKg: 4000, cropType: "Maize" }, farmer, settings);
  check("4,000 kg on 2 ac maize (ceiling 6,000) → no flag", !ok.flagged, ok);
  const bad = anomalyCheck({ quantityKg: 7000, cropType: "Maize" }, farmer, settings);
  check("7,000 kg on 2 ac maize (ceiling 6,000) → NEEDS_AUDIT", bad.flagged, bad);
  const zero = anomalyCheck({ quantityKg: 5000, cropType: "Maize" }, { acreage: 0 } as any, settings);
  check("0 acreage → no false flag", !zero.flagged);
}

console.log("\n4) Duplicate guard (same farmer + crop + date within 24h)");
{
  const base = { id: "RFV-LOG-00001", farmerId: "RFV-UG-00001", cropType: "Maize", harvestDate: "2026-07-28", createdAt: "2026-07-30T08:00:00.000Z" };
  const dup = { ...base, id: "RFV-LOG-00002", createdAt: "2026-07-30T14:00:00.000Z" };
  const far = { ...base, id: "RFV-LOG-00003", createdAt: "2026-07-31T09:00:00.000Z" };
  check("same entry 6h later → FLAGGED", duplicateCheck(dup, [base]).flagged);
  check("entry >24h later → clean", !duplicateCheck(far, [base]).flagged);
  const diffCrop = { ...base, id: "RFV-LOG-00004", cropType: "Beans" };
  check("different crop → clean", !duplicateCheck(diffCrop, [base]).flagged);
}

console.log("\n5) Incomplete profile flag");
check("missing phone → flagged", computeFarmerFlags({ phone: "", district: "Gulu", subCounty: "Pece" }).includes("INCOMPLETE_PROFILE"));
check("complete profile → clean", computeFarmerFlags({ phone: "+256772123456", district: "Gulu", subCounty: "Pece" }).length === 0);

console.log("\n6) Seed dataset");
{
  const db = buildSeed();
  check("36 farmers", db.farmers.length === 36, db.farmers.length);
  check("farmers ≥ 5 logs on average", db.logs.length > 200, db.logs.length);
  const ids = new Set(db.farmers.map((f) => f.id));
  check("all farmer IDs unique & formatted", ids.size === db.farmers.length && db.farmers.every((f) => /^RFV-UG-\d{5}$/.test(f.id)));
  const audits = db.logs.filter((l) => l.status === "NEEDS_AUDIT").length;
  const flagged = db.logs.filter((l) => l.status === "FLAGGED").length;
  const incomplete = db.farmers.filter((f) => f.flags.includes("INCOMPLETE_PROFILE")).length;
  check("NEEDS_AUDIT logs injected", audits >= 5, audits);
  check("FLAGGED duplicates injected", flagged >= 3, flagged);
  check("INCOMPLETE_PROFILE farmers injected", incomplete === 3, incomplete);
  check("every log has a valid farmer", db.logs.every((l) => ids.has(l.farmerId)));
  check("seq counters continue after seeds", db.meta.nextFarmerSeq === 37 && db.meta.nextLogSeq === db.logs.length + 1);
  // anomaly notes sanity: each NEEDS_AUDIT has a note mentioning the ceiling rule
  check("anomaly notes present", db.logs.filter((l) => l.status === "NEEDS_AUDIT").every((l) => l.auditNotes[0]?.includes("exceeds")));
  // Roki survey fields
  check("gender recorded for all farmers", db.farmers.every((f) => f.gender === "M" || f.gender === "F" || f.gender === "OTHER"));
  check("refugee + host farmers present", db.farmers.some((f) => f.refugeeStatus === "REFUGEE") && db.farmers.some((f) => f.refugeeStatus === "HOST"));
  check("women farmers present", db.farmers.filter((f) => f.gender === "F").length >= 12);
  check("production plans present", db.farmers.filter((f) => f.plannedProductions.length > 0).length >= 30);
  check("plan expected volumes positive", db.farmers.flatMap((f) => f.plannedProductions).every((p) => p.expectedVolumeKg > 0 && p.acres > 0));
  check("harvest windows within 1-12", db.farmers.flatMap((f) => f.plannedProductions).every((p) => p.harvestStartMonth >= 1 && p.harvestEndMonth <= 12));
  // Roki scoring tiers
  const t1 = db.farmers.filter((f) => f.rokiTier === 1).length;
  const t2 = db.farmers.filter((f) => f.rokiTier === 2).length;
  const t3 = db.farmers.filter((f) => f.rokiTier === 3).length;
  check("all three Roki tiers present", t1 >= 4 && t2 >= 4 && t3 >= 4, { t1, t2, t3 });
  // full questionnaire (15 sections)
  check("every farmer has a survey record", db.farmers.every((f) => !!f.survey));
  check("enumerator recorded", db.farmers.every((f) => f.survey?.enumeratorName !== undefined && f.survey?.enumeratorId !== undefined));
  check("survey consent given", db.farmers.every((f) => f.survey?.consent === true));
  check("farming years populated", db.farmers.every((f) => ["LESS_1", "Y1_5", "Y6_10", "OVER_10"].includes(f.survey!.farmingYears)));
  check("current crops recorded", db.farmers.filter((f) => f.survey!.currentCrops.length > 0).length >= 30);
  check("vulnerability flags recorded", db.farmers.some((f) => f.survey!.femaleHeaded) && db.farmers.some((f) => f.survey!.elderlyFarmer));
  check("production limits recorded", db.farmers.every((f) => f.survey!.productionLimits.length > 0));
  check("recommended category recorded", db.farmers.every((f) => ["COMMERCIAL", "EMERGING", "BEGINNER"].includes(f.survey!.recommendedCategory)));
  check("refugee origin matches status", db.farmers.filter((f) => f.refugeeStatus === "REFUGEE").every((f) => !!f.survey!.countryOfOrigin));
}

console.log("\n7) Column auto-mapping");
{
  check('"Tel" → phone', autoDetect("Tel").target === "phone");
  check('"Phone Number" → phone', autoDetect("Phone Number").target === "phone");
  check('"Contact" → phone', autoDetect("Contact").target === "phone");
  check('"Qty (Kg)" → quantityKg (KG)', autoDetect("Qty (Kg)").target === "quantityKg" && autoDetect("Qty (Kg)").unit === "KG");
  check('"Yield (Tonnes)" → quantityKg (TONNE)', autoDetect("Yield (Tonnes)").target === "quantityKg" && autoDetect("Yield (Tonnes)").unit === "TONNE");
  check('"Area (Ha)" → acreage (HECTARES)', autoDetect("Area (Ha)").target === "acreage" && autoDetect("Area (Ha)").areaUnit === "HECTARES");
  check('"Farmer Name" → fullName', autoDetect("Farmer Name").target === "fullName");
  check('"Sub-County" → subCounty', autoDetect("Sub-County").target === "subCounty");
  check('"Harvest Date" → harvestDate', autoDetect("Harvest Date").target === "harvestDate");
  check('"Batch ID" → batchId', autoDetect("Batch ID").target === "batchId");
  check('"Grade" → qualityGrade', autoDetect("Grade").target === "qualityGrade");
}

console.log("\n8) Staging validation + import");
{
  const seed = buildSeed();
  const existing = seed.farmers[0]; // Aisha Namukwaya, phone known
  const raw = [
    ["Farmer Name", "Phone", "District", "Sub-County", "Crop", "Harvest Date", "Qty (Kg)", "Grade"],
    [existing.fullName, existing.phone, existing.district, existing.subCounty, "Maize", "2026-07-28", "1450", "A"],
    ["Grace Achieng", "0755 000 111", "Lira", "Erute", "Millet", "2026-07-22", "820", "A"],
    ["Bad Phone Row", "077X 12 345", "Kampala", "Rubaga", "Maize", "2026-07-18", "900", "B"],
    ["Negative Qty", "0701 555 666", "Kampala", "Nakawa", "Vegetables", "2026-07-15", "-5", "A"],
    ["", "", "", "", "Maize", "2026-07-12", "120", "A"], // produce row, no farmer ref
  ];
  const file = { fileName: "test.csv", sheetName: "Sheet1", raw };
  const st = buildStaging(file, seed);
  check("5 data rows staged", st.rows.length === 5, st.rows.length);
  const r0 = st.rows[0];
  check("row 1: linked by phone to existing farmer", r0.farmerId === existing.id && r0.errors.length === 0, r0);
  check("row 2: new farmer (valid)", st.rows[1].farmerId === undefined && st.rows[1].errors.length === 0, st.rows[1].errors);
  check("row 3: bad phone error", st.rows[2].errors.some((e) => e.includes("not a valid Ugandan mobile")), st.rows[2].errors);
  check("row 4: negative quantity error", st.rows[3].errors.some((e) => e.includes("greater than 0")), st.rows[3].errors);
  check("row 5: produce row without farmer → error", st.rows[4].errors.length > 0, st.rows[4].errors);
  check("rows 1-2 detected as log rows", r0.isLogRow && st.rows[1].isLogRow);

  // run import on a db seeded copy — verify counts
  const db = { ...EMPTY_DB, farmers: [...seed.farmers], logs: [...seed.logs], meta: { ...seed.meta }, settings: { ...seed.settings } };
  const savedFarmers = db.farmers.length;
  const summary = importStaging(st, db);
  check("import created 1 new farmer", summary.createdFarmers === 1, summary);
  check("import linked 1 existing", summary.linkedExisting === 1, summary);
  check("import created 2 logs", summary.createdLogs === 2, summary);
  check("3 rows skipped for errors", summary.skippedWithErrors === 3, summary);
  check("new farmer registered in db", db.farmers.length === savedFarmers + 1);
  check("linked log attached to existing farmer", db.logs.filter((l) => l.farmerId === existing.id).length === seed.logs.filter((l) => l.farmerId === existing.id).length + 1);
}

console.log("\n8b) Real-world upload parsing (Roki Farmers List 2024 style)");
{
  const seed = buildSeed();
  const raw = [
    ["Sno.", "COMPANY NAME", "FIRST NAME", "LAST NAME", "NIN", "DISTRICT", "PARISH", "VILLAGE", "CROP", "ACREAGE", "CONTACT (S)", "PVY TEST"],
    ["1", "ROKI FRUITS & VEGETABLES", "AGUSE", "KALIMBA", "CM76009104ROYD", "MUBENDE", "KIJUMBA", "KACWI LC1", "CHILLI", "1.5", "0782408545/0757408545", "YES"],
    ["2", "ROKI FRUITS & VEGETABLES", "JOEL", "BUKENYA", "N/A", "MUKONO", "NAMA", "WAKISO", "HOT PEPPER", "1", "0759883074", "YES"],
    ["3", "ROKI FRUITS & VEGETABLES", "ERIISA", "NSUBUGA", "N/A", "BUTAMBALA", "GOMBE", "KAYENJE", "GARDEN EGGS", "0.4", "0704 600996", "NO"],
  ];
  const st = buildStaging({ fileName: "roki.xlsx", sheetName: "Sheet1", raw }, seed);
  check("first+last merged into full name", st.rows[0].parsed.fullName === "AGUSE KALIMBA", st.rows[0].parsed.fullName);
  check("row 2 name merged", st.rows[1].parsed.fullName === "JOEL BUKENYA");
  check("multi-phone cell keeps first valid number", st.rows[0].parsed.phone === "0782408545", st.rows[0].parsed.phone);
  check("multi-phone cell records a warning", st.rows[0].warnings.some((w) => w.includes("Multiple phone numbers")), st.rows[0].warnings);
  check("acreage parsed as number", st.rows[0].parsed.acreage === 1.5, st.rows[0].parsed.acreage);
  check("phone with inner space parses", st.rows[2].parsed.phone === "0704600996", st.rows[2].parsed.phone);
  check("unknown columns ignored, not lost (mapper keeps all)", st.columns.length >= 12, st.columns.length);
}

console.log("\n8c) Planting history + GPS from upload");
{
  const seed = buildSeed();
  const raw = [
    ["FIRST NAME", "LAST NAME", "DISTRICT", "CROP", "ACREAGE", "PLANTING DATE", "SOURCE OF SEED", "STATUS", "GPS-LATITUDE", "GPS-LONGITUDE", "CONTACT (S)"],
    ["AGUSE", "KALIMBA", "MUBENDE", "CHILLI", "1.5", "15.10.2023", "ROKI FRUITS", "CULTIVATING", "0.619933", "31.274045", "0782408545"],
  ];
  const st = buildStaging({ fileName: "roki.xlsx", sheetName: "Sheet1", raw }, seed);
  check("planting date parsed", st.rows[0].parsed.plantingDate === "2023-10-15", st.rows[0].parsed.plantingDate);
  check("source of seed captured", st.rows[0].parsed.sourceOfSeed === "ROKI FRUITS", st.rows[0].parsed.sourceOfSeed);
  check("status captured", st.rows[0].parsed.plantingStatus === "CULTIVATING", st.rows[0].parsed.plantingStatus);
  check("GPS lat parsed", st.rows[0].parsed.gpsLat === 0.619933, st.rows[0].parsed.gpsLat);
  check("GPS lon parsed", st.rows[0].parsed.gpsLon === 31.274045, st.rows[0].parsed.gpsLon);
  const db = { ...EMPTY_DB, farmers: [...seed.farmers], logs: [...seed.logs], meta: { ...seed.meta }, settings: { ...seed.settings } };
  importStaging(st, db);
  const created = db.farmers.find((f) => f.phone === "+256782408545");
  check("import created farmer with phone", !!created, created?.id);
  check("planting history attached", created?.plantingHistory?.length === 1, created?.plantingHistory);
  check("history has crop + source", created?.plantingHistory?.[0]?.crop === "CHILLI" && created?.plantingHistory?.[0]?.sourceOfSeed === "ROKI FRUITS");
}

{
  const csv = toCSVString(
    [{ id: "RFV-UG-00001", phone: "+256772456123", crops: ["Maize", "Beans"], note: "bulk, double-entry" }],
    [
      { key: "id", label: "Farmer ID" },
      { key: "phone", label: "Phone" },
      { key: "crops", label: "Crops", value: (r) => r.crops.join("; ") },
      { key: "note", label: "Note" },
    ]
  );
  check("BOM present", csv.charCodeAt(0) === 0xfeff);
  check("field with comma is quoted", csv.includes('"bulk, double-entry"'));
  check("clean phone", csv.includes("+256772456123"));
}

console.log("\n8d) Dedup & merge");
{
  const seed = buildSeed();
  const db = { ...EMPTY_DB, farmers: [...seed.farmers], logs: [...seed.logs], meta: { ...seed.meta }, settings: { ...seed.settings } };
  const master = seed.farmers[0]; // has logs in the seed
  const dup = { ...seed.farmers[1], id: "RFV-UG-99992", phone: master.phone };
  db.farmers.push(dup);
  // give the dup a real log so merging reassigns it
  db.logs.push({
    ...db.logs[0],
    id: "RFV-LOG-99999",
    farmerId: dup.id,
    createdAt: new Date().toISOString(),
  });
  const groups = findDuplicateGroups(db);
  check("phone group detected", groups.some((g) => g.reason === "Same phone number" && g.farmers.some((f) => f.id === dup.id)));
  const before = db.logs.length;
  const masterLogsBefore = db.logs.filter((l) => l.farmerId === master.id).length;
  mergeFarmers(master.id, [dup.id], db);
  check("merged record removed", !db.farmers.some((f) => f.id === dup.id));
  check("logs preserved", db.logs.length === before);
  check("logs reassigned to master", db.logs.filter((l) => l.farmerId === master.id).length > masterLogsBefore);
}

console.log("\n8e) Security: validation + concurrency + rate limit");
{
  // strict validators
  check("validText rejects empty", validText("   ") === false);
  check("validText accepts name", validText("Aisha Namukwaya") === true);
  check("validNumber rejects NaN/negative", validNumber(NaN) === false && validNumber(-1) === false);
  check("validNumber accepts acreage", validNumber(2.5, 0.01, 100000) === true);
  check("validEmailish rejects junk", validEmailish("not-an-email") === false);

  // concurrency-safe IDs: two records sharing a base id never collide
  const seed = buildSeed();
  const db2 = { ...EMPTY_DB, farmers: [...seed.farmers], logs: [...seed.logs], meta: { ...seed.meta }, settings: { ...seed.settings } };
  const first = nextFarmerId(db2);
  // simulate a remote record that claimed the next id
  db2.farmers.push({ ...seed.farmers[0], id: first });
  const second = nextFarmerId(db2);
  check("concurrent IDs never collide", first !== second, { first, second });
}

{
  const farmer = { id: "RFV-UG-00001", acreage: 2 } as any;
  const mk = (id: string, kg: number, days = 10) => ({
    id, farmerId: farmer.id, cropType: "Maize", quantityKg: kg,
    qualityGrade: "A" as const, harvestDate: "2026-07-01", status: "VERIFIED" as const,
    auditNotes: [], yieldScore: "EXPECTED" as const, source: "FIELD_AGENT" as const,
    createdAt: new Date(Date.now() - days * 86400000).toISOString(),
  });
  const history = [mk("L1", 1600, 10), mk("L2", 3200, 12), mk("L3", 2800, 14), mk("L4", 2400, 16), mk("L5", 2000, 18)];
  const low = evaluateLog({ ...mk("L6", 400, 20), id: "L6" }, farmer, history, settings);
  const high = evaluateLog({ ...mk("L7", 9000, 22), id: "L7" }, farmer, history, settings);
  const mid = evaluateLog({ ...mk("L8", 2400, 24), id: "L8" }, farmer, history, settings);
  check("4,000 kg over 2 ac vs median 2,400/ac → LOW", low.yieldScore === "LOW", low);
  check("9,000 kg over 2 ac → BUMPER (also exceeds ceiling → NEEDS_AUDIT)", high.yieldScore === "BUMPER" && high.status === "NEEDS_AUDIT", high);
  check("median-level → EXPECTED", mid.yieldScore === "EXPECTED", mid);
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail > 0 ? 1 : 0);
