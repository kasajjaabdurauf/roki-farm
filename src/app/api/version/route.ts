// ------------------------------------------------------------------
// Current deployed version — the app polls this endpoint and shows the
// "Update available" banner the moment it sees a version newer than the
// one it's running. This makes updates propagate even if a device's
// service worker update is delayed by the browser.
// ------------------------------------------------------------------
import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      app: "roki-farm-platform",
      version: APP_VERSION,
      time: new Date().toISOString(),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
