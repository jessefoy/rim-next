/**
 * Tools layout — shared shell for all /tools/* routes.
 *
 * Architecture decision: Props flow via ToolsContext (React context).
 * Each tool subdirectory has its own layout that wraps children in
 * <ToolsProvider> with tool-specific config (name, back link).
 * This outer layout provides auth gating and renders ToolsNav,
 * which reads from ToolsContext.
 *
 * The site Nav returns null for /tools/* paths (handled in Nav.tsx).
 * The footer is suppressed for /tools/* (handled in FooterWrapper.tsx).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ToolsNav from "@/components/ToolsNav";

export default async function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="tools-shell">
      <ToolsNav />
      <div className="tools-content">
        {children}
      </div>
    </div>
  );
}
