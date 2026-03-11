import { auth } from "@/auth";
import { db } from "@/lib/db";
import AccountSidebar from "@/components/AccountSidebar";

/**
 * AccountLayout — wraps all /account/* pages that need the sidebar.
 * Not applied to /account/welcome or /account/reactivate (standalone flows).
 *
 * Server component: fetches session + hub memberships, passes to client sidebar.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const roles: string[] = session?.user?.roles ?? [];

  const hubs = session?.user?.id
    ? await db.hubMember.findMany({
        where: { userId: session.user.id },
        include: { hub: { select: { slug: true, name: true } } },
        orderBy: { joinedAt: "asc" },
      })
    : [];

  const hubLinks = hubs.map((m) => ({ slug: m.hub.slug, name: m.hub.name }));

  return (
    <div className="ac-layout">
      <AccountSidebar roles={roles} hubLinks={hubLinks} />
      <div className="ac-content">{children}</div>
    </div>
  );
}
