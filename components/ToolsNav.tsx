"use client";

/**
 * ToolsNav — thin top bar for /tools/* routes when reached WITHOUT ?hub=.
 *
 * In the hub workspace (with ?hub=<slug>), the full sidebar takes over and
 * this bar is not rendered. This fallback chrome exists so a direct-entry
 * user (admin bookmark, /admin link, etc.) still has a back link.
 *
 * Sub-nav tabs are rendered in the content area by WorkspaceShell, not here.
 *
 * CSS prefix: tools-nav-
 */

import Link from "next/link";
import { useToolsContext } from "@/components/ToolsContext";

export default function ToolsNav() {
  const { toolName, backHref, backLabel } = useToolsContext();

  return (
    <header className="tools-nav">
      <div className="tools-nav__inner">
        <div className="tools-nav__left">
          <Link href={backHref} className="tools-nav__back">
            &larr; {backLabel}
          </Link>
        </div>
        <div className="tools-nav__right">
          <span className="tools-nav__name">{toolName}</span>
        </div>
      </div>
    </header>
  );
}
