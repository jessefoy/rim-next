/**
 * Learning tool layout — wraps /tools/learning/* with ToolsProvider.
 * Role gate: TEACHER or ADMIN (or individual UserToolAccess grant).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ToolsProvider } from "@/components/ToolsContext";
import WorkspaceShell from "@/components/WorkspaceShell";
import { hasToolAccess } from "@/lib/toolAuth";

export default async function LearningToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasAccess = await hasToolAccess(session.user.id, roles, ["TEACHER"], "learning");

  if (!hasAccess) {
    return (
      <div className="tools-unauthorized">
        You don&rsquo;t have permission to access this tool.
      </div>
    );
  }

  // Resolve back link: check if user is in the courses hub
  let backHref = "/account/dashboard";
  let backLabel = "Dashboard";

  const hub = await db.hub.findUnique({ where: { slug: "courses" }, select: { id: true, name: true } });
  if (hub) {
    const member = await db.hubMember.findUnique({
      where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
    });
    if (member || roles.includes("ADMIN")) {
      backHref = "/account/hub/courses";
      backLabel = hub.name;
    }
  }

  return (
    <ToolsProvider value={{
      toolName: "Course Manager",
      backHref,
      backLabel,
      subNav: [
        { label: "Series", href: "/tools/learning" },
        { label: "Lessons", href: "/tools/learning/lessons" },
      ],
    }}>
      <WorkspaceShell variant="wide">{children}</WorkspaceShell>
    </ToolsProvider>
  );
}
