"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarRange,
  ChevronDown,
  ClipboardPlus,
  CloudUpload,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  Search,
  Settings,
  Sprout,
  Table2,
  Truck,
  UploadCloud,
  UserPlus,
  Users,
  Wheat,
} from "lucide-react";
import { Card } from "@/components/ui";
import { cx } from "@/lib/format";

const GUIDE_SECTIONS = [
  {
    title: "Farmer Dashboard",
    desc: "Your home screen — totals, refugee vs host split, gender mix, location map and farmer scoring tiers.",
    href: "/",
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ["All roles"],
  },
  {
    title: "Farmer registration survey",
    desc: "The full 15-section questionnaire: bio-data, refugee status, experience, land, current crops, capacity, inputs, market, Roki interest, consent.",
    href: "/farmers/new",
    icon: <UserPlus className="h-5 w-5" />,
    roles: ["Admin", "Field agent"],
  },
  {
    title: "Farmer profiles",
    desc: "Search every surveyed farmer; open a profile to see the survey record, production plan and Roki score.",
    href: "/farmers",
    icon: <Users className="h-5 w-5" />,
    roles: ["Admin", "Field agent"],
  },
  {
    title: "Harvest logs",
    desc: "Record what was harvested, when and at what grade — with instant rule-engine checks. Also where you review flagged entries.",
    href: "/logs",
    icon: <Sprout className="h-5 w-5" />,
    roles: ["All roles"],
  },
  {
    title: "Production forecast",
    desc: "Who is growing what, expected volumes and harvest periods — built from the surveys' production plans.",
    href: "/forecast",
    icon: <CalendarRange className="h-5 w-5" />,
    roles: ["Admin", "Field agent"],
  },
  {
    title: "Export supply planning",
    desc: "The farmer-by-farmer supply list: crop, location, harvest window, volume. Filter by tier/district/crop and export.",
    href: "/supply",
    icon: <Truck className="h-5 w-5" />,
    roles: ["Admin", "Field agent"],
  },
  {
    title: "Bulk upload",
    desc: "Drag in an Excel/CSV file — columns are auto-mapped, errors highlighted, then imported in one click.",
    href: "/upload",
    icon: <UploadCloud className="h-5 w-5" />,
    roles: ["Admin", "Field agent"],
  },
  {
    title: "Data grid & export",
    desc: "The full database as an editable spreadsheet: inline editing, sorting, filters, bulk actions, CSV/Excel export.",
    href: "/grid",
    icon: <Table2 className="h-5 w-5" />,
    roles: ["Admin", "Field agent"],
  },
  {
    title: "Settings",
    desc: "Rule-engine switches, per-crop thresholds, data management and master backups. Admin only.",
    href: "/settings",
    icon: <Settings className="h-5 w-5" />,
    roles: ["Admin"],
  },
];

const QUICK_TASKS = [
  { title: "Register a farmer (the survey)", steps: ["Go to Farmers → New Survey (or press the + button).", "Complete the 9 steps — each one is a section of Roki's official questionnaire.", "Review the summary, check consent is ticked, press Complete registration.", "The system assigns RFV-UG-XXXXX, tags the tier and saves the survey."], href: "/farmers/new" },
  { title: "Log a harvest", steps: ["Open Harvest Logs.", "Pick the farmer, crop, quantity (kg / bags / crates / tonnes), grade and date.", "Press Save — the rule engine checks the entry instantly and tells you if anything needs audit."], href: "/logs" },
  { title: "Upload a spreadsheet", steps: ["Open Bulk Upload.", "Drag a .xlsx / .xls / .csv file onto the drop zone (or tap to browse).", "Check the column mapping and the staging grid — red rows have errors and are skipped.", "Press Import."], href: "/upload" },
  { title: "Export data", steps: ["Open Data Grid (or the Forecast / Supply tabs for their exports).", "Filter the rows you want.", "Press CSV or Excel — the download matches exactly what's on screen.", "Admins can also grab the full Master backup from the header or Settings."], href: "/grid" },
  { title: "Review rule-engine findings", steps: ["Open the Dashboard and look at 'Rule engine findings'.", "Items marked Needs Audit breached a yield ceiling; Flagged items are possible duplicates.", "Open the log, verify the numbers, and edit or delete it from the Data Grid / logs page."], href: "/" },
  { title: "Install the app on your phone", steps: ["Open the app in Chrome (Android) or Safari (iPhone).", "Android: menu ⋮ → 'Add to Home screen'. iPhone: Share → 'Add to Home Screen'.", "Launch it from the home screen — it works offline in the field."], href: "/" },
];

const FAQS: { q: string; a: string; audience: "Admin" | "Field agent" | "Farmer" | "Everyone" }[] = [
  { audience: "Everyone", q: "Is this AI?", a: "No. Every check, score and summary is a fixed, explainable rule — there is no AI. If the system flags something, the exact rule that fired is shown on the record." },
  { audience: "Admin", q: "How do the farmer tiers work?", a: "Tier 1 (Export-ready): at least 3 acres, 6+ harvest logs, and verified Grade-A produce in the last 180 days. Tier 2 (Developing): at least 1.5 acres and 3+ logs. Tier 3 (New): everyone else. Tiers recalculate automatically as harvests are logged." },
  { audience: "Admin", q: "How do I change what the rule engine flags?", a: "Settings → Rule engine switches lets you turn each rule on/off, and Per-crop thresholds lets you adjust the kg-per-acre ceilings and baselines. Changes re-run the engine over existing logs instantly." },
  { audience: "Admin", q: "Where is the data backed up?", a: "The database lives in Supabase (cloud). A nightly automation emails a full Excel backup to the admin inbox, and the keep-alive job prevents the free database from pausing. You can also download a Master backup anytime from the header or Settings." },
  { audience: "Admin", q: "How do I give someone access?", a: "Create an account for them (they sign up or you set a password). Then update their role in Supabase: ADMIN for full access, FIELD_AGENT for field work, FARMER for the farmer view. Roles control exactly what each person sees (row-level security)." },
  { audience: "Admin", q: "How do I import my existing farmer list?", a: "Export your list to Excel/CSV with columns like Farmer Name, Phone, District, Sub-County, Crop, Qty, Date. Open Bulk Upload, drag the file in, confirm the auto-mapping, review the staging grid, and import. Rows with errors are listed so you can fix and re-import them." },
  { audience: "Field agent", q: "I'm offline in the field — will my entries be lost?", a: "No. Everything is saved on the device first. The status chip shows 'N pending sync' and your entries push to the cloud automatically when you're back online. You can also tap the chip to sync immediately." },
  { audience: "Field agent", q: "A farmer in my batch has no phone — can I still register them?", a: "Yes, but their profile will be flagged 'Incomplete profile' so the admin knows to follow up. Phone is strongly recommended since it's how Roki will reach them." },
  { audience: "Field agent", q: "What do the red rows in the upload staging grid mean?", a: "Red rows failed validation (bad phone, negative quantity, missing farmer, unreadable date). They are excluded from the import automatically — you can fix the file and re-upload." },
  { audience: "Farmer", q: "How do I log my harvest?", a: "Open Harvest Logs (or 'Log Harvest' on your dashboard), choose the crop, quantity and date, and save. You'll immediately see if the entry passed the checks." },
  { audience: "Farmer", q: "Can I see my own information?", a: "Yes — My Farm shows your profile, your scale tier, and your harvest history. In production mode you only ever see your own data." },
  { audience: "Farmer", q: "Who can see my information?", a: "Only the Roki team (admins and field agents) and you. The system uses row-level security, and the questionnaire consent you signed is stored with your record." },
  { audience: "Everyone", q: "I see 'Needs Audit' on one of my entries — what now?", a: "It just means the quantity looks higher than the expected ceiling for that crop and farm size. An admin will review it; if it's a typo it can be corrected. No action needed from you." },
];

const GLOSSARY: { term: string; def: string }[] = [
  { term: "RFV-UG-XXXXX", def: "System farmer ID — auto-generated, unique, never reused." },
  { term: "Roki Tier (1/2/3)", def: "Export-readiness score from acreage, harvest activity and Grade-A volume. 1 = export-ready, 2 = developing, 3 = new." },
  { term: "Scale tier", def: "Farm-size tag: Micro < 2 ac, Mid-Scale 2–10 ac, Large-Scale > 10 ac." },
  { term: "Verified / Needs Audit / Flagged", def: "Log statuses from the rule engine: clean / above yield ceiling / possible duplicate." },
  { term: "Grade A / B / Reject", def: "Quality grade recorded at harvest — Grade A drives export-ready scoring." },
  { term: "Outbox & pending sync", def: "Changes made offline are queued on the device; the chip shows how many are waiting to reach the cloud." },
  { term: "Production plan", def: "The crops a farmer will grow for Roki (acres, expected volume, harvest months) — captured in the survey, powering the forecast." },
  { term: "Enumerator", def: "The field officer completing the registration survey with the farmer." },
  { term: "RLS", def: "Row-level security — the database rule that keeps each person's data limited to what their role allows." },
];

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [faqAudience, setFaqAudience] = useState<"All" | "Admin" | "Field agent" | "Farmer" | "Everyone">("All");
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const faqs = FAQS.filter((f) => faqAudience === "All" || f.audience === faqAudience || f.audience === "Everyone");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-forest-900">Help &amp; Guide</h2>
        <p className="mt-0.5 text-sm text-stone-500">
          Everything the platform does, how to use it, and answers to common questions. Tap any card to jump straight to that part of the app.
        </p>
      </div>

      {/* ------------------------- quick start ------------------------- */}
      <Card>
        <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
          <BookOpen className="h-5 w-5 text-ochre-500" /> Quick start
        </h3>
        <div className="grid gap-2.5 md:grid-cols-3">
          {QUICK_TASKS.slice(0, 3).map((t) => (
            <Link key={t.title} href={t.href} className="group rounded-2xl border border-stone-200 bg-stone-50/50 p-4 transition-colors hover:border-forest-300 hover:bg-forest-50/40">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-forest-800 group-hover:underline">
                <HelpCircle className="h-4 w-4 text-ochre-500" /> {t.title}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-stone-500">
                {t.steps.join(" ")}
              </p>
            </Link>
          ))}
        </div>
      </Card>

      {/* ------------------------- sections ------------------------- */}
      <div>
        <h3 className="mb-3 font-display text-lg font-semibold text-forest-900">Explore the app</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {GUIDE_SECTIONS.map((g) => (
            <Link key={g.title} href={g.href} className="card group flex items-start gap-3 p-4 transition-shadow hover:shadow-pop">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">{g.icon}</span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-stone-800 group-hover:text-forest-800">{g.title}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-stone-500">{g.desc}</span>
                <span className="mt-1 block text-[11px] font-semibold text-ochre-600">{g.roles.join(" · ")}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ------------------------- tasks ------------------------- */}
      <Card>
        <h3 className="mb-3 font-display text-lg font-semibold text-forest-900">Step-by-step tasks</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {QUICK_TASKS.map((t) => (
            <div key={t.title} className="rounded-2xl border border-stone-200 p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-stone-800">
                <ClipboardPlus className="h-4 w-4 text-ochre-500" /> {t.title}
              </p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-[12.5px] leading-relaxed text-stone-600">
                {t.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <Link href={t.href} className="mt-2 inline-block text-[12px] font-bold text-forest-700 underline">
                Open →
              </Link>
            </div>
          ))}
        </div>
      </Card>

      {/* ------------------------- FAQ ------------------------- */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
            <LifeBuoy className="h-5 w-5 text-ochre-500" /> Frequently asked questions
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(["All", "Admin", "Field agent", "Farmer", "Everyone"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setFaqAudience(a)}
                className={cx(
                  "h-9 rounded-full px-3.5 text-[12px] font-semibold transition-colors",
                  faqAudience === a ? "bg-forest-800 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-stone-100">
          {faqs.map((f, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left"
              >
                <span className="text-[13.5px] font-semibold text-stone-700">{f.q}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="hidden rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-400 uppercase sm:inline">
                    {f.audience}
                  </span>
                  <ChevronDown className={cx("h-4 w-4 text-stone-400 transition-transform", openFaq === i && "rotate-180")} />
                </span>
              </button>
              {openFaq === i && <p className="pb-4 text-[13px] leading-relaxed text-stone-600">{f.a}</p>}
            </div>
          ))}
        </div>
      </Card>

      {/* ------------------------- glossary ------------------------- */}
      <Card>
        <button onClick={() => setGlossaryOpen((v) => !v)} className="flex w-full items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
            <Search className="h-5 w-5 text-ochre-500" /> Glossary — what things mean
          </h3>
          <ChevronDown className={cx("h-4 w-4 text-stone-400 transition-transform", glossaryOpen && "rotate-180")} />
        </button>
        {glossaryOpen && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {GLOSSARY.map((g) => (
              <div key={g.term} className="rounded-xl bg-stone-50 px-3.5 py-2.5">
                <p className="font-mono text-[12px] font-bold text-forest-800">{g.term}</p>
                <p className="mt-0.5 text-[12.5px] text-stone-600">{g.def}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------- misc ------------------------- */}
      <Card className="border-dashed">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-forest-800"><Wheat className="h-4 w-4 text-ochre-500" /> Offline mode</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500">
              The app works without internet. Entries queue on the device ("N pending sync") and upload automatically when you're back online. Tap the sync chip to force it.
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-forest-800"><CloudUpload className="h-4 w-4 text-ochre-500" /> Demo mode</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500">
              Without an account you can explore with sample data using the role switcher in the header. Real data only appears after signing in.
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-forest-800"><LayoutDashboard className="h-4 w-4 text-ochre-500" /> More help</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500">
              The full manual lives in the project's <code className="rounded bg-stone-100 px-1 font-mono text-[11px]">ROKI-USER-MANUAL.md</code> — every feature explained in detail, kept in sync with each release.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
