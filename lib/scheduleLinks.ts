/**
 * The Scheduler's link to one session: its month, and the session itself
 * (`session=program~YYYY-MM-DD`, Central day), which the Scheduler scrolls to
 * and marks (2026-10-19). Dependency-light so emails, Updates and
 * Notifications can all use it.
 */

import { ctMonthKey } from "@/lib/timezone";
import { ctDateStr } from "@/lib/scheduleUtils";

export function scheduleSessionHref(hubSlug: string, programSlug: string | null, date: Date | null): string {
  const qs = new URLSearchParams({ hub: hubSlug });
  if (date) qs.set("month", ctMonthKey(date));
  if (date && programSlug) qs.set("session", `${programSlug}~${ctDateStr(date.toISOString())}`);
  return `/tools/schedule?${qs}`;
}
