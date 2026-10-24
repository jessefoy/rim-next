import { auth } from "@/auth";
import { db } from "@/lib/db";
import AccountSidebar from "@/components/AccountSidebar";
import { countUnreadNotices } from "@/lib/notifications";
import { showsTeaching } from "@/lib/teaching";

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
  // Three questions for the rail, asked together: on a team? (My Teams);
  // teaching a current program? (Teaching, 2026-10-24, lib/teaching.ts); and
  // how many unread notices (2026-10-20).
  const [showTeams, showTeaching, notificationsUnread] = await Promise.all([
    roles.includes("GUIDING_TEACHER")
      ? Promise.resolve(true)
      : userId
        ? db.hubMember.findFirst({ where: { userId, hub: { status: "ACTIVE" } }, select: { id: true } }).then((m) => !!m)
        : Promise.resolve(false),
    userId ? showsTeaching(userId, roles) : Promise.resolve(false),
    userId ? countUnreadNotices(userId) : Promise.resolve(0),
  ]);

  return (
    <div className="ac-layout">
      <AccountSidebar roles={roles} showTeams={showTeams} showTeaching={showTeaching} notificationsUnread={notificationsUnread} />
      <div className="ac-content">
        <div className="ac-inner">{children}</div>
      </div>
    </div>
  );
}
