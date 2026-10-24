/**
 * Hub workspace shell for /account/hub/[slug]/*
 *
 * - Auth check: redirect to /login if not authenticated
 * - Hub existence: 404 if hub not found
 * - Access check: members + GUIDING_TEACHER pass; ADMIN-alone does not
 *   (see lib/hubAuth.ts::canAccessHub). Shows a calm "no access" panel otherwise.
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
import { canAccessHub, canManageTrash, effectiveCoordinator } from "@/lib/hubAuth";
import { resolveRegisteredTool } from "@/lib/hubApps";
import { countHubUnreadForYou, readPointOf } from "@/lib/hubActivity";
import { hubLeadAllowed } from "@/lib/googleFiles";
import { canSeeInstalledApp } from "@/lib/toolAuth";

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

  const member = hub.members.find((m) => m.userId === session.user.id) ?? null;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  // Access door: a HubMember row OR the GUIDING_TEACHER role (sangha-wide
  // dharma authority — an implicit coordinator on every hub). ADMIN-alone
  // does NOT pass: ADMIN configures hubs from /admin/hubs (outside) and
  // participates from inside as a member, like everyone else (session 128).
  // See lib/hubAuth.ts::canAccessHub.
  const hasAccess = canAccessHub(member, roles);

  if (!hasAccess) {
    return (
      <div className="hub-ws-layout">
        <div className="hub-ws-main">
          <div className="hub-ws-content hub-ws-content--reading">
            <div className="rim-empty" style={{ padding: "40px 0" }}>
              You don&rsquo;t have access to this team.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isCoordinator = effectiveCoordinator(member, roles);
  const canTrash = canManageTrash(roles, member);

  const [ctx, updatesForYou] = await Promise.all([
    getHubContext(
      hub.slug,
      hub.id,
      session.user.id,
      member?.lastVisitedAt ?? null,
      hub.conversationsEnabled,
    ),
    // The Updates number: unread items for you only (Jesse, 2026-10-19).
    countHubUnreadForYou({
      hubId: hub.id,
      hubSlug: hub.slug,
      viewer: {
        userId: session.user.id,
        roles,
        isLead: hubLeadAllowed(roles, member ?? null),
        readPoint: readPointOf(member ?? null),
      },
      conversationsEnabled: hub.conversationsEnabled,
      filesEnabled: hub.googleFilesEnabled && Boolean(hub.googleDriveId),
    }).catch((err) => {
      console.error("[hub nav] Updates count failed", err);
      return 0;
    }),
  ]);

  // An ACTIVE coordinator is the one to contact (2026-10-19 audit).
  const coordinatorNames = hub.members
    .filter((m) => m.isCoordinator && m.status === "ACTIVE")
    .map((m) => {
      const u = m.user as { firstName: string | null; lastName: string | null; preferredName?: string | null };
      return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
    });

  // Registration shows only to its roles, Programs only to the active members
  // of its teams (2026-10-19, 2026-10-24): a link that opened "You don't have
  // permission" was worse than none.
  const tools = hub.appLinks
    .filter((link) => canSeeInstalledApp(link.toolSlug, session.user.roles, { hubSlug: hub.slug, memberStatus: member?.status }))
    .map((link) => {
    const registered = resolveRegisteredTool(link);
    return {
      slug: registered?.slug ?? link.label.toLowerCase().replace(/\s+/g, "-"),
      label: link.label,
      path: link.href,
      isRegistered: Boolean(registered),
      isPrimary: link.isPrimary,
      iconKey: registered?.iconKey ?? "link" as const,
    };
  });

  return (
    <div className="hub-ws-layout">
      <HubWorkspaceSidebar
        hub={{
          slug: hub.slug,
          name: hub.name,
          type: hub.type as "OPERATIONAL" | "GOVERNANCE" | "COMMUNITY_GROUP",
          memberCount: hub.members.length,
          coordinatorNames,
          filesEnabled: hub.googleFilesEnabled && Boolean(hub.googleDriveId),
          conversationsEnabled: hub.conversationsEnabled,
        }}
        tools={tools}
        navCounts={{
          conversations: ctx.conversationsUnread,
          updates: updatesForYou,
        }}
        isCoordinator={isCoordinator}
        isAdmin={isAdmin}
        canManageTrash={canTrash}
      />
      <div className="hub-ws-main">
        <div className="hub-ws-content hub-ws-content--reading">{children}</div>
      </div>
    </div>
  );
}
