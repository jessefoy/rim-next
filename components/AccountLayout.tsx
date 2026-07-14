import { auth } from "@/auth";
import { db } from "@/lib/db";
import AccountSidebar from "@/components/AccountSidebar";
import { googleConfigured } from "@/lib/google/auth";

/**
 * AccountLayout — wraps all /account/* pages that need the sidebar.
 * Not applied to /account/welcome or /account/reactivate (standalone flows).
 *
 * Server component: fetches session + hub memberships, passes to client sidebar.
 */
export default async function AccountLayout({
  children,
  suppressSidebar = false,
}: {
  children: React.ReactNode;
  /** When true, hides the sidebar and renders content full-width. Used by hub pages. */
  suppressSidebar?: boolean;
}) {
  const session = await auth();
  const roles: string[] = session?.user?.roles ?? [];

  const isAdmin = roles.includes("ADMIN");

  // Admins see all hubs regardless of HubMember record (bypass policy per lib/hubAuth.ts).
  // Non-admins see only the hubs they belong to.
  let hubLinks: { slug: string; name: string }[] = [];
  if (session?.user?.id) {
    if (isAdmin) {
      const allHubs = await db.hub.findMany({
        select: { slug: true, name: true },
        orderBy: { name: "asc" },
      });
      hubLinks = allHubs;
    } else {
      const memberships = await db.hubMember.findMany({
        where: { userId: session.user.id },
        include: { hub: { select: { slug: true, name: true } } },
        orderBy: { joinedAt: "asc" },
      });
      hubLinks = memberships.map((m) => ({ slug: m.hub.slug, name: m.hub.name }));
    }
  }

  if (suppressSidebar) {
    return (
      <div className="ac-layout ac-layout--no-sidebar">
        <div className="ac-content">
          <div className="ac-inner">{children}</div>
        </div>
      </div>
    );
  }

  // Files (Google Workspace) link: ADMIN/GT see it whenever Google is
  // configured (preview + oversight); members see it once at least one of
  // their hubs has Files enabled — never an empty surprise surface.
  let showFiles = false;
  if (session?.user?.id && googleConfigured()) {
    if (roles.includes("ADMIN") || roles.includes("GUIDING_TEACHER")) {
      showFiles = true;
    } else {
      const filesHub = await db.hubMember.findFirst({
        where: {
          userId: session.user.id,
          hub: { status: "ACTIVE", googleFilesEnabled: true, googleDriveId: { not: null } },
        },
        select: { id: true },
      });
      showFiles = !!filesHub;
    }
  }

  return (
    <div className="ac-layout">
      <AccountSidebar roles={roles} hubLinks={hubLinks} showFiles={showFiles} />
      <div className="ac-content">
        <div className="ac-inner">{children}</div>
      </div>
    </div>
  );
}
