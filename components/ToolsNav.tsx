"use client";

/**
 * ToolsNav — thin top bar for /tools/* routes when reached WITHOUT ?hub=.
 *
 * In the hub workspace (with ?hub=<slug>), the full sidebar takes over and
 * this bar is not rendered. This fallback chrome exists so a direct-entry
 * user (admin bookmark, /admin link, etc.) still has a back link.
 *
 * Sub-nav tabs are rendered in the content area by WorkspaceShell, not here.
 * It sits under the site header, which carries My Home (2026-10-13).
 *
 * CSS prefix: tools-nav-
 */

import Link from "next/link";
import { signOut } from "next-auth/react";
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
          {/* No rail here, so the bar carries what a rail's foot would (on
              phones the site header's Menu has both instead). */}
          <Link href="/account/dashboard-my-profile" className="tools-nav__back tools-nav__account">
            My Profile
          </Link>
          <button
            type="button"
            className="tools-nav__back tools-nav__account tools-nav__signout"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign out
          </button>
        </div>
        <div className="tools-nav__right">
          <span className="tools-nav__name">{toolName}</span>
        </div>
      </div>
    </header>
  );
}
