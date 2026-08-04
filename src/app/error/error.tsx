"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui";

/**
 * Friendly error boundary — shows the real error message (with a copy
 * button) so support can diagnose instantly instead of guessing.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [details, setDetails] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const msg = error?.message || String(error);
    try {
      localStorage.setItem("roki-last-error", msg);
      const saved = localStorage.getItem("roki-last-error");
      if (saved) setDetails(saved);
    } catch { /* ignore */ }
    console.error("[Roki error]", error);
    try {
      if (Sentry.getClient()) Sentry.captureException(error);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="font-display text-xl font-semibold text-forest-900">Something went wrong</p>
        <p className="text-sm leading-relaxed text-stone-500">
          An unexpected error occurred while loading this page. Try again, or if it keeps happening, fully close the
          app and reopen it so it picks up the latest version.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          {details && (
            <Button
              variant="outline"
              onClick={() => {
                try {
                  navigator.clipboard?.writeText(details);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch { /* ignore */ }
              }}
            >
              {copied ? "Copied!" : "Copy error"}
            </Button>
          )}
        </div>
        {details && (
          <details className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-left">
            <summary className="cursor-pointer text-[12px] font-semibold text-stone-500">
              Error details (send this to support)
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-snug text-danger-dark">
              {details}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
