"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { bootstrapRemote, useDb } from "@/lib/db";
import { getSession, onAuthChange, remoteConfigured, remoteVarsPresent } from "@/lib/remote";
import { LogoMark } from "./brand";
import { Button } from "./ui";

/**
 * Production-mode gate: when Supabase is configured, the app requires a
 * session. Redirects to /login, bootstraps the local store from the
 * cloud after sign-in, and reacts to sign-out events.
 * In preview mode (no backend configured) this component is a no-op pass-through.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const checked = useRef(false);

  // ALL hooks above any conditional return (React rules of hooks):
  // a return between hooks would trigger error #300 on re-render.
  useEffect(() => {
    if (!remoteConfigured()) {
      setReady(true);
      return;
    }
    if (checked.current) return;
    checked.current = true;

    // field-agent access-code sessions skip the login redirect entirely
    let agentSession = false;
    try {
      agentSession = localStorage.getItem("roki-agent-session") === "1";
    } catch { /* ignore */ }
    if (agentSession) {
      setReady(true);
      return;
    }

    let cancelled = false;
    getSession()
      .then((s) => {
        if (cancelled) return;
        if (s) {
          void bootstrapRemote().catch(() => {});
        } else if (pathname !== "/login") {
          router.replace("/login");
        }
        setReady(true);
      })
      .catch(() => setReady(true)); // never leave the user stuck on the splash

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

  // Security: if backend vars are SET but invalid (misconfiguration),
  // show a clear config error instead of silently serving demo data.
  if (remoteVarsPresent() && !remoteConfigured()) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <LogoMark className="mx-auto h-12 w-auto" />
          <p className="font-display text-xl font-semibold text-forest-900">Platform not configured correctly</p>
          <p className="text-sm leading-relaxed text-stone-500">
            The connection settings are incomplete or invalid. Please contact your administrator.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              try {
                localStorage.removeItem("sb-" + process.env.NEXT_PUBLIC_SUPABASE_URL);
              } catch { /* ignore */ }
              window.location.reload();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // auto-nudge: signed-in farmer with no farmer record → point at the survey
  const db = useDb();
  const needsSurvey = ready && db.meta.role === "FARMER" && !db.meta.demoFarmerId && pathname === "/";
  useEffect(() => {
    if (needsSurvey) {
      try {
        if (!localStorage.getItem("roki-survey-nudged")) {
          localStorage.setItem("roki-survey-nudged", "1");
          window.location.href = "/survey";
        }
      } catch { /* ignore */ }
    }
  }, [needsSurvey]);

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
