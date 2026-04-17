/**
 * Hub workspace shell for /account/hub/[slug]/*
 *
 * - Auth check: redirect to /login if not authenticated
 * - Hub existence: 404 if hub not found
 * - Membership check: 403 if user is not a hub member (admin bypass)
 * - Renders HubWorkspaceSidebar (unified rail for hub + tools) alongside
 *   the section content. Does NOT wrap in AccountLayout — workspaces are
 *   their own full-height chrome and the outer AccountSidebar would
 *   duplicate navigation.
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import HubWorkspaceSidebar from "@/components/HubWorkspaceSidebar";
import { getHubContext } from "@/lib/hubContext";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function HubLayout({ children, params }: Props) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const hub = await db.hub.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
      },
      appLinks: { where: { isEnabled: true }, orderBy: { order: "asc" } },
    },
  });

  if (!hub) notFound();

  const isMember = hub.members.some((m) => m.userId === session.user.id);
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  const hasAccess = isMember || isAdmin;

  if (!hasAccess) {
    return (
      <div className="hub-ws-layout">
        <div className="hub-ws-main">
          <div className="hub-ws-content hub-ws-content--reading">
            <div className="rim-empty" style={{ padding: "40px 0" }}>
              You don&rsquo;t have access to this hub.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const member = hub.members.find((m) => m.userId === session.user.id) ?? null;
  const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;

  const ctx = await getHubContext(
    hub.slug,
    hub.id,
    session.user.id,
    member?.lastVisitedAt ?? null,
  );

  const coordinatorNames = hub.members
    .filter((m) => m.isCoordinator)
    .map((m) => {
      const u = m.user as { firstName: string | null; lastName: string | null; preferredName?: string | null };
      return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
    });

  const tools = hub.appLinks.map((link) => ({
    slug: link.toolSlug ?? link.label.toLowerCase().replace(/\s+/g, "-"),
    label: link.label,
    path: link.href,
    badgeCount:
      ctx.primaryTool && link.toolSlug === ctx.primaryTool.slug ? ctx.primaryCount : 0,
  }));

  return (
    <div className="hub-ws-layout">
      <HubWorkspaceSidebar
        hub={{
          slug: hub.slug,
          name: hub.name,
          type: hub.type as "OPERATIONAL" | "GOVERNANCE" | "COMMUNITY_GROUP",
          memberCount: hub.members.length,
          coordinatorNames,
        }}
        tools={tools}
        navCounts={{
          conversations: ctx.conversationsUnread,
          tasks: ctx.tasksForYou,
        }}
        isCoordinator={isCoordinator}
        isAdmin={isAdmin}
      />
      <div className="hub-ws-main">
        <div className="hub-ws-content hub-ws-content--reading">{children}</div>
      </div>
    </div>
  );
}
