"use client";

import { cx } from "@/lib/format";
import {
  GRADE_LABEL,
  STATUS_LABEL,
  TIER_LABEL,
  YIELD_LABEL,
  type LogStatus,
  type QualityGrade,
  type ScaleTier,
  type YieldScore,
  type LogSource,
} from "@/lib/types";
import { Badge, type BadgeTone } from "./ui";

export function StatusBadge({ status, className }: { status: LogStatus; className?: string }) {
  const tone: BadgeTone = status === "VERIFIED" ? "success" : status === "NEEDS_AUDIT" ? "warning" : "danger";
  return (
    <Badge tone={tone} dot className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function TierBadge({ tier, className }: { tier: ScaleTier; className?: string }) {
  const tone: BadgeTone = tier === "MICRO" ? "neutral" : tier === "MID_SCALE" ? "forest" : "ochre";
  return (
    <Badge tone={tone} className={className}>
      {TIER_LABEL[tier]}
    </Badge>
  );
}

export function RokiTierBadge({ tier, className }: { tier: 1 | 2 | 3; className?: string }) {
  const tone: BadgeTone = tier === 1 ? "success" : tier === 2 ? "ochre" : "neutral";
  const label = tier === 1 ? "Tier 1 · Export-ready" : tier === 2 ? "Tier 2 · Developing" : "Tier 3 · New";
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}

export function GradeBadge({ grade }: { grade: QualityGrade }) {
  const tone: BadgeTone = grade === "A" ? "success" : grade === "B" ? "forest" : "danger";
  return <Badge tone={tone}>{GRADE_LABEL[grade]}</Badge>;
}

export function YieldBadge({ score }: { score: YieldScore }) {
  const tone: BadgeTone = score === "BUMPER" ? "success" : score === "LOW" ? "warning" : "neutral";
  return (
    <Badge tone={tone} className="uppercase">
      {YIELD_LABEL[score]}
    </Badge>
  );
}

export function SourceChip({ source }: { source: LogSource }) {
  const label: Record<LogSource, string> = {
    FIELD_AGENT: "Field agent",
    FARMER: "Farmer",
    ADMIN: "Admin",
    BULK_IMPORT: "Bulk import",
  };
  return (
    <span className={cx("text-[11px] font-semibold text-stone-400")}>{label[source]}</span>
  );
}
