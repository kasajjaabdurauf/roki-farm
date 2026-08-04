// ------------------------------------------------------------------
// Lightweight multi-language support for farmer-facing screens.
// Languages: English, Luganda (lg), Runyankole/Rukiga (rn), Swahili (sw)
// The admin/field-agent interface stays in English.
// NOTE: translations are best-effort community-level; a native speaker
// can refine the strings below without touching any code.
// ------------------------------------------------------------------

export type Lang = "en" | "lg" | "rn" | "sw";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "lg", label: "Luganda" },
  { code: "rn", label: "Runyankole/Rukiga" },
  { code: "sw", label: "Kiswahili" },
];

/** Map the survey's preferred-language answer to a UI language code. */
export function langFromPreference(pref?: string): Lang {
  const p = (pref ?? "").toLowerCase();
  if (p.includes("luganda")) return "lg";
  if (p.includes("runyankole") || p.includes("rukiga")) return "rn";
  if (p.includes("swahili") || p.includes("kiswahili")) return "sw";
  return "en";
}

type Dict = Record<string, string>;

const STRINGS: Record<Lang, Dict> = {
  en: {
    "greeting": "Karibu, {name} 🌱",
    "farmAtGlance": "Your farm at a glance",
    "myFarm": "My Farm",
    "logHarvest": "Log my harvest",
    "myHarvests90": "My harvests (90 d)",
    "myProduce": "My produce",
    "avgPerAcre": "Average per acre",
    "harvestLogs": "Harvest logs",
    "myRecentHarvests": "My recent harvests",
    "viewAll": "View all",
    "noHarvests": "No harvests logged yet",
    "noHarvestsDesc": "Log your first harvest, it takes less than a minute and works offline.",
    "logHarvestBtn": "Log a harvest",
    "farmingTips": "Farming tips",
    "tipsSub": "Fresh tips from the Roki agronomy team",
    "myTier": "My tier",
    "completeSurvey": "Complete my farmer survey",
    "welcomeTitle": "Welcome to the Roki farm platform",
    "welcomeDesc": "Your account is registered with its own farmer ID. Complete your farmer survey to add your farm details.",
    "thisSeason": "this season",
    "last90": "last 90 days",
    "allTime": "all time",
    "harvested": "harvested",
    "logged": "logged",
  },
  lg: {
    "greeting": "Karibu, {name} 🌱",
    "farmAtGlance": "Emmere yammwe mu kumulimu",
    "myFarm": "Ffirimu yange",
    "logHarvest": "Wandiika ebisimbyo byange",
    "myHarvests90": "Ebisimbyo byange (nna 90)",
    "myProduce": "Ebimera byange",
    "avgPerAcre": "Ku eka buli emu",
    "harvestLogs": "Ebiwandiiko by'ebisimbyo",
    "myRecentHarvests": "Ebisimbyo byange ebya buggya",
    "viewAll": "Laba byonna",
    "noHarvests": "Temunawandiikako kisimbyo",
    "noHarvestsDesc": "Wandiika ekisimbyo kyo ekyasooka, kitwala dakika ntono.",
    "logHarvestBtn": "Wandiika ekisimbyo",
    "farmingTips": "Amagezi ag'ebyobulimi",
    "tipsSub": "Amagezi amatogojja okuva mu Roki",
    "myTier": "Akatiba kange",
    "completeSurvey": "Ntuusa okubuuzibwa kwange",
    "welcomeTitle": "Okwaniriza ku Roki",
    "welcomeDesc": "Akaawunti yo yawandiikibwa n'ennamba yaayo. Ntuusa okubuuzibwa okwongerako ebyobulimi byo.",
    "thisSeason": "mumwaka guno",
    "last90": "nna 90 eziyise",
    "allTime": "emirundi gyonna",
    "harvested": "kyasimbye",
    "logged": "kyawandiikibwa",
  },
  rn: {
    "greeting": "Karibu, {name} 🌱",
    "farmAtGlance": "Eby'omurirogongo",
    "myFarm": "Ekirooro kyange",
    "logHarvest": "Kwata ebiribwa byange",
    "myHarvests90": "Ebikwatwa byange (90 d)",
    "myProduce": "Ebicurisho byange",
    "avgPerAcre": "Kuri eka nkonu",
    "harvestLogs": "Ebyokukwata ebiribwa",
    "myRecentHarvests": "Ebikwatwa bya nyabiro",
    "viewAll": "Reba byona",
    "noHarvests": "Tihariho ekikwatwa",
    "noHarvestsDesc": "Kwata eky'okubanza, kitwara eddakika nke.",
    "logHarvestBtn": "Kwata ekiribwa",
    "farmingTips": "Amagezi g'okulima",
    "tipsSub": "Amagezi matooga okuruga aha Roki",
    "myTier": "Rutindo rwangye",
    "completeSurvey": "Ninsireza okubazibwa",
    "welcomeTitle": "Nimukaire aha Roki",
    "welcomeDesc": "Akawunti yawe neyandisibwa n'ennamba yaayo. Ninsireza okubazibwa kwonka ebirungi by'omurirogongo.",
    "thisSeason": "omwaka ogu",
    "last90": "ndala 90 eziire",
    "allTime": "ebihe byona",
    "harvested": "kyakwatwa",
    "logged": "kyandisibwa",
  },
  sw: {
    "greeting": "Karibu, {name} 🌱",
    "farmAtGlance": "Shamba lako kwa mtazamo",
    "myFarm": "Shamba langu",
    "logHarvest": "Andika mavuno yangu",
    "myHarvests90": "Mavuno yangu (siku 90)",
    "myProduce": "Mazao yangu",
    "avgPerAcre": "Kwa ekari moja",
    "harvestLogs": "Rekodi za mavuno",
    "myRecentHarvests": "Mavuno yangu ya hivi karibuni",
    "viewAll": "Ona yote",
    "noHarvests": "Bado hakuna mavuno",
    "noHarvestsDesc": "Andika mavuno yako ya kwanza, inachukua dakika moja.",
    "logHarvestBtn": "Andika mavuno",
    "farmingTips": "Vidokezo vya kilimo",
    "tipsSub": "Vidokezo vipya kutoka timu ya Roki",
    "myTier": "Kiwango changu",
    "completeSurvey": "Maliza dodoso langu",
    "welcomeTitle": "Karibu kwenye Roki",
    "welcomeDesc": "Akaunti yako imesajiliwa na kitambulisho chake. Maliza dodoso kuongeza maelezo ya shamba lako.",
    "thisSeason": "msimu huu",
    "last90": "siku 90 zilizopita",
    "allTime": "mara zote",
    "harvested": "ilivunwa",
    "logged": "ilirekodiwa",
  },
};

/** Translate a key into the given language (falls back to English). */
export function t(lang: Lang, key: string, vars?: Record<string, string>): string {
  let s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  }
  return s;
}
