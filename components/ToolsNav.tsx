"use client";

/**
 * ToolsNav — top nav bar for /tools/* routes.
 * Replaces the site nav. Shows tool name on the left,
 * optional sub-navigation in the center, back link on the right.
 *
 * CSS prefix: tools-nav-
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useToolsContext } from "@/components/ToolsContext";

export default function ToolsNav() {
  const { toolName, backHref, backLabel, subNav } = useToolsContext();
  const pathname = usePathname();

  return (
    <header className="tools-nav">
      <div className="tools-nav__inner">
        <div className="tools-nav__left">
          <span className="tools-nav__name">{toolName}</span>
        </div>

        <div className="tools-nav__center">
          {subNav && subNav.length > 0 && (
            <nav className="tools-nav__subnav">
              {subNav.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== subNav[0]?.href && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`tools-nav__subnav-link${isActive ? " tools-nav__subnav-link--active" : ""}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="tools-nav__right">
          <Link href={backHref} className="tools-nav__back">
            &larr; {backLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
