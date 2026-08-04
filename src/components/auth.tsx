"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { bootstrapRemote, useDb } from "@/lib/db";
import { getSession, onAuthChange, remoteConfigured, remoteVarsPresent, validateSession } from "@/lib/remote";
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
    validateSession()
      .then((s) => {
        if (cancelled) return;
        if (s) {
          // Always reconcile role + farmer link on every boot (not just
          // sign-in) so a stale local role/demoFarmerId can never show
          // the wrong dashboard.
          void bootstrapRemote().catch(() => {});
        } else if (pathname !== "/login") {
          // no valid session (or the account was deleted): back to sign-in
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

  // MANDATORY onboarding survey: a signed-in farmer whose own record has
  // not completed the survey is held at /survey until it's done.
  const db = useDb();
  const ownFarmer = db.farmers.find((f) => f.id === db.meta.demoFarmerId);
  const surveyDone =
    !!ownFarmer && !!ownFarmer.survey?.consentDate && ownFarmer.plannedProductions.length > 0;
  // While the farmer record is still loading (just after sign-in) show a
  // splash instead of flashing the home page then bouncing to /survey.
  const profilePending = ready && remoteConfigured() && db.meta.role === "FARMER" && !ownFarmer;
  const needsSurvey =
    ready && remoteConfigured() && db.meta.role === "FARMER" && !!ownFarmer && !surveyDone;

  useEffect(() => {
    if (!needsSurvey) return;
    if (pathname !== "/survey" && pathname !== "/login" && pathname !== "/reset-password") {
      router.replace("/survey");
    }
  }, [needsSurvey, pathname, router]);

  // Profile still loading after sign-in: hold the splash (prevents the
  // "home flashes, then back to onboarding" flicker).
  if (profilePending) {
    return (
      <div className="grid min-h-[80vh] place-items-center">
        <div className="flex flex-col items-center gap-4">
          <LogoMark className="h-14 w-auto animate-pulse" />
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-400">
            <span className="h-2 w-2 animate-ping rounded-full bg-ochre-500" />
            Loading your profile…
          </div>
        </div>
      </div>
    );
  }

  // The splash only blocks OTHER pages — the /survey page itself must
  // render so the farmer can actually complete it (this was the "stuck
  // on Setting up your farmer profile" bug).
  if (needsSurvey && pathname !== "/survey") {
    return (
      <div className="grid min-h-[80vh] place-items-center">
        <div className="flex flex-col items-center gap-4">
          <LogoMark className="h-14 w-auto animate-pulse" />
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-400">
            <span className="h-2 w-2 animate-ping rounded-full bg-ochre-500" />
            Setting up your farmer profile…
          </div>
        </div>
      </div>
    );
  }

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
