/**
 * Programs tool layout — wraps /tools/programs/* with ToolsProvider.
 * Role gate: REGISTRAR or ADMIN, or individual UserToolAccess grant.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ToolsProvider } from "@/components/ToolsContext";
import ToolsNav from "@/components/ToolsNav";
import { hasToolAccess } from "@/lib/toolAuth";

export default async function ProgramsToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const hasAccess = await hasToolAccess(session.user.id, roles, ["REGISTRAR"], "programs");

  if (!hasAccess) {
    return (
      <div className="tools-unauthorized">
        You don&rsquo;t have permission to access this tool.
      </div>
    );
  }

  // Resolve back link: check if user is in the registrar hub
  let backHref = "/account/dashboard";
  let backLabel = "Dashboard";

  const hub = await db.hub.findUnique({ where: { slug: "registrar" }, select: { id: true, name: true } });
  if (hub) {
    const member = await db.hubMember.findUnique({
      where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
    });
    if (member || isAdmin) {
      backHref = "/account/hub/registrar";
      backLabel = hub.name;
    }
  }

  return (
    <ToolsProvider value={{ toolName: "Programs", backHref, backLabel }}>
      <ToolsNav />
      <div className="tools-content">
        {children}
      </div>
    </ToolsProvider>
  );
}
