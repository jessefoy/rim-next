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
 *   TEAM  — Home, Conversations, Documents, Members (with badges)
 *
 * Mobile: slide-in drawer opened by a hamburger bar at the top.
 * Desktop: collapsible icon rail (persisted in localStorage).
 *
 * CSS prefix: hub-ws-
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquare,
  FileText,
  Users,
  Briefcase,
  Settings,
  Trash2,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  Activity,
  FolderOpen,
} from "lucide-react";

export interface SidebarTool {
  slug: string;
  label: string;
  path: string;
  badgeCount?: number;
}

export interface SidebarNavCounts {
  conversations?: number;
}

interface Props {
  hub: {
    slug: string;
    name: string;
    type: "OPERATIONAL" | "GOVERNANCE" | "COMMUNITY_GROUP";
    memberCount: number;
    coordinatorNames: string[];
    /** Google Workspace Files tab (RIM_GoogleWorkspace.md) — on only when
     *  the hub's switch is enabled AND a drive is mapped. */
    filesEnabled?: boolean;
    /** Open-to-all Space (Community, session 165): membership is universal, so
     *  there's no roster and no per-hub coordinators — hide Documents (native,
     *  being retired) + Members, leaving the participation surfaces. */
    openToAll?: boolean;
    /** Per-hub Conversations switch (session 165). Default on; when off, the
     *  Conversations tab is hidden (and its routes deny). */
    conversationsEnabled?: boolean;
  };
  tools: SidebarTool[];
  navCounts: SidebarNavCounts;
  isCoordinator: boolean;
  canManageTrash?: boolean;
  isAdmin: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  OPERATIONAL: "Operational Hub",
  GOVERNANCE: "Governance Hub",
  COMMUNITY_GROUP: "Community Group",
};

const COLLAPSE_KEY = "rim-hub-sidebar-collapsed";

function firstNameOnly(fullName: string) {
  return fullName.split(/\s+/).filter(Boolean)[0] ?? fullName;
}

function coordinatorSummary(names: string[]): string {
  if (names.length === 0) return "";
  const firsts = names.map(firstNameOnly);
  if (firsts.length <= 2) return firsts.join(" & ");
  return `${firsts.slice(0, 2).join(", ")} +${firsts.length - 2} more`;
}

export default function HubWorkspaceSidebar({
  hub,
  tools,
  navCounts,
  isCoordinator,
  canManageTrash: canTrash = false,
  isAdmin,
}: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {}
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }

  const base = `/account/hub/${hub.slug}`;
  // Single flat nav. Tools (Schedule, Inbox, Programs, etc.) appear right
  // under Home so the most-used surface is at the top of the list. Below
  // are the universal hub features. No Work/Team section split — for hubs
  // with one tool the divider was visual overhead.
  const homeItem = { label: "Home", href: base, icon: Home, badge: 0 };
  const filesItem = hub.filesEnabled
    ? [{ label: "Files", href: `${base}/files`, icon: FolderOpen, badge: 0 }]
    : [];
  const convEnabled = hub.conversationsEnabled ?? true;
  const conversationsItem = convEnabled
    ? [{ label: "Conversations", href: `${base}/conversations`, icon: MessageSquare, badge: navCounts.conversations ?? 0 }]
    : [];
  // An open-to-all Space (Community) shows only the participation surfaces:
  // Activity + Conversations (only while Conversations is on — Activity is just
  // conversation activity there) and Files (always). Documents (native, being
  // retired) and Members (no roster when membership is universal) are hidden.
  const otherItems = hub.openToAll
    ? [
        ...(convEnabled
          ? [{ label: "Activity", href: `${base}/activity`, icon: Activity, badge: 0 }]
          : []),
        ...conversationsItem,
        ...filesItem,
      ]
    : [
        { label: "Activity",      href: `${base}/activity`,      icon: Activity,      badge: 0 },
        ...conversationsItem,
        { label: "Documents",     href: `${base}/documents`,     icon: FileText,      badge: 0 },
        // Files (Google Workspace) coexists with Documents until the cutover
        // slice retires the native path — RIM_GoogleWorkspace.md §4.
        ...filesItem,
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

  const coordSummary = coordinatorSummary(hub.coordinatorNames);
  // An open-to-all Space has no roster — a member count ("0 members") would
  // misread, so name the openness instead.
  const metaLine = hub.openToAll
    ? "Open to all members"
    : [
        coordSummary,
        `${hub.memberCount} ${hub.memberCount === 1 ? "member" : "members"}`,
      ].filter(Boolean).join(" · ");

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
        className={[
          "hub-ws-sidebar",
          mobileOpen && "hub-ws-sidebar--open",
          collapsed && "hub-ws-sidebar--collapsed",
        ].filter(Boolean).join(" ")}
        aria-label="Hub navigation"
        data-collapsed={collapsed ? "true" : "false"}
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
          <button
            className="hub-ws-collapse"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed
              ? <ChevronsRight size={15} strokeWidth={1.75} />
              : <ChevronsLeft size={15} strokeWidth={1.75} />}
          </button>
          {collapsed ? (
            <div className="hub-ws-identity__mark" aria-label={hub.name}>
              {hub.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "H"}
            </div>
          ) : (
            <>
              <div className="hub-ws-identity__type">{TYPE_LABEL[hub.type] ?? hub.type}</div>
              <div className="hub-ws-identity__name">{hub.name}</div>
              {metaLine && <div className="hub-ws-identity__meta">{metaLine}</div>}
            </>
          )}
        </div>

        <div className="hub-ws-divider" aria-hidden="true" />

        {/* Single flat nav: Home → tools → universal features */}
        <div className="hub-ws-group">
          {/* Home */}
          {(() => {
            const active = isActive(homeItem.href, true);
            return (
              <Link
                href={homeItem.href}
                className={`hub-ws-link${active ? " hub-ws-link--active" : ""}`}
                title={collapsed ? homeItem.label : undefined}
              >
                <homeItem.icon size={18} strokeWidth={1.75} className="hub-ws-link__icon" />
                <span className="hub-ws-link__label">{homeItem.label}</span>
              </Link>
            );
          })()}

          {/* Tools — sit immediately under Home as primary work links */}
          {tools.map((tool) => {
            const active = isToolActive(tool.path);
            return (
              <Link
                key={tool.slug}
                href={toolHref(tool.path)}
                className={`hub-ws-link hub-ws-link--primary${active ? " hub-ws-link--active" : ""}`}
                title={collapsed ? tool.label : undefined}
              >
                <Briefcase size={18} strokeWidth={1.75} className="hub-ws-link__icon" />
                <span className="hub-ws-link__label">{tool.label}</span>
                {tool.badgeCount !== undefined && tool.badgeCount > 0 && (
                  <span className="hub-ws-badge hub-ws-badge--primary">{tool.badgeCount}</span>
                )}
              </Link>
            );
          })}

          {/* Universal hub features */}
          {otherItems.map((item) => {
            const exact = item.href === base;
            const active = isActive(item.href, exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`hub-ws-link${active ? " hub-ws-link--active" : ""}`}
                title={collapsed ? item.label : undefined}
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
          {(canTrash || isCoordinator || isAdmin) && (
            <Link
              href={`${base}/trash`}
              className={`hub-ws-footer__link${pathname === `${base}/trash` ? " hub-ws-footer__link--active" : ""}`}
              title={collapsed ? "Trash" : undefined}
            >
              <Trash2 size={16} strokeWidth={1.75} />
              <span>Trash</span>
            </Link>
          )}
          {/* Hub settings link goes to /admin/hubs/[slug]/edit, which is
              ADMIN-only (hub config: slug, type, app links, coordinators).
              Coordinators don't see it because they can't follow it.
              Per-hub content editing (welcome, home) is a separate surface —
              inline for host hub, deferred for others. */}
          {isAdmin && (
            <Link
              href={`/admin/hubs/${hub.slug}/edit`}
              className="hub-ws-footer__link"
              title={collapsed ? "Hub settings" : undefined}
            >
              <Settings size={16} strokeWidth={1.75} />
              <span>Hub settings</span>
            </Link>
          )}
          <Link
            href="/account/dashboard"
            className="hub-ws-footer__link"
            title={collapsed ? "Back to Home" : undefined}
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
            <span>Back to Home</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
