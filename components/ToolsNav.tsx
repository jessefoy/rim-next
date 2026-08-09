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

  // For a hub member the back link goes to their hub, so "My RIM" is a
  // second, distinct destination worth its own link. When the back link
  // already IS the dashboard, a duplicate would just be noise.
  const showHomeLink = backHref !== "/account/dashboard";

  return (
    <header className="tools-nav">
      <div className="tools-nav__inner">
        <div className="tools-nav__left">
          <Link href={backHref} className="tools-nav__back">
            &larr; {backLabel}
          </Link>
          {showHomeLink && (
            <Link href="/account/dashboard" className="tools-nav__back tools-nav__home">
              My RIM
            </Link>
          )}
        </div>
        <div className="tools-nav__right">
          <span className="tools-nav__name">{toolName}</span>
        </div>
      </div>
    </header>
  );
}
