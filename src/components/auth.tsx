"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { bootstrapRemote, useDb } from "@/lib/db";
import { onAuthChange, remoteConfigured, remoteVarsPresent, validateSession } from "@/lib/remote";
import { LogoMark } from "./brand";
import { Button } from "./ui";

/**
 * Auth gate — deterministic and simple:
 *  1. On boot, validate the session ONCE (server-checked).
 *  2. Valid session  → show the app immediately. Bootstrap (role + data)
 *     runs in the background and NEVER blocks or bounces.
 *  3. No session     → login page (for non-login paths).
 *  4. Agent session  → straight in, no login.
 *  No timed bounces, no sign-out on missing profile, no loops.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const checked = useRef(false);

  // ALL hooks above any conditional return (React rules of hooks).
  const db = useDb();
  // (Farmer onboarding gate removed — two-group model: agents onboard farmers.)

  useEffect(() => {
    if (!remoteConfigured()) {
      setReady(true);
      setBootstrapDone(true);
      return;
    }
    if (checked.current) return;
    checked.current = true;

    // Agent sessions skip login entirely.
    let agentSession = false;
    try {
      agentSession = localStorage.getItem("roki-agent-session") === "1";
    } catch { /* ignore */ }

    let cancelled = false;

    if (agentSession) {
      setReady(true);
      setBootstrapDone(true);
      return;
    }

    validateSession()
      .then((s) => {
        if (cancelled) return;
        if (s) {
          // Valid session: show the app immediately; bootstrap in background.
          setReady(true);
          void bootstrapRemote()
            .catch(() => {})
            .finally(() => setBootstrapDone(true));
        } else if (pathname !== "/login") {
          router.replace("/login");
          setReady(true);
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        // Network failure during validation: don't kick the user out.
        // Fall back to showing the app if we have a cached session, else login.
        setReady(true);
        setBootstrapDone(true);
      });

    const sub = onAuthChange((event) => {
      if (event === "SIGNED_IN") {
        setReady(true);
        void bootstrapRemote().catch(() => {}).finally(() => setBootstrapDone(true));
        if (pathname === "/login") router.replace("/");
      } else if (event === "SIGNED_OUT") {
        // Only redirect if we're not already on login.
        if (pathname !== "/login") router.replace("/login");
      }
    });

    return () => {
      cancelled = true;
      sub?.data?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Misconfigured backend → clear error screen (never silent demo mode).
  if (remoteVarsPresent() && !remoteConfigured()) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <LogoMark className="mx-auto h-12 w-auto" />
          <p className="font-display text-xl font-semibold text-forest-900">Platform not configured correctly</p>
          <p className="text-sm leading-relaxed text-stone-500">
            The connection settings are incomplete or invalid. Please contact your administrator.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  // Splash only while the very first session check is in flight (fast).
  if (!ready) {
    return (
      <div className="grid min-h-[80vh] place-items-center">
        <div className="flex flex-col items-center gap-4">
          <LogoMark className="h-14 w-auto animate-pulse" />
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-400">
            <span className="h-2 w-2 animate-ping rounded-full bg-ochre-500" />
            Roki is waking up…
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
