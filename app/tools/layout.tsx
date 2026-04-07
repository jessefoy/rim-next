/**
 * Tools layout — shared shell for all /tools/* routes.
 *
 * Architecture decision: Props flow via ToolsContext (React context).
 * Each tool subdirectory has its own layout that wraps children in
 * <ToolsProvider> with tool-specific config (name, back link).
 * This outer layout provides auth gating and wraps in AccountLayout
 * so the sidebar is visible.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccountLayout from "@/components/AccountLayout";

export default async function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AccountLayout>
      <div className="tools-shell">
        {children}
      </div>
    </AccountLayout>
  );
}
