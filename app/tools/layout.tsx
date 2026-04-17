/**
 * Tools outer layout — auth gate only.
 *
 * Each specific tool (schedule, inbox, programs, learning) wraps its content
 * in <WorkspaceShell> via its own layout. WorkspaceShell decides between the
 * hub sidebar (when ?hub=<slug> is present) and the thin ToolsNav chrome.
 *
 * We do NOT wrap in AccountLayout here — tools are their own workspace and
 * the outer AccountSidebar would duplicate navigation.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return <div className="tools-shell">{children}</div>;
}
