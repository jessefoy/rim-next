/** Narrow allowlist for a visitor returning to the offering they were reading. */
export function authReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/account/dashboard";
  if (/^\/programs\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/register)?$/.test(value)) return value;
  if (value === "/volunteerism/volunteer" || value === "/kalyana-mitta/kalyana-mitta-group-application") return value;
  return "/account/dashboard";
}

export function authCallbackPath(value: unknown): string {
  const path = authReturnPath(value);
  return path === "/account/dashboard" ? path : `/account/return?to=${encodeURIComponent(path)}`;
}

/** Recover only an allowlisted local destination from Auth.js's callback URL.
 * Absolute callback URLs are reduced to local paths; their origins are never used.
 */
export function authReturnFromCallback(value: unknown): string {
  if (typeof value !== "string") return authReturnPath(null);
  try {
    const url = new URL(value, "https://rim.invalid");
    return url.pathname === "/account/return"
      ? authReturnPath(url.searchParams.get("to"))
      : authReturnPath(url.search || url.hash ? null : url.pathname);
  } catch {
    return authReturnPath(null);
  }
}
