import { auth } from "@/auth";
import { db } from "@/lib/db";
import AccountSidebar from "@/components/AccountSidebar";

/**
 * AccountLayout — wraps all /account/* pages that need the sidebar.
 * Not applied to /account/welcome or /account/reactivate (standalone flows).
 *
 * Server component: fetches roles for contextual administration navigation,
 * and whether the member belongs to any team. My Teams appears in the rail
 * only for someone with a membership in a team that is not archived, or for
 * a guiding teacher (who oversees every team). Jesse, 2026-10-12: "The team
 * should be only for those who belong to a team." The door into a team is
 * unchanged (lib/hubAuth.ts canAccessHub); this only decides the rail entry.
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

  if (suppressSidebar) {
    return (
      <div className="ac-layout ac-layout--no-sidebar">
        <div className="ac-content">
          <div className="ac-inner">{children}</div>
        </div>
      </div>
    );
  }

  const userId = session?.user?.id;
  const showTeams =
    roles.includes("GUIDING_TEACHER") ||
    (!!userId &&
      !!(await db.hubMember.findFirst({
        where: { userId, hub: { status: "ACTIVE" } },
        select: { id: true },
      })));

  return (
    <div className="ac-layout">
      <AccountSidebar roles={roles} showTeams={showTeams} />
      <div className="ac-content">
        <div className="ac-inner">{children}</div>
      </div>
    </div>
  );
}
