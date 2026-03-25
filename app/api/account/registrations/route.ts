import { auth } from "@/auth";
import { db } from "@/lib/db";

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

  // Look up program metadata from Postgres
  const slugs = [...new Set(registrations.map((r) => r.programSlug).filter(Boolean))];
  const pgPrograms = await db.program.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, dateText: true, locationText: true },
  });
  const pgMap = Object.fromEntries(pgPrograms.map((p) => [p.slug, p]));

  const merged = registrations.map((r) => {
    const pg = r.programSlug ? pgMap[r.programSlug] : null;
    return {
      id: r.id,
      programSlug: r.programSlug,
      programTitle: r.programTitle,
      status: r.status,
      donationStatus: r.donationStatus,
      waitlistPosition: r.waitlistPosition,
      createdAt: r.createdAt,
      dateText: pg?.dateText ?? null,
      locationText: pg?.locationText ?? null,
    };
  });

  return Response.json(merged);
}
