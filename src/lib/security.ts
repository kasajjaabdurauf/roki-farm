// ------------------------------------------------------------------
// Security helpers: input validation + brute-force protection.
// Deterministic, no AI. Used by forms and the agent access-code flow.
// ------------------------------------------------------------------

/** Validate a required text field: non-empty after trim, max length. */
export function validText(v: string | undefined | null, max = 200): boolean {
  if (!v) return false;
  const t = v.trim();
  return t.length > 0 && t.length <= max;
}

/** Validate a required number: finite, >= min, <= max. */
export function validNumber(v: number | undefined | null, min = 0, max = 1e9): boolean {
  if (v === undefined || v === null) return false;
  return Number.isFinite(v) && v >= min && v <= max;
}

/** Validate a phone-ish string (loose — exact check happens in phone.ts). */
export function validPhoneish(v: string | undefined | null): boolean {
  if (!v) return false;
  return /^[0-9+\s\-()/;|]{6,20}$/.test(v.trim());
}

/** Validate an email loosely. */
export function validEmailish(v: string | undefined | null): boolean {
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

/**
 * Brute-force protection for the agent access code (and anything else
 * that needs a per-device attempt limiter). localStorage-backed.
 */
export class AttemptLimiter {
  private key: string;
  private max: number;
  private windowMs: number;

  constructor(key: string, max = 5, windowMs = 10 * 60 * 1000) {
    this.key = `roki-limiter-${key}`;
    this.max = max;
    this.windowMs = windowMs;
  }

  private read(): { count: number; first: number } {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const p = JSON.parse(raw) as { count: number; first: number };
        if (typeof p.count === "number" && typeof p.first === "number") return p;
      }
    } catch { /* ignore */ }
    return { count: 0, first: Date.now() };
  }

  /** How many attempts remain in the current window (0 = locked). */
  remaining(): number {
    const s = this.read();
    if (Date.now() - s.first > this.windowMs) return this.max;
    return Math.max(0, this.max - s.count);
  }

  /** Register a failed attempt. Returns true when now locked out. */
  registerFailure(): boolean {
    const s = this.read();
    const now = Date.now();
    const reset = now - s.first > this.windowMs;
    const count = reset ? 1 : s.count + 1;
    try {
      localStorage.setItem(this.key, JSON.stringify({ count, first: reset ? now : s.first }));
    } catch { /* ignore */ }
    return count >= this.max;
  }

  /** Clear attempts (called on success). */
  reset(): void {
    try {
      localStorage.removeItem(this.key);
    } catch { /* ignore */ }
  }
}
