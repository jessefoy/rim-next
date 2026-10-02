import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { hasConcludedOneTime } from "@/lib/programUtils";
import { isPubliclyListedCategory, resolveOffering } from "@/lib/programOffering";
import { SITE_ORIGIN } from "@/lib/siteUrl";

/**
 * The sitemap of the public pages (the integration follow-up brief, F6): the
 * static pages, the programs a visitor can find on Programs & Events, and the
 * public teacher profiles. Programs and teachers come from the database, so
 * the file is built on request. Left out on purpose: the member area, the
 * sign-in pages, a program's registration and thank-you pages, /style-guide,
 * and the public course catalog, which holds only a test course until real
 * courses are published.
 */
export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "/",
  "/new-to-rim",
  "/why-we-practice",
  "/care",
  "/our-roots",
  "/handful-of-leaves",
  "/foundations",
  "/about",
  "/community-programs",
  "/this-week",
  "/teachers",
  "/donate",
  "/diversity",
  "/outreach",
  "/join",
  "/community-care-agreements",
  "/volunteerism/volunteer",
  "/kalyana-mitta/community-groups-events",
  "/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group",
  "/kalyana-mitta/kalyana-mitta-group-application",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = STATIC_PATHS.map((path) => ({ url: `${SITE_ORIGIN}${path === "/" ? "" : path}` }));
  try {
    return [...staticEntries, ...(await databaseEntries())];
  } catch (error) {
    // The programs and teachers need the database; the static pages do not.
    console.error("[sitemap] database entries skipped", error);
    return staticEntries;
  }
}

async function databaseEntries(): Promise<MetadataRoute.Sitemap> {
  const [programs, teachers] = await Promise.all([
    db.program.findMany({
      where: { archivedAt: null, hideFromProgramPageList: false },
      select: {
        slug: true,
        updatedAt: true,
        hideWhenPast: true,
        recurrenceFreq: true,
        startDatetime: true,
        endDatetime: true,
        offeringCategory: true,
        category: { select: { slug: true, hideFromProgramsPage: true } },
      },
    }),
    db.teacherProfile.findMany({
      where: { isPublic: true, slug: { not: null } },
      select: { slug: true },
    }),
  ]);

  // The same rule as the listing: a program with no Category, a Private one, one
  // in an old category hidden from the Programs page, or a one-time program whose
  // day has passed (and that retires itself) is not listed.
  const listed = programs.filter(
    (p) =>
      isPubliclyListedCategory(resolveOffering(p).category) &&
      !p.category?.hideFromProgramsPage &&
      !(p.hideWhenPast && hasConcludedOneTime(p))
  );

  return [
    ...listed.map((p) => ({ url: `${SITE_ORIGIN}/programs/${p.slug}`, lastModified: p.updatedAt })),
    ...teachers.map((t) => ({ url: `${SITE_ORIGIN}/teachers/${t.slug}` })),
  ];
}
