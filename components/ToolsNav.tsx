"use client";

/**
 * ToolsNav — top nav bar for /tools/* routes.
 * Replaces the site nav. Shows tool name on the left,
 * back link to associated hub (or dashboard) on the right.
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
          <span className="tools-nav__name">{toolName}</span>
        </div>

        <div className="tools-nav__center" />

        <div className="tools-nav__right">
          <Link href={backHref} className="tools-nav__back">
            &larr; {backLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
