/**
 * Helping with layout (2026-10-24, Phase 3 slice 5) — wraps /tools/helping/*.
 * Sign-in only here: each page gates by its own team (`?hub=`, which a layout
 * can't read) through helpingTeamAccess (lib/programHelpers.ts). Launched
 * from a team, WorkspaceShell shows that team's rail.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ToolsProvider } from "@/components/ToolsContext";
import WorkspaceShell from "@/components/WorkspaceShell";

export default async function HelpingToolLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  return (
    <ToolsProvider value={{ toolName: "Helping with", backHref: "/account/teams", backLabel: "My Teams" }}>
      <WorkspaceShell variant="wide">{children}</WorkspaceShell>
    </ToolsProvider>
  );
}
