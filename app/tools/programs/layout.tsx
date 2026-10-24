/**
 * Programs tool layout — wraps /tools/programs/* with ToolsProvider.
 * Gate: canUsePrograms, the three roles or a member of a team with Programs
 * installed (Jesse, 2026-10-24; it was the roles only from 2026-10-19). The
 * archive, delete, guest-link reset and categories keep the roles' own gate.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ToolsProvider } from "@/components/ToolsContext";
import WorkspaceShell from "@/components/WorkspaceShell";
import { canUsePrograms } from "@/lib/toolAuth";

export default async function ProgramsToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const hasAccess = await canUsePrograms(session.user.id, roles);

  if (!hasAccess) {
    return (
      <div className="tools-unauthorized">
        You don&rsquo;t have permission to access this tool.
      </div>
    );
  }

  // Back to the person's team with Programs: the Registration team, else
  // Program Central (admins: the Registration team).
  let backHref = "/account/dashboard";
  let backLabel = "My RIM";
  for (const slug of ["registrar", "program-central"]) {
    const hub = await db.hub.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!hub) continue;
    const member = await db.hubMember.findUnique({
      where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
    });
    if (member || (isAdmin && slug === "registrar")) {
      backHref = `/account/hub/${slug}`;
      backLabel = hub.name;
      break;
    }
  }

  return (
    <ToolsProvider value={{ toolName: "Programs", backHref, backLabel }}>
      <WorkspaceShell variant="wide">{children}</WorkspaceShell>
    </ToolsProvider>
  );
}
