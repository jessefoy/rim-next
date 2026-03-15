/**
 * Central Time (America/Chicago) timezone utilities.
 *
 * RIM is a community center in Brookfield, WI — all program times are Central.
 * Postgres stores UTC; the editor displays/accepts Central Time.
 */

const TZ = "America/Chicago";

/**
 * Convert a UTC Date to a "YYYY-MM-DDTHH:mm" string in Central Time.
 * Used to populate datetime-local inputs with the correct CT value.
 */
export function toCentralDatetime(d: Date | null | undefined): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hour12: false with en-US can return "24" for midnight — normalize to "00"
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * Parse a "YYYY-MM-DDTHH:mm" string (assumed Central Time) into a UTC Date.
 * Used when saving editor datetime-local values to Postgres.
 */
export function centralToUtc(dtLocal: string | null | undefined): Date | null {
  if (!dtLocal) return null;

  // Treat the input as UTC to get a reference timestamp
  const asUtc = new Date(dtLocal + ":00.000Z");
  if (isNaN(asUtc.getTime())) return null;

  // Find the CT→UTC offset at this approximate moment
  const utcStr = asUtc.toLocaleString("en-US", { timeZone: "UTC" });
  const ctStr = asUtc.toLocaleString("en-US", { timeZone: TZ });
  const offsetMs = new Date(utcStr).getTime() - new Date(ctStr).getTime();

  // Input represents CT, so add offset to get UTC
  return new Date(asUtc.getTime() + offsetMs);
}
