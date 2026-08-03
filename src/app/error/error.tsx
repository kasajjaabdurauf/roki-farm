"use client";

import { Button } from "@/components/ui";

/**
 * Friendly error boundary — replaces the scary generic
 * "Application error" screen with a branded, recoverable one.
 */
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="font-display text-xl font-semibold text-forest-900">Something went wrong</p>
        <p className="text-sm leading-relaxed text-stone-500">
          An unexpected error occurred while loading this page. Try again, or if it keeps happening,
          hard-refresh the app (fully close it and reopen) so it picks up the latest version.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
