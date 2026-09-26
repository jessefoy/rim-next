/** Narrow allowlist for a visitor returning to the offering they were reading. */
export function authReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/account/dashboard";
  if (/^\/programs\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/register)?$/.test(value)) return value;
  if (value === "/volunteerism/volunteer") return value;
  return "/account/dashboard";
}

export function authCallbackPath(value: unknown): string {
  const path = authReturnPath(value);
  return path === "/account/dashboard" ? path : `/account/return?to=${encodeURIComponent(path)}`;
}
