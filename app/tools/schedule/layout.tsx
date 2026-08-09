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

  // The layout can't read `?hub=` (Next 16 layouts have no searchParams),
  // so the back-link starts at host-team as the safe default. When the
  // user is *in* a hub view (?hub= present), `WorkspaceShell` renders
  // its own hub sidebar with a hub-scoped back affordance, so this
  // fallback is only seen by direct-entry admins.
  let backHref = "/account/dashboard";
  let backLabel = "My RIM";

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
      // Generic across hubs — the hub name itself is in the sidebar
      // ("OPERATIONAL HUB / Greeter"), so "Scheduler" reads correctly
      // whether the user is in host-team, peer-led, audio-visual, or
      // greeter. Renamed from "Host Schedule" in session 129 once
      // multiple hubs started using this tool.
      toolName: "Scheduler",
      backHref,
      backLabel,
    }}>
      <WorkspaceShell variant="wide">{children}</WorkspaceShell>
    </ToolsProvider>
  );
}
