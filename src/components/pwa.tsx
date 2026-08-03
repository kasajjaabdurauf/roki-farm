"use client";

import { useEffect } from "react";

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
  return null;
}
