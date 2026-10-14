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

import { normalizeLinkInput } from "@/lib/linkInput";

export const RIM_NAME    = "Rooted in Mindfulness";
export const RIM_ADDRESS = "4040 N. Calhoun Rd., Brookfield, WI 53005";

/** Public contact, one source for the footer and the About page. */
export const RIM_PHONE_DISPLAY = "(414) 882-8932";
export const RIM_PHONE_TEL = "4148828932";
export const RIM_SUPPORT_EMAIL = "support@rootedinmindfulness.org";

/**
 * Legal identity for gift acknowledgments, exactly as the IRS determination
 * letter (March 24, 2016) names it: 501(c)(3), contributions deductible under
 * IRC 170, public charity status 170(b)(1)(A)(i). Used by the dana receipts.
 */
export const RIM_LEGAL_NAME = "Rooted In Mindfulness Corp";
export const RIM_EIN = "81-1776523";
export const RIM_MAPS_URL =
  "https://maps.google.com/maps?q=Rooted+in+Mindfulness+4040+N+Calhoun+Rd+Brookfield+WI+53005";

/** Short display name used on the program detail page */
export const RIM_DISPLAY_NAME = RIM_NAME;

/** "Name · Address" string for email plain-text and calendar location fields */
export const RIM_EMAIL_LOCATION = `${RIM_NAME} · ${RIM_ADDRESS}`;

/** Escape the characters that would end a markdown link's text early. */
export function markdownLinkText(text: string): string {
  return text.replace(/([\\\[\]])/g, "\\$1");
}

/** An online-only program has no place to show in an email: its venue fields
 *  may still hold an old address (the editor hides them, it doesn't clear
 *  them), and the thank-you page already leaves them out. */
export function emailLocationFor(p: {
  programFormat?: string | null;
  venue?: string | null;
  locationText?: string | null;
  locationLink?: string | null;
}): ResolvedLocation {
  if (p.programFormat === "virtual") return { text: null, link: null, emailText: null, emailLink: null };
  return resolveLocation(p.venue, p.locationText, p.locationLink);
}

export interface ResolvedLocation {
  /** Display text for the program page "Where" row. Null → hide the row. */
  text:      string | null;
  /** Clickable map/venue URL. Null → no link. */
  link:      string | null;
  /** Text for calendar and email location fields (may include full address). */
  emailText: string | null;
  /** A safe map/directions link for the confirmation email (2026-10-14): only
   *  for a venue other than RIM that has a Location Link; null otherwise. */
  emailLink: string | null;
}

/** An http(s) link fit for a markdown link in an email, or null. Tidied like
 *  every link box (lib/linkInput.ts); spaces and brackets are encoded, and
 *  parentheses too, so nothing can close the link early. */
export function emailSafeLink(raw: string | null | undefined): string | null {
  const value = raw ? normalizeLinkInput(raw) : "";
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().replace(/\(/g, "%28").replace(/\)/g, "%29");
  } catch {
    return null;
  }
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
      emailLink: null,
    };
  }
  // "other" or null/undefined (legacy records without venue set):
  // fall back to whatever the registrar typed.
  return {
    text:      locationText ?? null,
    link:      locationLink ?? null,
    emailText: locationText ?? null,
    emailLink: locationText ? emailSafeLink(locationLink) : null,
  };
}
