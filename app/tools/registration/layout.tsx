/**
 * Registration app layout (2026-10-23) — wraps /tools/registration/*.
 * Gate: the Registrar, Admin or Guiding Teacher role (canUseRegistration),
 * the same rule as every API behind it. Role only: team membership alone
 * never opens people's contact details and answers.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ToolsProvider } from "@/components/ToolsContext";
import WorkspaceShell from "@/components/WorkspaceShell";
import { canUseRegistration } from "@/lib/toolAuth";

export default async function RegistrationToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!canUseRegistration(roles)) {
    return (
      <div className="tools-unauthorized">
        You don&rsquo;t have permission to access this tool.
      </div>
    );
  }

  // Back to the Registration team's Space for its members (and admins).
  let backHref = "/account/dashboard";
  let backLabel = "My RIM";
  const hub = await db.hub.findUnique({ where: { slug: "registrar" }, select: { id: true, name: true } });
  if (hub) {
    const member = await db.hubMember.findUnique({
      where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
    });
    if (member || roles.includes("ADMIN")) {
      backHref = "/account/hub/registrar";
      backLabel = hub.name;
    }
  }

  return (
    <ToolsProvider value={{ toolName: "Registration", backHref, backLabel }}>
      <WorkspaceShell variant="wide">{children}</WorkspaceShell>
    </ToolsProvider>
  );
}
