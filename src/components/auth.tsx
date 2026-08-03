"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { bootstrapRemote } from "@/lib/db";
import { getSession, onAuthChange, remoteConfigured } from "@/lib/remote";
import { LogoMark } from "./brand";

/**
 * Production-mode gate: when Supabase is configured, the app requires a
 * session. Redirects to /login, bootstraps the local store from the
 * cloud after sign-in, and reacts to sign-out events.
 * In demo mode this component is a no-op pass-through.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (!remoteConfigured()) {
      setReady(true);
      return;
    }
    if (checked.current) return;
    checked.current = true;

    let cancelled = false;
    getSession().then((s) => {
      if (cancelled) return;
      if (s) {
        void bootstrapRemote().catch(() => {});
      } else if (pathname !== "/login") {
        router.replace("/login");
      }
      setReady(true);
    });

    const sub = onAuthChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        void bootstrapRemote().catch(() => {});
        if (pathname === "/login") router.replace("/");
      } else if (event === "SIGNED_OUT") {
        if (pathname !== "/login") router.replace("/login");
      } else if (event === "TOKEN_REFRESHED" && session) {
        void bootstrapRemote().catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      sub?.data?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <LogoMark className="h-12 w-auto" />
          <p className="text-sm font-semibold text-stone-400">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
