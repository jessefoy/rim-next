"use client";

/**
 * WorkspaceShell — client wrapper used by tool layouts.
 *
 * Decision tree:
 *   - If the URL has ?hub=<slug>: fetch the hub's nav data and render the
 *     shared HubWorkspaceSidebar. The tool content lives in the main area.
 *   - If no ?hub= param: fall back to the thin ToolsNav chrome, so a direct
 *     tool visit (e.g. from /admin or a bookmark) still has a back link.
 *
 * Tool sub-nav (Series/Lessons etc.) is rendered at the top of the content
 * area in both modes — via ToolsContext.subNav.
 *
 * Why a client component: Next.js 16 server layouts don't receive searchParams,
 * so the hub-aware decision happens on the client via useSearchParams().
 *
 * CSS prefix: hub-ws-, tools-
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import HubWorkspaceSidebar, {
  type SidebarTool,
  type SidebarNavCounts,
} from "./HubWorkspaceSidebar";
import ToolsNav from "./ToolsNav";
import { useToolsContext } from "./ToolsContext";

interface HubNavResponse {
  hub: {
    slug: string;
    name: string;
    type: "OPERATIONAL" | "GOVERNANCE" | "COMMUNITY_GROUP";
    memberCount: number;
    coordinatorNames: string[];
  };
  tools: SidebarTool[];
  navCounts: SidebarNavCounts;
  isCoordinator: boolean;
  isAdmin: boolean;
}

interface Props {
  children: React.ReactNode;
  /** Content width. "wide" = 1200px (default for tool surfaces), "reading" = 760px. */
  variant?: "wide" | "reading";
}

export default function WorkspaceShell({ children, variant = "wide" }: Props) {
  const searchParams = useSearchParams();
  const hubSlug = searchParams.get("hub");
  const pathname = usePathname();
  const { toolName, subNav } = useToolsContext();

  const [nav, setNav] = useState<HubNavResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hubSlug) return;
    let cancelled = false;
    fetch(`/api/hubs/${encodeURIComponent(hubSlug)}/nav`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (!cancelled) setNav(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hubSlug]);

  const subNavBar = subNav && subNav.length > 0 ? (
    <div className="hub-ws-subnav">
      <div className="hub-ws-subnav__inner">
        {subNav.map((item) => {
          const qs = hubSlug
            ? (item.href.includes("?") ? `&hub=${hubSlug}` : `?hub=${hubSlug}`)
            : "";
          const href = item.href + qs;
          const isActive =
            pathname === item.href ||
            (item.href !== subNav[0]?.href && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={href}
              className={`hub-ws-subnav__link${isActive ? " hub-ws-subnav__link--active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  ) : null;

  // No hub context — keep the existing thin chrome.
  if (!hubSlug || failed) {
    return (
      <>
        <ToolsNav />
        <div className="tools-content">
          {subNavBar}
          {children}
        </div>
      </>
    );
  }

  return (
    <div className="hub-ws-layout">
      {nav && (
        <HubWorkspaceSidebar
          hub={nav.hub}
          tools={nav.tools}
          navCounts={nav.navCounts}
          isCoordinator={nav.isCoordinator}
          isAdmin={nav.isAdmin}
        />
      )}
      <div className="hub-ws-main">
        {toolName && (
          <div className="hub-ws-toolhead">
            <h1 className="hub-ws-toolhead__name">{toolName}</h1>
          </div>
        )}
        {subNavBar}
        <div className={`hub-ws-content hub-ws-content--${variant}`}>{children}</div>
      </div>
    </div>
  );
}
