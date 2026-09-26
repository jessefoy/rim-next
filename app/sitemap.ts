import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { publicOrigin, publicIndexing } from "@/lib/publicMetadata";
import { hasConcludedOneTime } from "@/lib/programUtils";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!publicIndexing) return [];
  const paths = ["/", "/new-to-rim", "/care", "/our-roots", "/why-we-practice", "/about", "/community-care-agreements", "/community-programs", "/this-week", "/donate", "/outreach", "/volunteerism/volunteer", "/kalyana-mitta/community-groups-events", "/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group"];
  const programs = await db.program.findMany({ where: { archivedAt: null, hideFromProgramPageList: false, category: { hideFromProgramsPage: false, kind: { not: "PRIVATE" } } } });
  for (const p of programs) if (!(p.hideWhenPast && hasConcludedOneTime(p))) paths.push(`/programs/${p.slug}`);
  return paths.map(path => ({ url: new URL(path, publicOrigin).href }));
}
