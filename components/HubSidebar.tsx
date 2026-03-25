"use client";

/**
 * HubSidebar — left sidebar navigation for /account/hub/[slug]/* routes.
 * Replaces HubHeader + HubNavStrip with a persistent vertical nav.
 *
 * CSS prefix: hub-sb-
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getToolBySlug } from "@/lib/toolRegistry";

interface HubMemberRow {
  isCoordinator: boolean;
  user: { firstName: string | null; lastName: string | null; preferredName: string | null };
}

interface AppLinkRow {
  id: string;
  toolSlug: string | null;
  label: string;
  href: string;
  isEnabled: boolean;
  order: number;
}

interface NavItem {
  label: string;
  href: string;
  badge?: number | null;
}

interface Props {
  hub: {
    slug: string;
    name: string;
    type: "OPERATIONAL" | "GOVERNANCE" | "COMMUNITY_GROUP";
    members: HubMemberRow[];
    appLinks: AppLinkRow[];
  };
  navItems: NavItem[];
  isCoordinator: boolean;
  isAdmin: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  OPERATIONAL: "Operational Hub",
  GOVERNANCE: "Governance Hub",
  COMMUNITY_GROUP: "Community Group",
};

const NAV_ICONS: Record<string, string> = {
  Home: "\u2302",          // ⌂
  Conversations: "\u25CE", // ◎
  Tasks: "\u2611",         // ☑
  Documents: "\u229E",     // ⊞
  Members: "\u25F7",       // ◷
  Series: "\u25A4",        // ▤
  Lessons: "\u25A5",       // ▥
  Programs: "\u25A3",      // ▣
};

function displayName(u: HubMemberRow["user"]) {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "\u2014";
}

export default function HubSidebar({ hub, navItems, isCoordinator, isAdmin }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const coordinators = hub.members.filter((m) => m.isCoordinator);
  const enabledAppLinks = hub.appLinks.filter((l) => l.isEnabled).sort((a, b) => a.order - b.order);

  function isActive(href: string) {
    const isRoot = navItems[0]?.href === href;
    if (isRoot) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const sidebarContent = (
    <>
      {/* Identity */}
      <div className="hub-sb-identity">
        <div className="hub-sb-type">{TYPE_LABEL[hub.type] ?? hub.type}</div>
        <div className="hub-sb-name">{hub.name}</div>
        <div className="hub-sb-meta">
          {hub.members.length} member{hub.members.length !== 1 ? "s" : ""}
          {coordinators.length > 0 && (
            <> &middot; {coordinators.map((c) => displayName(c.user)).join(", ")}</>
          )}
        </div>
      </div>

      {/* Core nav */}
      <nav className="hub-sb-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`hub-sb-item${isActive(item.href) ? " hub-sb-item--active" : ""}`}
            onClick={() => setMobileOpen(false)}
          >
            <span className="hub-sb-item__icon">{NAV_ICONS[item.label] ?? "\u25CB"}</span>
            <span className="hub-sb-item__label">{item.label}</span>
            {item.badge != null && item.badge > 0 && (
              <span className="hub-sb-item__badge">{item.badge}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* Tools */}
      {enabledAppLinks.length > 0 && (
        <>
          <div className="hub-sb-divider" />
          <div className="hub-sb-group">
            <div className="hub-sb-group-label">Tools</div>
            {enabledAppLinks.map((link) => {
              const basePath = link.toolSlug
                ? (getToolBySlug(link.toolSlug)?.path ?? link.href)
                : link.href;
              const toolHref = basePath.includes("?")
                ? `${basePath}&hub=${hub.slug}`
                : `${basePath}?hub=${hub.slug}`;
              return (
              <Link
                key={link.id}
                href={toolHref}
                className="hub-sb-tool"
                onClick={() => setMobileOpen(false)}
              >
                <span className="hub-sb-item__label">{link.label}</span>
                <span className="hub-sb-tool__arrow">{"\u2197"}</span>
              </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Footer — settings link */}
      {(isCoordinator || isAdmin) && (
        <div className="hub-sb-footer">
          <Link
            href={`/admin/hubs/${hub.slug}/edit`}
            className="hub-sb-item"
            onClick={() => setMobileOpen(false)}
          >
            <span className="hub-sb-item__icon">{"\u2699"}</span>
            <span className="hub-sb-item__label">Hub settings</span>
          </Link>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="hub-sb-mobile-bar">
        <button
          className="hub-sb-mobile-toggle"
          onClick={() => setMobileOpen(true)}
          aria-label="Open hub menu"
        >
          &#9776;
        </button>
        <span className="hub-sb-mobile-name">{hub.name}</span>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="hub-sb-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`hub-sidebar${mobileOpen ? " hub-sidebar--open" : ""}`}>
        {sidebarContent}
      </aside>
    </>
  );
}
