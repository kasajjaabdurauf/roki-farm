// ------------------------------------------------------------------
// Uganda phone validation — deterministic rule-based (MTN / Airtel).
// Accepts: 07XXXXXXXX, +2567XXXXXXXX, 2567XXXXXXXX, 7XXXXXXXX,
// with separators (spaces, dashes, parens) stripped.
// Normalized output: +2567XXXXXXXX (used in exports & profiles).
// ------------------------------------------------------------------

import type { Carrier } from "./types";

export interface PhoneResult {
  ok: boolean;
  normalized?: string;
  carrier?: Carrier;
  reason?: string;
}

// MTN Uganda prefixes: 076, 077, 078 | Airtel Uganda: 070, 074, 075
const MTN_PREFIXES = ["76", "77", "78"];
const AIRTEL_PREFIXES = ["70", "74", "75"];

export function normalizeUgPhone(raw: string): PhoneResult {
  if (!raw) return { ok: false, reason: "Phone number is required" };

  let s = raw.trim().replace(/[\s\-().]/g, "");

  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2);

  if (s.startsWith("256")) s = s.slice(3);
  else if (s.startsWith("0")) s = s.slice(1);

  if (!/^[0-9]{9}$/.test(s)) {
    return {
      ok: false,
      reason: `"${raw}" is not a valid Ugandan mobile number (expected 07XXXXXXXX or +2567XXXXXXXX)`,
    };
  }
  if (!s.startsWith("7")) {
    return { ok: false, reason: `"${raw}" is not a valid Ugandan mobile number (must start 07X / +2567X)` };
  }

  const prefix = s.slice(0, 2); // carrier code: first 2 digits after the leading 7
  let carrier: Carrier;
  if (MTN_PREFIXES.includes(prefix)) carrier = "MTN";
  else if (AIRTEL_PREFIXES.includes(prefix)) carrier = "AIRTEL";
  else carrier = "OTHER";

  return { ok: true, normalized: `+256${s}`, carrier };
}
