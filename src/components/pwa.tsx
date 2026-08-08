"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { loadDb, pendingSync } from "@/lib/db";
import { APP_VERSION } from "@/lib/format";

/**
 * Global error logger: captures any uncaught runtime error into
 * localStorage (for the error screen), sends it to Sentry when a DSN
 * is configured, and logs to the console.
 */
function ErrorLogger() {
  useEffect(() => {
    // Sentry (optional — only active when NEXT_PUBLIC_SENTRY_DSN is set)
    try {
      if (process.env.NEXT_PUBLIC_SENTRY_DSN && !Sentry.getClient()) {
        Sentry.init({
          dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
          tracesSampleRate: 0.1,
          environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "production",
        });
      }
    } catch { /* ignore */ }

    const onErr = (e: ErrorEvent) => {
      try {
        localStorage.setItem(
          "roki-last-error",
          `${e.message} @ ${e.filename ?? "?"}:${e.lineno ?? "?"}`
        );
        if (Sentry.getClient()) {
          Sentry.captureException(e.error ?? new Error(e.message));
        }
      } catch { /* ignore */ }
    };
    const onRej = (e: PromiseRejectionEvent) => {
      try {
        localStorage.setItem("roki-last-error", `Unhandled promise: ${String(e.reason ?? "unknown")}`);
        if (Sentry.getClient()) {
          Sentry.captureException(e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);
  return null;
}

/** True when this device has unsynced local changes (never interrupt those). */
function hasPendingChanges(): boolean {
  try {
    return pendingSync(loadDb()) > 0;
  } catch {
    return false;
  }
}

/** Ask the current server what version is deployed. */
async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null; // offline — skip silently
  }
}

/**
 * Registers the service worker and keeps the app on the LATEST build,
 * with zero user maintenance:
 *
 *  - Browsers check for an updated service worker (sw.js) automatically
 *    every time the app is opened (updateViaCache: "none" means the HTTP
 *    cache can never block it). The new SW installs, calls skipWaiting +
 *    clients.claim, and the page reloads into the new build.
 *  - Additionally the app polls /api/version every few minutes and on
 *    every foreground, and if the server has a newer version it triggers
 *    the update itself and shows an "Update now" banner.
 *  - The service worker also nudges open clients to reload once it takes
 *    over, so even an app that has been sitting open for days updates
 *    within minutes of a deploy.
 *
 * All of this works on OLD app versions too for the core path: the
 * browser-side SW update + reload does not depend on the app's own code.
 */
export function PwaRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;
    let versionTimer: ReturnType<typeof setInterval> | null = null;
    let notified = false;

    /** Trigger the update path: fetch a new SW if any, then activate it. */
    function requestUpdate() {
      if (notified) return;
      notified = true;
      setUpdateAvailable(true);
      if (reg) {
        reg.update().catch(() => {});
      }
    }

    // --- check /api/version in the background ------------------------
    // When the server reports a version newer than this build, show the
    // banner immediately — even before the SW finishes updating.
    async function checkVersion() {
      const serverVersion = await fetchServerVersion();
      if (serverVersion && serverVersion !== APP_VERSION) {
        requestUpdate();
      }
    }

    // Poll every 5 minutes, and also whenever the app comes to the
    // foreground (users often leave the PWA open for days).
    versionTimer = setInterval(() => void checkVersion(), 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    const onOnline = () => void checkVersion();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    void checkVersion();

    // --- service worker registration ---------------------------------
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((r) => {
        reg = r;
        // Check for updates on load so a fresh deploy reaches the phone
        // quickly instead of waiting for the browser's periodic check.
        r.update().catch(() => {});

        // A new SW finished installing → a new version is cached & waiting.
        r.addEventListener("updatefound", () => {
          const nw = r.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });

        // New SW took control (after skipWaiting) → reload once to pick up
        // the new assets, unless there are unsynced changes (never interrupt
        // offline work mid-flight — the banner lets them choose).
        let refreshed = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshed) return;
          refreshed = true;
          if (!hasPendingChanges()) {
            window.location.reload();
          } else {
            setUpdateAvailable(true);
          }
        });

        // The SW itself can also nudge us (ROKI_UPDATE) right after it
        // activates — extra reliability across browsers.
        navigator.serviceWorker.addEventListener("message", (e) => {
          if (e.data && e.data.type === "ROKI_UPDATE") {
            if (!hasPendingChanges()) {
              window.location.reload();
            } else {
              setUpdateAvailable(true);
            }
          }
        });
      })
      .catch(() => {
        /* offline caching unavailable, app still works */
      });

    return () => {
      if (versionTimer) clearInterval(versionTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!updateAvailable) return <ErrorLogger />;

  return (
    <>
      <ErrorLogger />
      <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-forest-700 bg-forest-800 px-4 py-3 text-white shadow-2xl">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-semibold leading-snug">
            ✨ A new version of Roki is available ({APP_VERSION} → latest).
            {reloading ? " Updating…" : " Tap update to get the latest fixes."}
          </p>
          <button
            type="button"
            onClick={() => {
              setReloading(true);
              // Ask the waiting SW to activate; the controllerchange handler
              // above then reloads the page.
              navigator.serviceWorker.getRegistration().then((r) => {
                r?.waiting?.postMessage({ type: "SKIP_WAITING" });
              });
              // Fallback: if nothing happens within 3s, reload anyway.
              setTimeout(() => {
                window.location.reload();
              }, 3000);
            }}
            disabled={reloading}
            className="inline-flex h-10 shrink-0 items-center rounded-xl bg-ochre-500 px-4 text-[13px] font-bold text-white transition-colors hover:bg-ochre-600 disabled:opacity-50"
          >
            {reloading ? "Updating…" : "Update now"}
          </button>
        </div>
      </div>
    </>
  );
}
