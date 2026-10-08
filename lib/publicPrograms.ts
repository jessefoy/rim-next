import { db } from "@/lib/db";
import {
  isPubliclyListedCategory,
  resolveOffering,
  type OfferingCategoryCode,
} from "@/lib/programOffering";
import { hasConcludedOneTime } from "@/lib/programUtils";

/**
 * The programs a visitor can find on Programs & Events, each with its
 * Category, Format and checkboxes resolved. One rule for the catalog and for
 * the home page's three cards (2026-10-08), so a program hidden from one is
 * hidden from the other: not archived, not hidden from the listing, not a
 * concluded one-time program (unless the editor opted out with hideWhenPast),
 * not in an old category that hides from the Programs page, and in a publicly
 * listed Category (Private never is).
 */
export async function loadPublicPrograms() {
  const all = await db.program.findMany({
    where: { hideFromProgramPageList: false, archivedAt: null },
    include: { category: true },
    orderBy: { sortOrder: "asc" },
  });
  return all
    .filter((p) => !(p.hideWhenPast && hasConcludedOneTime(p)))
    .filter((p) => !p.category?.hideFromProgramsPage)
    .map((p) => ({ ...p, offering: resolveOffering(p) }))
    .filter((p) => isPubliclyListedCategory(p.offering.category));
}

export type PublicProgram = Awaited<ReturnType<typeof loadPublicPrograms>>[number];

/** The listed programs in one Category, in listing order. */
export function programsInCategory(programs: PublicProgram[], code: OfferingCategoryCode) {
  return programs.filter((p) => p.offering.category === code);
}
