"use client";

/**
 * HubTabBar — horizontal tab navigation for hub pages.
 * Replaces the vertical HubSidebar. Renders inside AccountLayout's content area.
 *
 * CSS prefix: hub-tabs-
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getToolBySlug } from "@/lib/toolRegistry";

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
}

interface Props {
  slug: string;
  hubName: string;
  hubType: "OPERATIONAL" | "GOVERNANCE" | "COMMUNITY_GROUP";
  memberCount: number;
  navItems: NavItem[];
  appLinks: AppLinkRow[];
  isCoordinator: boolean;
  isAdmin: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  OPERATIONAL: "Operational Hub",
  GOVERNANCE: "Governance Hub",
  COMMUNITY_GROUP: "Community Group",
};

export default function HubTabBar({
  slug,
  hubName,
  hubType,
  memberCount,
  navItems,
  appLinks,
  isCoordinator,
  isAdmin,
}: Props) {
  const pathname = usePathname();

  const enabledAppLinks = appLinks
    .filter((l) => l.isEnabled)
    .sort((a, b) => a.order - b.order);

  function isActive(href: string) {
    const isRoot = navItems[0]?.href === href;
    if (isRoot) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="hub-tabs-wrap">
      {/* Hub identity */}
      <div className="hub-tabs-header">
        <div className="hub-tabs-header__type">{TYPE_LABEL[hubType] ?? hubType}</div>
        <h1 className="hub-tabs-header__name">{hubName}</h1>
        <div className="hub-tabs-header__meta">
          {memberCount} member{memberCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Tab bar */}
      <div className="hub-tabs-bar">
        <div className="hub-tabs-bar__tabs">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`hub-tabs-tab${isActive(item.href) ? " hub-tabs-tab--active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Tool links + settings */}
        {(enabledAppLinks.length > 0 || isCoordinator || isAdmin) && (
          <div className="hub-tabs-bar__tools">
            {enabledAppLinks.map((link) => {
              const basePath = link.toolSlug
                ? (getToolBySlug(link.toolSlug)?.path ?? link.href)
                : link.href;
              const toolHref = basePath.includes("?")
                ? `${basePath}&hub=${slug}`
                : `${basePath}?hub=${slug}`;
              return (
                <Link key={link.id} href={toolHref} className="hub-tabs-tool">
                  {link.label} ↗
                </Link>
              );
            })}
            {(isCoordinator || isAdmin) && (
              <Link href={`/admin/hubs/${slug}/edit`} className="hub-tabs-settings">
                Settings
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
