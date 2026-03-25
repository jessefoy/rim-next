/**
 * Inbox tool layout — wraps /tools/inbox/* with ToolsProvider.
 * Role gate: SUPPORT or ADMIN, or individual UserToolAccess grant.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ToolsProvider } from "@/components/ToolsContext";
import ToolsNav from "@/components/ToolsNav";
import { hasToolAccess } from "@/lib/toolAuth";

export default async function InboxToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const hasAccess = await hasToolAccess(session.user.id, roles, ["SUPPORT"], "inbox");

  if (!hasAccess) {
    return (
      <div className="tools-unauthorized">
        You don&rsquo;t have permission to access this tool.
      </div>
    );
  }

  let backHref = "/account/dashboard";
  let backLabel = "Dashboard";

  const hub = await db.hub.findUnique({ where: { slug: "support" }, select: { id: true, name: true } });
  if (hub) {
    const member = await db.hubMember.findUnique({
      where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
    });
    if (member || isAdmin) {
      backHref = "/account/hub/support";
      backLabel = hub.name;
    }
  }

  return (
    <ToolsProvider value={{ toolName: "Support Inbox", backHref, backLabel }}>
      <ToolsNav />
      <div className="tools-content">
        {children}
      </div>
    </ToolsProvider>
  );
}
