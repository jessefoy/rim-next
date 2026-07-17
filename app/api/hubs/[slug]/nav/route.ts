/**
 * GET /api/hubs/[slug]/nav
 *
 * Returns the hub-sidebar data for a given hub slug: identity, coordinator
 * names, member count, tool list (with live badge counts), and nav badge
 * counts. Consumed by the WorkspaceShell client wrapper when a tool is
 * opened with ?hub=<slug>.
 *
 * Auth: must be a member of the hub, or ADMIN.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getHubContext } from "@/lib/hubContext";
import { effectiveCoordinator } from "@/lib/hubAuth";
import { resolveRegisteredTool } from "@/lib/hubApps";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hub = await db.hub.findUnique({
    where: { slug },
    include: {
      appLinks: { where: { isEnabled: true }, orderBy: { order: "asc" } },
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
      },
    },
  });

  if (!hub) return NextResponse.json({ error: "Hub not found" }, { status: 404 });

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const member = hub.members.find((m) => m.userId === session.user.id);
  if (!member && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ctx = await getHubContext(
    hub.slug,
    hub.id,
    session.user.id,
    member?.lastVisitedAt ?? null,
    member?.activitySeenAt ?? null,
    hub.conversationsEnabled,
  );

  const coordinatorNames = hub.members
    .filter((m) => m.isCoordinator)
    .map((m) => {
      const u = m.user as { firstName: string | null; lastName: string | null; preferredName?: string | null };
      return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
    });

  const tools = hub.appLinks.map((link) => {
    const registered = resolveRegisteredTool(link);
    return {
      slug: registered?.slug ?? link.label.toLowerCase().replace(/\s+/g, "-"),
      label: link.label,
      path: link.href,
      isRegistered: Boolean(registered),
      isPrimary: link.isPrimary,
    };
  });

  return NextResponse.json({
    hub: {
      slug: hub.slug,
      name: hub.name,
      type: hub.type,
      memberCount: hub.members.length,
      coordinatorNames,
      // So the Files tab stays put when the sidebar re-renders inside a hub
      // tool (?hub=…), matching the hub-section render (reviewer, session 163).
      filesEnabled: hub.googleFilesEnabled && Boolean(hub.googleDriveId),
    },
    tools,
    navCounts: {
      activity: ctx.activityUnread,
      conversations: ctx.conversationsUnread,
    },
    isCoordinator: effectiveCoordinator(member, roles),
    isAdmin,
  });
}
