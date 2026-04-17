"use client";

/**
 * HubWorkspaceSidebar — unified left rail for hub + its tools.
 *
 * Replaces HubTabBar (horizontal) and ToolsNav (top bar). Stays visible when
 * navigating into /tools/* with ?hub=<slug>, so the hub and its tools feel
 * like one workspace.
 *
 * Two groups:
 *   WORK  — the hub's primary tool (with badge count)
 *   TEAM  — Home, Conversations, Tasks, Documents, Members (with badges)
 *
 * Mobile: slide-in drawer opened by a hamburger bar at the top.
 *
 * CSS prefix: hub-ws-
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquare,
  CheckSquare,
  FileText,
  Users,
  Briefcase,
  Settings,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";

export interface SidebarTool {
  slug: string;
  label: string;
  path: string;
  badgeCount?: number;
}

export interface SidebarNavCounts {
  conversations?: number;
  tasks?: number;
}

interface Props {
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

const TYPE_LABEL: Record<string, string> = {
  OPERATIONAL: "Operational Hub",
  GOVERNANCE: "Governance Hub",
  COMMUNITY_GROUP: "Community Group",
};

export default function HubWorkspaceSidebar({
  hub,
  tools,
  navCounts,
  isCoordinator,
  isAdmin,
}: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const base = `/account/hub/${hub.slug}`;
  const teamItems = [
    { label: "Home",          href: base,                    icon: Home,         badge: 0 },
    { label: "Conversations", href: `${base}/conversations`, icon: MessageSquare, badge: navCounts.conversations ?? 0 },
    { label: "Tasks",         href: `${base}/tasks`,         icon: CheckSquare,   badge: navCounts.tasks ?? 0 },
    { label: "Documents",     href: `${base}/documents`,     icon: FileText,      badge: 0 },
    { label: "Members",       href: `${base}/members`,       icon: Users,         badge: 0 },
  ];

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  function isToolActive(toolPath: string) {
    return pathname === toolPath || pathname.startsWith(toolPath + "/");
  }

  function toolHref(path: string) {
    const qs = path.includes("?") ? `&hub=${hub.slug}` : `?hub=${hub.slug}`;
    return path + qs;
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="hub-ws-mobilebar">
        <button
          className="hub-ws-mobilebar__btn"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <div className="hub-ws-mobilebar__name">{hub.name}</div>
      </div>

      {/* Backdrop (mobile only) */}
      {mobileOpen && (
        <div
          className="hub-ws-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        className={`hub-ws-sidebar${mobileOpen ? " hub-ws-sidebar--open" : ""}`}
        aria-label="Hub navigation"
      >
        {/* Identity */}
        <div className="hub-ws-identity">
          <button
            className="hub-ws-close"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
          <div className="hub-ws-identity__type">{TYPE_LABEL[hub.type] ?? hub.type}</div>
          <div className="hub-ws-identity__name">{hub.name}</div>
          {hub.coordinatorNames.length > 0 && (
            <div className="hub-ws-identity__meta">
              Coordinated by {hub.coordinatorNames.join(", ")}
            </div>
          )}
          <div className="hub-ws-identity__meta">
            {hub.memberCount} {hub.memberCount === 1 ? "member" : "members"}
          </div>
        </div>

        {/* WORK group */}
        {tools.length > 0 && (
          <div className="hub-ws-group">
            <div className="hub-ws-group__label">Work</div>
            {tools.map((tool) => {
              const active = isToolActive(tool.path);
              return (
                <Link
                  key={tool.slug}
                  href={toolHref(tool.path)}
                  className={`hub-ws-link hub-ws-link--primary${active ? " hub-ws-link--active" : ""}`}
                >
                  <Briefcase size={18} strokeWidth={1.75} className="hub-ws-link__icon" />
                  <span className="hub-ws-link__label">{tool.label}</span>
                  {tool.badgeCount !== undefined && tool.badgeCount > 0 && (
                    <span className="hub-ws-badge hub-ws-badge--primary">{tool.badgeCount}</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* TEAM group */}
        <div className="hub-ws-group">
          <div className="hub-ws-group__label">Team</div>
          {teamItems.map((item) => {
            const exact = item.href === base;
            const active = isActive(item.href, exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`hub-ws-link${active ? " hub-ws-link--active" : ""}`}
              >
                <item.icon size={18} strokeWidth={1.75} className="hub-ws-link__icon" />
                <span className="hub-ws-link__label">{item.label}</span>
                {item.badge > 0 && <span className="hub-ws-badge">{item.badge}</span>}
              </Link>
            );
          })}
        </div>

        {/* Footer: settings + back */}
        <div className="hub-ws-footer">
          {(isCoordinator || isAdmin) && (
            <Link href={`/admin/hubs/${hub.slug}/edit`} className="hub-ws-footer__link">
              <Settings size={16} strokeWidth={1.75} />
              <span>Hub settings</span>
            </Link>
          )}
          <Link href="/account/dashboard" className="hub-ws-footer__link">
            <ChevronLeft size={16} strokeWidth={1.75} />
            <span>Back to dashboard</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
