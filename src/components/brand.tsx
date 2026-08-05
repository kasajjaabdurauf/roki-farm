"use client";

import { cx } from "@/lib/format";

/**
 * Roki Fruit & Vegetables brand mark — official company logo artwork.
 * `compact` is used in the mobile header: logo + short name so the
 * header never feels empty.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/brand-logo.png"
      alt="Roki Fruit & Vegetables"
      width={132}
      height={120}
      draggable={false}
      className={cx("h-11 w-auto shrink-0 object-contain sm:h-12", className)}
    />
  );
}

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-tight">
        {compact ? (
          <>
            <p className="font-display text-lg font-bold tracking-tight text-forest-900">Roki</p>
            <p className="text-[10px] font-semibold tracking-wide text-ochre-600 uppercase">
              Fruit &amp; Vegetables
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-[17px] font-bold tracking-tight text-forest-900">Roki</p>
            <p className="text-[10px] font-medium tracking-wide text-ochre-600 uppercase">
              Fruit &amp; Vegetables Ltd
            </p>
          </>
        )}
      </div>
    </div>
  );
}
