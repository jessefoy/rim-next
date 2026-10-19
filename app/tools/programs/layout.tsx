/**
 * Programs tool layout — wraps /tools/programs/* with ToolsProvider.
 * Gate: the Registrar, Admin or Guiding Teacher role (canUseProgramManager),
 * the same rule as every page and API behind it (Jesse, 2026-10-19).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ToolsProvider } from "@/components/ToolsContext";
import WorkspaceShell from "@/components/WorkspaceShell";
import { canUseProgramManager } from "@/lib/toolAuth";

export default async function ProgramsToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const hasAccess = canUseProgramManager(roles);

  if (!hasAccess) {
    return (
      <div className="tools-unauthorized">
        You don&rsquo;t have permission to access this tool.
      </div>
    );
  }

  // Resolve back link: check if user is in the registrar hub
  let backHref = "/account/dashboard";
  let backLabel = "My RIM";

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
      <WorkspaceShell variant="wide">{children}</WorkspaceShell>
    </ToolsProvider>
  );
}
