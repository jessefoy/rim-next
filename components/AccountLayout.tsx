import { auth } from "@/auth";
import { db } from "@/lib/db";
import AccountSidebar from "@/components/AccountSidebar";
import { memberHasFilesAccess } from "@/lib/googleFiles";

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
  // Non-admins see only the hubs they belong to. The membership query carries
  // the Files-enablement fields too, so showFiles derives from it — no second
  // round-trip (reviewer, session 163).
  let hubLinks: { slug: string; name: string }[] = [];
  let memberships: {
    hub: { status: string; googleFilesEnabled: boolean; googleDriveId: string | null };
  }[] = [];
  if (session?.user?.id) {
    if (isAdmin) {
      const allHubs = await db.hub.findMany({
        select: { slug: true, name: true },
        orderBy: { name: "asc" },
      });
      hubLinks = allHubs;
    } else {
      const rows = await db.hubMember.findMany({
        where: { userId: session.user.id },
        select: {
          hub: {
            select: {
              slug: true,
              name: true,
              status: true,
              googleFilesEnabled: true,
              googleDriveId: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      });
      hubLinks = rows.map((m) => ({ slug: m.hub.slug, name: m.hub.name }));
      memberships = rows;
    }
    // Open-to-all Spaces (Community, session 165) belong in every member's rail
    // even without a HubMember row. Merge them in, de-duped by slug (admins
    // already list every hub). Generalizes to any future open-to-all Space.
    const openHubs = await db.hub.findMany({
      where: { status: "ACTIVE", openToAllMembers: true },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    });
    const seenSlugs = new Set(hubLinks.map((h) => h.slug));
    for (const h of openHubs) {
      if (!seenSlugs.has(h.slug)) hubLinks.push(h);
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

  // The Files link matches actual access (the one rule in lib/googleFiles.ts):
  // ADMIN/GT, a member of a files-enabled hub, OR any member once the Community
  // drive exists (Community is open to all — session 163).
  const showFiles = session?.user?.id
    ? await memberHasFilesAccess(roles, memberships)
    : false;

  return (
    <div className="ac-layout">
      <AccountSidebar roles={roles} hubLinks={hubLinks} showFiles={showFiles} />
      <div className="ac-content">
        <div className="ac-inner">{children}</div>
      </div>
    </div>
  );
}
