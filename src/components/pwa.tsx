"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/react";

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

/** Registers the service worker (production builds only). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // updateViaCache: "none", never serve the shell from the HTTP cache,
    // always check for a newer service worker on reload.
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        // Check for updates on load so a fresh deploy reaches the phone
        // quickly instead of waiting for the browser's periodic check.
        reg.update().catch(() => {});
        // If a new SW took over while the app was open, reload once to
        // pick up the new build assets.
        let refreshed = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshed) return;
          refreshed = true;
          window.location.reload();
        });
      })
      .catch(() => {
        /* offline caching unavailable, app still works */
      });
  }, []);
  return <ErrorLogger />;
}
