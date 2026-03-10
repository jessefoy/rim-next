import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { allVirtualProgramsQuery } from "@/lib/queries";

// GET /api/cron/check-unassigned-hosts
// Daily cron — finds virtual programs with a startDatetime within 30 days that
// have no standing HostAssignment, then alerts all HOST_MANAGER + ADMIN users.
//
// Dedup: skips if an UNASSIGNED_SESSION alert with the same linkUrl was already
// created in the past 24 hours (prevents re-alerting on consecutive cron runs).
//
// Vercel passes CRON_SECRET automatically as: Authorization: Bearer <secret>

interface SanityProgram {
  _id: string;
  name: string;
  slug: string;
  startDatetime?: string | null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Fetch all virtual/hybrid programs from Sanity
  const programs = await sanityClient.fetch<SanityProgram[]>(allVirtualProgramsQuery);

  // Filter to programs with startDatetime within the next 30 days
  const upcoming = programs.filter((p) => {
    if (!p.startDatetime) return false;
    const dt = new Date(p.startDatetime);
    return dt >= now && dt <= in30Days;
  });

  if (upcoming.length === 0) {
    return NextResponse.json({ checked: 0, alerted: 0 });
  }

  // Get slugs that have at least one standing assignment (sessionDate is null)
  const assignedSlugs = await db.hostAssignment
    .findMany({
      where: {
        programSlug: { in: upcoming.map((p) => p.slug) },
        sessionDate: null, // standing assignments only
      },
      select: { programSlug: true },
      distinct: ["programSlug"],
    })
    .then((rows) => new Set(rows.map((r) => r.programSlug)));

  // Programs with no standing assignment
  const unassigned = upcoming.filter((p) => !assignedSlugs.has(p.slug));

  if (unassigned.length === 0) {
    return NextResponse.json({ checked: upcoming.length, alerted: 0 });
  }

  // Managers to notify
  const managers = await db.user.findMany({
    where: {
      roles: { hasSome: ["HOST_MANAGER", "ADMIN"] },
      archivedAt: null,
    },
    select: { id: true },
  });

  if (managers.length === 0) {
    return NextResponse.json({ checked: upcoming.length, alerted: 0 });
  }

  // Create alerts with dedup: skip if same linkUrl alert exists in last 24h
  let alertsCreated = 0;

  for (const program of unassigned) {
    const linkUrl = `/account/host/manage?program=${program.slug}`;

    for (const manager of managers) {
      // Check dedup
      const existing = await db.alert.findFirst({
        where: {
          userId: manager.id,
          type: "UNASSIGNED_SESSION",
          linkUrl,
          createdAt: { gte: since24h },
        },
      });
      if (existing) continue;

      await db.alert.create({
        data: {
          userId: manager.id,
          type: "UNASSIGNED_SESSION",
          message: `${program.name} has no host assigned within 30 days`,
          linkUrl,
        },
      });
      alertsCreated++;
    }
  }

  return NextResponse.json({
    checked: upcoming.length,
    unassigned: unassigned.length,
    alerted: alertsCreated,
  });
}
