// ------------------------------------------------------------------
// Agent identity — the one place the "who is using this device" name
// lives. Stored in localStorage so it survives reloads; every farmer
// registered on this device is stamped with it (loggedBy / logged_by).
//
// This is the "meaningful place" agent names are captured: once at the
// start of a field session (dashboard prompt + banner), then pre-filled
// into the survey and uploads automatically.
// ------------------------------------------------------------------

const KEY = "roki-agent-name";

export function getAgentName(): string {
  try {
    return (localStorage.getItem(KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function setAgentName(name: string): void {
  try {
    localStorage.setItem(KEY, name.trim());
  } catch {
    /* private mode / storage disabled: session-only fallback */
  }
}

export function clearAgentName(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Normalize an agent name for storage: trim, collapse inner spaces, and
 * treat "none" / "n/a" / "-" as the literal "None" (so the Agents page
 * shows a visible "None" group instead of silently blank credits).
 */
export function normalizeAgentName(raw: string): string {
  const t = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (/^(none|n\/a|na|-)$/i.test(t)) return "None";
  return t;
}
