"use client";

import { cx } from "@/lib/format";

/**
 * Roki Fruit & Vegetables brand mark — uses the official company logo
 * artwork (public/brand/brand-logo.png).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/brand-logo.png"
      alt="Roki Fruit & Vegetables"
      width={132}
      height={120}
      draggable={false}
      className={cx("h-9 w-auto shrink-0 object-contain", className)}
    />
  );
}

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-[15px] font-semibold tracking-tight text-forest-900">Roki</p>
          <p className="text-[10px] font-medium tracking-wide text-ochre-600 uppercase">Fruit &amp; Vegetables</p>
        </div>
      )}
    </div>
  );
}
