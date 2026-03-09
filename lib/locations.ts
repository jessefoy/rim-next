/**
 * Location constants and helper for RIM programs.
 *
 * Most in-person programs take place at RIM. Rather than requiring registrars
 * to type the address and paste a Google Maps URL every time, the `venue` field
 * in Sanity defaults to "at-rim" and this module supplies the canonical values
 * automatically.
 *
 * Venues:
 *   "at-rim"   — Rooted in Mindfulness. Address and Maps URL injected automatically.
 *   "other"    — Custom location. Registrar fills in locationText + locationLink.
 *   null/undef — Legacy records with no venue field. Uses raw locationText/Link as-is.
 */

export const RIM_NAME    = "Rooted in Mindfulness";
export const RIM_ADDRESS = "4040 N. Calhoun Rd., Brookfield, WI 53005";
export const RIM_MAPS_URL =
  "https://maps.google.com/maps?q=Rooted+in+Mindfulness+4040+N+Calhoun+Rd+Brookfield+WI+53005";

/** Short display name used on the program detail page */
export const RIM_DISPLAY_NAME = RIM_NAME;

/** "Name · Address" string for email plain-text and calendar location fields */
export const RIM_EMAIL_LOCATION = `${RIM_NAME} · ${RIM_ADDRESS}`;

export interface ResolvedLocation {
  /** Display text for the program page "Where" row. Null → hide the row. */
  text:      string | null;
  /** Clickable map/venue URL. Null → no link. */
  link:      string | null;
  /** Text for calendar and email location fields (may include full address). */
  emailText: string | null;
}

/**
 * Resolve a program's location for display, email, and calendar use.
 *
 * @param venue        Value of the `venue` Sanity field ("at-rim" | "other" | null)
 * @param locationText Custom location text (used when venue === "other" or null)
 * @param locationLink Custom location URL  (used when venue === "other" or null)
 */
export function resolveLocation(
  venue?:        string | null,
  locationText?: string | null,
  locationLink?: string | null,
): ResolvedLocation {
  if (venue === "at-rim") {
    return {
      text:      RIM_DISPLAY_NAME,
      link:      RIM_MAPS_URL,
      emailText: RIM_EMAIL_LOCATION,
    };
  }
  // "other" or null/undefined (legacy records without venue set):
  // fall back to whatever the registrar typed.
  return {
    text:      locationText ?? null,
    link:      locationLink ?? null,
    emailText: locationText ?? null,
  };
}
