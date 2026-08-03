"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarRange,
  CloudOff,
  CloudUpload,
  Download,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  UserCircle2,
  Sprout,
  Table2,
  Truck,
  UploadCloud,
  Users,
  Wifi,
  Leaf,
  ShieldCheck,
  Home,
  X,
} from "lucide-react";
import { cx } from "@/lib/format";
import { flushOutbox, pendingSync, useDb } from "@/lib/db";
import { downloadMasterBackup, stamp } from "@/lib/export";
import { remoteConfigured } from "@/lib/remote";
import { type Role } from "@/lib/types";
import { Wordmark } from "./brand";
import { AuthGate } from "./auth";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  roles: Role[];
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["ADMIN", "FIELD_AGENT", "FARMER"] },
  { href: "/farm", label: "My Farm", icon: <Home className="h-5 w-5" />, roles: ["FARMER"] },
  { href: "/forecast", label: "Forecast", icon: <CalendarRange className="h-5 w-5" />, roles: ["ADMIN", "FIELD_AGENT"] },
  { href: "/supply", label: "Supply", icon: <Truck className="h-5 w-5" />, roles: ["ADMIN", "FIELD_AGENT"] },
  { href: "/farmers", label: "Farmers", icon: <Users className="h-5 w-5" />, roles: ["ADMIN", "FIELD_AGENT"] },
  { href: "/logs", label: "Harvest Logs", icon: <Sprout className="h-5 w-5" />, roles: ["ADMIN", "FIELD_AGENT", "FARMER"] },
  { href: "/upload", label: "Bulk Upload", icon: <UploadCloud className="h-5 w-5" />, roles: ["ADMIN", "FIELD_AGENT"] },
  { href: "/grid", label: "Data Grid", icon: <Table2 className="h-5 w-5" />, roles: ["ADMIN", "FIELD_AGENT"] },
  { href: "/settings", label: "Settings", icon: <Settings className="h-5 w-5" />, roles: ["ADMIN"] },
  { href: "/help", label: "Help & Guide", icon: <BookOpen className="h-5 w-5" />, roles: ["ADMIN", "FIELD_AGENT", "FARMER"] },
  { href: "/account", label: "Account", icon: <UserCircle2 className="h-5 w-5" />, roles: ["ADMIN", "FIELD_AGENT", "FARMER"] },
];

const isRemote = remoteConfigured();

const TITLES: Record<string, string> = {
  "/": "Farmer Dashboard",
  "/farm": "My Farm",
  "/forecast": "Production Forecast",
  "/supply": "Export Supply Planning",
  "/farmers": "Farmer Profiles",
  "/farmers/new": "Register Farmer",
  "/logs": "Harvest Logs",
  "/upload": "Bulk Upload & Mapping",
  "/grid": "Data Grid & Export",
  "/settings": "Settings",
  "/help": "Help & Guide",
  "/account": "Account",
};

function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function SyncChip({ compact }: { compact?: boolean }) {
  const db = useDb();
  const online = useOnline();
  const pending = pendingSync(db);
  useEffect(() => {
    if (online && pending > 0) flushOutbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, pending]);
  const syncing = pending > 0 && !isRemote;

  const textClass = compact ? "hidden min-[400px]:inline" : "";

  if (!online) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-2.5 py-1.5 text-[12px] font-semibold text-danger-dark ring-1 ring-inset ring-danger/30"
        title={pending > 0 ? `Offline · ${pending} pending sync` : "Offline"}
      >
        <CloudOff className="h-4 w-4" />
        <span className={textClass}>{pending > 0 ? `${pending} pending sync` : "Offline"}</span>
      </span>
    );
  }
  if (pending > 0) {
    return (
      <button
        onClick={() => flushOutbox()}
        className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1.5 text-[12px] font-semibold text-warning-dark ring-1 ring-inset ring-warning/30 hover:bg-warning/20"
        title="Click to flush the sync queue"
      >
        <CloudUpload className="h-4 w-4" />
        <span className={textClass}>{pending} pending sync</span>
      </button>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1.5 text-[12px] font-semibold text-success-dark ring-1 ring-inset ring-success/30"
      title="All synced"
    >
      <Wifi className="h-4 w-4" />
      <span className={textClass}>All synced</span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const db = useDb();
  const pathname = usePathname();
  const role = db.meta.role;
  const online = useOnline();
  const [moreOpen, setMoreOpen] = useState(false);

  // the sign-in screen is standalone: no header, no bottom nav, no brand strip
  if (pathname === "/login") return <>{children}</>;

  function masterBackup() {
    const nameOf = (id: string) => db.farmers.find((f) => f.id === id)?.fullName ?? "Unknown";
    downloadMasterBackup(db.farmers, db.logs, nameOf, `roki-master-backup-${stamp("backup")}.xlsx`);
  }

  const items = useMemo(() => NAV.filter((n) => n.roles.includes(role)), [role]);
  const title = TITLES[pathname] ?? "Roki";

  const showMore = items.length > 5;
  const primaryItems = showMore ? items.slice(0, 4) : items;
  const moreItems = showMore ? items.slice(4) : [];

  return (
    <div className="min-h-screen lg:pl-64">
      {/* ------------------------------------------------ sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-stone-200 bg-white lg:flex">
        <div className="border-b border-stone-100 px-5 py-5">
          <Wordmark />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex min-h-[48px] items-center gap-3 rounded-xl px-3.5 text-[14px] font-semibold transition-colors",
                  active
                    ? "bg-forest-800 text-white shadow-sm"
                    : "text-stone-600 hover:bg-forest-50 hover:text-forest-800"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-stone-100 px-5 py-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-forest-50 px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-forest-700" />
            <p className="text-[11px] leading-snug font-medium text-forest-800">
              Rule engine active, deterministic validation, zero AI
            </p>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------ main column */}
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-cream pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:h-16">
            <div className="flex items-center gap-3 lg:hidden">
              <Wordmark compact />
            </div>
            <h1 className="hidden font-display text-xl font-semibold text-forest-900 lg:block">{title}</h1>
            <div className="flex items-center gap-2">
              <div className="hidden lg:block">
                <SyncChip />
              </div>
              <div className="lg:hidden">
                <SyncChip compact />
              </div>
              {isRemote && (
                <RemoteUserChip />
              )}
              {!isRemote && role === "ADMIN" && (
                <button
                  onClick={masterBackup}
                  className="hidden h-11 items-center gap-1.5 rounded-xl px-3 text-[12px] font-semibold text-stone-600 hover:bg-stone-100 xl:flex"
                  title="Download master backup (farmers + harvest logs)"
                >
                  <Download className="h-4 w-4" /> Master backup
                </button>
              )}
              {role === "ADMIN" && (
                <Link
                  href="/settings"
                  className={cx(
                    "grid h-11 w-11 place-items-center rounded-xl text-stone-500 hover:bg-stone-100 lg:hidden",
                    pathname.startsWith("/settings") && "bg-forest-50 text-forest-800"
                  )}
                  aria-label="Settings"
                >
                  <Settings className="h-5 w-5" />
                </Link>
              )}
            </div>
          </div>

          <div className="border-t border-stone-200/70 bg-white px-4 py-2 sm:px-6 lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[13px] font-semibold text-stone-600">
                {isRemote ? (
                  <RemoteUserChip compact />
                ) : (
                  <span className="text-stone-400">Demo mode · manage roles in Account</span>
                )}
              </span>
            </div>
          </div>

          {!online && (
            <div className="flex items-center justify-center gap-1.5 bg-danger-500 px-4 py-2 text-center text-[12px] font-semibold text-white">
              <CloudOff className="h-3.5 w-3.5 shrink-0" />
              Offline, your entries are saved on this device and will sync when you're back online
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:pb-10">{children}</main>

        {/* bottom nav (mobile / tablet), sticky & in-flow */}
        <nav
          className="sticky bottom-0 z-40 border-t border-stone-200 bg-white lg:hidden"
          aria-label="Primary"
        >
          <div
            className="mx-auto grid max-w-lg pb-[env(safe-area-inset-bottom)]"
            style={{ gridTemplateColumns: `repeat(${primaryItems.length + (showMore ? 1 : 0)}, minmax(0, 1fr))` }}
          >
            {primaryItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "flex min-w-0 flex-col items-center gap-0.5 py-1.5 text-[10px] font-semibold transition-colors",
                    active ? "text-forest-800" : "text-stone-400"
                  )}
                >
                  <span
                    className={cx(
                      "grid h-9 w-14 place-items-center rounded-full transition-colors",
                      active ? "bg-forest-50" : ""
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="max-w-full truncate px-1">{item.label}</span>
                </Link>
              );
            })}
            {showMore && (
              <button
                onClick={() => setMoreOpen(true)}
                className="flex min-w-0 flex-col items-center gap-0.5 py-1.5 text-[10px] font-semibold text-stone-400"
                aria-label="More"
              >
                <span className="grid h-9 w-14 place-items-center rounded-full">
                  <MoreHorizontal className="h-5 w-5" />
                </span>
                <span className="max-w-full truncate px-1">More</span>
              </button>
            )}
          </div>
        </nav>

        {/* More sheet */}
        {moreOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-forest-950/50" onClick={() => setMoreOpen(false)} />
            <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white pt-[env(safe-area-inset-top)] shadow-pop">
              <span className="mx-auto mt-2 mb-1 block h-1 w-10 rounded-full bg-stone-200" aria-hidden="true" />
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
                <p className="font-display text-base font-semibold text-forest-900">More</p>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-xl text-stone-500 hover:bg-stone-100"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 p-4 pb-[env(safe-area-inset-bottom)]">
                {moreItems.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cx(
                        "flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-2 py-4 text-[11px] font-semibold",
                        active ? "bg-forest-50 text-forest-800" : "text-stone-500 hover:bg-stone-50"
                      )}
                    >
                      {item.icon}
                      <span className="text-center">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Remote-mode user chip: email + sign out. */
function RemoteUserChip({ compact }: { compact?: boolean }) {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    getSessionEmail().then(setEmail);
  }, []);
  if (compact) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[12px] font-semibold text-stone-500">{email ?? "Signed in"}</span>
      </span>
    );
  }
  return (
    <span className="hidden items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1.5 text-[12px] font-semibold text-forest-800 lg:inline-flex">
      <span className="max-w-[180px] truncate">{email ?? "Signed in"}</span>
    </span>
  );
}

async function getSessionEmail(): Promise<string | null> {
  const { getSession } = await import("@/lib/remote");
  const s = await getSession();
  return s?.user?.email ?? null;
}

export function PwaHint({ className }: { className?: string }) {
  return (
    <p className={cx("flex items-center gap-1.5 text-[11px] text-stone-400", className)}>
      <Leaf className="h-3.5 w-3.5" />
      Installable PWA, add to home screen for offline field use
    </p>
  );
}
