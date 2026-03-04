import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { programsBySlugArrayQuery } from "@/lib/queries";

interface SanityProgram {
  slug: string;
  name: string;
  dateText?: string;
  timeText?: string;
  locationText?: string;
  zoomLink?: string;
  zoomLinkText?: string;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const registrations = await db.registration.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      programSlug: true,
      programTitle: true,
      status: true,
      donationStatus: true,
      waitlistPosition: true,
      createdAt: true,
    },
  });

  if (registrations.length === 0) {
    return Response.json([]);
  }

  const slugs = [...new Set(registrations.map((r) => r.programSlug).filter(Boolean))];
  const sanityPrograms = await sanityClient.fetch<SanityProgram[]>(
    programsBySlugArrayQuery,
    { slugs }
  );

  const sanityMap = Object.fromEntries(sanityPrograms.map((p) => [p.slug, p]));

  const merged = registrations.map((r) => {
    const sanity = r.programSlug ? sanityMap[r.programSlug] : null;
    return {
      id: r.id,
      programSlug: r.programSlug,
      programTitle: r.programTitle,
      status: r.status,
      donationStatus: r.donationStatus,
      waitlistPosition: r.waitlistPosition,
      createdAt: r.createdAt,
      dateText: sanity?.dateText ?? null,
      timeText: sanity?.timeText ?? null,
      locationText: sanity?.locationText ?? null,
      zoomLink: sanity?.zoomLink ?? null,
      zoomLinkText: sanity?.zoomLinkText ?? null,
    };
  });

  return Response.json(merged);
}
