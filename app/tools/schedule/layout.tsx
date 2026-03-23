/**
 * Schedule tool layout — wraps /tools/schedule/* with ToolsProvider.
 * Role gate: HOST, HOST_MANAGER, or ADMIN.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ToolsProvider } from "@/components/ToolsContext";

export default async function ScheduleToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const hasAccess = isAdmin || roles.some((r) => ["HOST", "HOST_MANAGER"].includes(r));

  if (!hasAccess) {
    return (
      <div className="tools-unauthorized">
        You don&rsquo;t have permission to access this tool.
      </div>
    );
  }

  let backHref = "/account/dashboard";
  let backLabel = "Dashboard";

  const hub = await db.hub.findUnique({ where: { slug: "host-team" }, select: { id: true, name: true } });
  if (hub) {
    const member = await db.hubMember.findUnique({
      where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
    });
    if (member || isAdmin) {
      backHref = "/account/hub/host-team";
      backLabel = hub.name;
    }
  }

  return (
    <ToolsProvider value={{ toolName: "Schedule", backHref, backLabel }}>
      {children}
    </ToolsProvider>
  );
}
