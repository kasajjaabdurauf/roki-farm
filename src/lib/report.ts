// ------------------------------------------------------------------
// Roki — professional PDF summary report (admin).
// Generates a branded, print-ready report of the whole platform:
// overview KPIs, production forecast, location mapping, tier-1
// farmer list. Loaded on demand (dynamic import) so it never bloats
// the main bundle.
// ------------------------------------------------------------------

import type { Db } from "./types";
import { MONTHS } from "./reference";
import { isoDaysAgo } from "./format";

const FOREST: [number, number, number] = [27, 67, 50]; // #1b4332
const OCHRE: [number, number, number] = [217, 119, 6]; // #d97706
const CREAM: [number, number, number] = [250, 250, 249];

export async function downloadSummaryPdf(db: Db): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // ------------------------------------------------------------------
  // Header band
  // ------------------------------------------------------------------
  doc.setFillColor(...FOREST);
  doc.rect(0, 0, pageW, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("ROKI FRUIT & VEGETABLES LTD", 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(240, 231, 211);
  doc.text("Farm Platform Summary Report", 14, 21);
  const today = new Date();
  doc.text(
    `Generated ${today.toISOString().slice(0, 10)} at ${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`,
    14,
    27
  );
  doc.setFillColor(...OCHRE);
  doc.rect(0, 34, pageW, 1.6, "F");

  let y = 42;

  // ------------------------------------------------------------------
  // Overview stats (two-column stat grid)
  // ------------------------------------------------------------------
  const since90 = isoDaysAgo(90);
  const recentLogs = db.logs.filter((l) => l.harvestDate >= since90);
  const totalKg = recentLogs.reduce((s, l) => s + l.quantityKg, 0);
  const refugee = db.farmers.filter((f) => f.refugeeStatus === "REFUGEE").length;
  const host = db.farmers.filter((f) => f.refugeeStatus === "HOST").length;
  const women = db.farmers.filter((f) => f.gender === "F").length;
  const t1 = db.farmers.filter((f) => f.rokiTier === 1).length;
  const t2 = db.farmers.filter((f) => f.rokiTier === 2).length;
  const t3 = db.farmers.filter((f) => f.rokiTier === 3).length;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...FOREST);
  doc.text("1 · Overview", 14, y);

  const stats: [string, string][] = [
    ["Total registered farmers", String(db.farmers.length)],
    ["Refugee / host", `${refugee} / ${host}`],
    ["Women farmers", `${women} (${db.farmers.length ? Math.round((women / db.farmers.length) * 100) : 0}%)`],
    ["Tier 1 · Export-ready", String(t1)],
    ["Tier 2 · Developing", String(t2)],
    ["Tier 3 · New (support)", String(t3)],
    ["Harvest logs (90 d)", String(recentLogs.length)],
    ["Produce (90 d)", `${(totalKg / 1000).toFixed(0)} t`],
  ];

  let col = 0;
  for (const [label, value] of stats) {
    const x = 14 + col * (pageW / 2 - 14);
    doc.setFillColor(...CREAM);
    doc.roundedRect(x, y + 4, pageW / 2 - 22, 16, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.text(label, x + 4, y + 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...FOREST);
    doc.text(value, x + 4, y + 17.5);
    col = col === 0 ? 1 : 0;
    if (col === 0) y += 22;
  }
  y += 10;

  // ------------------------------------------------------------------
  // Production forecast table
  // ------------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...FOREST);
  doc.text("2 · Production forecast", 14, y);

  const byCrop = new Map<string, { farmers: Set<string>; kg: number; start: number; end: number }>();
  for (const f of db.farmers) {
    for (const p of f.plannedProductions) {
      if (!p.crop) continue;
      const e = byCrop.get(p.crop) ?? { farmers: new Set<string>(), kg: 0, start: 12, end: 1 };
      e.farmers.add(f.id);
      e.kg += p.expectedVolumeKg || 0;
      e.start = Math.min(e.start, p.harvestStartMonth);
      e.end = Math.max(e.end, p.harvestEndMonth);
      byCrop.set(p.crop, e);
    }
  }
  const rows = [...byCrop.entries()]
    .map(([crop, e]) => [crop, String(e.farmers.size), `${(e.kg / 1000).toFixed(0)} t`, `${MONTHS[e.start - 1]}–${MONTHS[e.end - 1]}`])
    .sort((a, b) => Number(b[2].replace(" t", "")) - Number(a[2].replace(" t", "")))
    .slice(0, 12);

  if (rows.length > 0) {
    autoTable(doc, {
      startY: y + 4,
      head: [["Crop", "Farmers producing", "Expected volume", "Harvest period"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: FOREST, textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [244, 247, 245] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No production plans recorded yet.", 14, y + 6);
    y += 12;
  }

  // ------------------------------------------------------------------
  // Location mapping table
  // ------------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...FOREST);
  doc.text("3 · Farmer location mapping", 14, y);

  const byDistrict = new Map<string, number>();
  for (const f of db.farmers) byDistrict.set(f.district, (byDistrict.get(f.district) ?? 0) + 1);
  const locRows = [...byDistrict.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([d, n], i) => [String(i + 1), d, String(n)]);

  if (locRows.length > 0) {
    autoTable(doc, {
      startY: y + 4,
      head: [["#", "District", "Farmers"]],
      body: locRows,
      theme: "grid",
      headStyles: { fillColor: OCHRE, textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [253, 248, 239] },
      margin: { left: 14, right: 14 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: "auto" }, 2: { cellWidth: 30, halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    y += 6;
  }

  // ------------------------------------------------------------------
  // Tier-1 shortlist
  // ------------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...FOREST);
  doc.text("4 · Export-ready farmers (Tier 1)", 14, y);

  const tier1Farmers = db.farmers
    .filter((f) => f.rokiTier === 1)
    .sort((a, b) => b.plannedProductions.reduce((s, p) => s + (p.expectedVolumeKg || 0), 0) - a.plannedProductions.reduce((s, p) => s + (p.expectedVolumeKg || 0), 0))
    .slice(0, 12)
    .map((f) => [f.id, f.fullName, f.district, `${(f.plannedProductions.reduce((s, p) => s + (p.expectedVolumeKg || 0), 0) / 1000).toFixed(0)} t`]);

  if (tier1Farmers.length > 0) {
    autoTable(doc, {
      startY: y + 4,
      head: [["Farmer ID", "Name", "District", "Planned volume"]],
      body: tier1Farmers,
      theme: "grid",
      headStyles: { fillColor: FOREST, textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [244, 247, 245] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No Tier-1 farmers yet.", 14, y + 6);
    y += 12;
  }

  // ------------------------------------------------------------------
  // Footer
  // ------------------------------------------------------------------
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...FOREST);
  doc.rect(0, pageH - 12, pageW, 12, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(240, 231, 211);
  doc.text(
    `Roki Fruit & Vegetables Ltd · ${db.farmers.length} farmers · ${db.logs.length} logs · deterministic rule engine · zero AI`,
    14,
    pageH - 5
  );

  doc.save(`roki-summary-report-${today.toISOString().slice(0, 10)}.pdf`);
}
