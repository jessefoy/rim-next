/**
 * Schedule tool layout — wraps /tools/schedule/* with ToolsProvider.
 * Role gate: HOST, HOST_MANAGER, or ADMIN, or individual UserToolAccess grant.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ToolsProvider } from "@/components/ToolsContext";
import WorkspaceShell from "@/components/WorkspaceShell";
import { hasToolAccess } from "@/lib/toolAuth";
import { DEFAULT_HOSTING_HUB_SLUG } from "@/lib/programHub";

export default async function ScheduleToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const hasAccess = await hasToolAccess(session.user.id, roles, ["HOST", "HOST_MANAGER"], "schedule");

  if (!hasAccess) {
    return (
      <div className="tools-unauthorized">
        You don&rsquo;t have permission to access this tool.
      </div>
    );
  }

  // Back link defaults to host-team but a future enhancement can read the
  // active hub from `?hub=` and route the back-link to the matching hub
  // (Silent Meditation, etc.). Slice 1 ships the schedule scoping; the
  // ToolsProvider context API doesn't currently take searchParams at the
  // layout level, and threading the active hub from the page would be a
  // larger ToolsContext refactor than Slice 1 warrants. Hold the back link
  // at host-team for now — peer-leaders following the link land on their
  // overlap with the host-team workspace, which is harmless.
  let backHref = "/account/dashboard";
  let backLabel = "Home";

  const hub = await db.hub.findUnique({
    where: { slug: DEFAULT_HOSTING_HUB_SLUG },
    select: { id: true, name: true },
  });
  if (hub) {
    const member = await db.hubMember.findUnique({
      where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
    });
    if (member || isAdmin) {
      backHref = `/account/hub/${DEFAULT_HOSTING_HUB_SLUG}`;
      backLabel = hub.name;
    }
  }

  return (
    <ToolsProvider value={{
      toolName: "Host Schedule",
      backHref,
      backLabel,
    }}>
      <WorkspaceShell variant="wide">{children}</WorkspaceShell>
    </ToolsProvider>
  );
}
