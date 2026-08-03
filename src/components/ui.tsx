"use client";

import { cx } from "@/lib/format";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { X } from "lucide-react";

// ------------------------------------------------------------------
// Button
// ------------------------------------------------------------------
type ButtonVariant = "primary" | "accent" | "outline" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-forest-800 text-white hover:bg-forest-700 active:bg-forest-900 shadow-sm",
  accent: "bg-ochre-500 text-white hover:bg-ochre-600 active:bg-ochre-700 shadow-sm",
  outline: "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 active:bg-stone-100",
  ghost: "text-forest-800 hover:bg-forest-50",
  danger: "bg-danger-500 text-white hover:bg-danger-600 shadow-sm",
  success: "bg-success-500 text-white hover:bg-success-600 shadow-sm",
};

const BTN_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-5 text-base rounded-xl gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700",
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------
// Card / Stat
// ------------------------------------------------------------------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("card p-5", className)}>{children}</div>;
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "forest",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "forest" | "ochre" | "danger" | "warning" | "success";
  className?: string;
}) {
  const tones: Record<string, string> = {
    forest: "bg-forest-50 text-forest-800",
    ochre: "bg-ochre-50 text-ochre-700",
    danger: "bg-danger-50 text-danger-600",
    warning: "bg-warning-50 text-warning-700",
    success: "bg-success-50 text-success-700",
  };
  return (
    <div className={cx("card flex items-start gap-3 p-4 sm:gap-4 sm:p-5", className)}>
      {icon && <div className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11", tones[tone])}>{icon}</div>}
      <div className="min-w-0 flex-1">
        {/* labels wrap (never ellipsize) so cards are never "cut off" on narrow screens */}
        <p className="text-[12px] leading-snug font-medium text-stone-500 sm:text-[13px]">{label}</p>
        <p className="mt-0.5 font-display text-xl leading-tight font-semibold text-forest-900 tabular sm:text-2xl">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] leading-snug text-stone-500 sm:text-xs">{sub}</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Badge
// ------------------------------------------------------------------
export type BadgeTone = "neutral" | "forest" | "ochre" | "success" | "warning" | "danger";
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-stone-100 text-stone-600 ring-stone-200",
  forest: "bg-forest-50 text-forest-800 ring-forest-100",
  ochre: "bg-ochre-50 text-ochre-700 ring-ochre-100",
  success: "bg-success-bg text-success-dark ring-success/30",
  warning: "bg-warning-bg text-warning-dark ring-warning/30",
  danger: "bg-danger-bg text-danger-dark ring-danger/30",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        BADGE_TONES[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// ------------------------------------------------------------------
// Form controls (min 48px touch targets; height/width utilities in
// className always override the base size thanks to @layer components)
// ------------------------------------------------------------------
export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cx(
        "field-input",
        invalid ? "border-danger-500 ring-2 ring-danger-100" : "",
        className
      )}
      {...rest}
    />
  );
}

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cx(
        "field-select",
        invalid ? "border-danger-500 ring-2 ring-danger-100" : "",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-stone-600">
        <span>
          {label}
          {required && <span className="text-ochre-600"> *</span>}
        </span>
        {hint && <span className="font-normal text-stone-400">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-[13px] font-medium text-danger-600">{error}</span>}
    </label>
  );
}

// ------------------------------------------------------------------
// Toggle
// ------------------------------------------------------------------
export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl px-2 py-1.5 text-left hover:bg-stone-50"
    >
      <span>
        <span className="block text-sm font-semibold text-stone-700">{label}</span>
        {description && <span className="block text-[13px] text-stone-500">{description}</span>}
      </span>
      <span
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-forest-700" : "bg-stone-300"
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

// ------------------------------------------------------------------
// Modal
// ------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-forest-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cx(
          "relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-pop sm:rounded-2xl",
          "pt-[env(safe-area-inset-top)]",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        {/* mobile bottom-sheet grab handle */}
        <span className="mx-auto mt-2 mb-1 block h-1 w-10 shrink-0 rounded-full bg-stone-200 sm:hidden" aria-hidden="true" />
        <div className="sticky top-0 flex items-center justify-between border-b border-stone-100 bg-white/95 px-5 py-4 backdrop-blur">
          <h3 className="font-display text-lg font-semibold text-forest-900">{title}</h3>
          <button
            onClick={onClose}
            className="grid h-10 w-10 touch-target place-items-center rounded-xl text-stone-500 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-white px-5 py-4 mb-[env(safe-area-inset-bottom)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Empty state
// ------------------------------------------------------------------
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-forest-50 text-forest-700">{icon}</div>}
      <p className="font-display text-lg font-semibold text-forest-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ------------------------------------------------------------------
// Confirm dialog
// ------------------------------------------------------------------
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-stone-600">{message}</div>
    </Modal>
  );
}
