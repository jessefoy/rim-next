/**
 * Invisible bot checks for public forms (2026-10-13). Jesse: no puzzles, no
 * "pick the pictures" captchas. Bots had been filling RIM's sign-up forms for
 * a year (about 1,350 in Flodesk), so the newsletter, /join and the
 * registration form each carry:
 *   - a hidden field people never see or reach, which bots fill in;
 *   - the time since the form opened: under two seconds is not a person.
 * A request without the timing (a bot posting straight to the API) is
 * treated as a bot too. Client: components/BotTrap.tsx. No dependencies.
 */
export const BOT_TRAP_FIELD = "rim_website";
export const BOT_ELAPSED_FIELD = "formElapsedMs";
const MIN_MS = 2000;

export function looksAutomated(body: Record<string, unknown>): boolean {
  const trap = body[BOT_TRAP_FIELD];
  if (typeof trap === "string" && trap.trim() !== "") return true;
  const elapsed = Number(body[BOT_ELAPSED_FIELD]);
  if (!Number.isFinite(elapsed)) return true;
  return elapsed < MIN_MS;
}

/** What a person caught by mistake reads on /join and registration. */
export const BOT_RETRY_MESSAGE = "Something didn’t go through. Please wait a moment and try again.";
