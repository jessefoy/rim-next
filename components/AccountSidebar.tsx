"use client";

/**
 * AccountSidebar — role-aware nav for all /account/* pages.
 *
 * Desktop: quiet rail that can collapse to return working width.
 * Mobile: horizontal scroll strip below the member header.
 *
 * CSS prefix: ac-
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarCheck,
  BookOpen,
  UserCircle,
  Users,
  HouseHeart,
  Layers,
  Mail,
  ChevronDown,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
  Settings,
  UsersRound,
} from "lucide-react";

interface HubLink {
  slug: string;
  name: string;
}

interface Props {
  roles: string[];
  hubLinks?: HubLink[];
}

type LucideIcon = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

const MEMBER_LINKS: NavLink[] = [
  // "My Home", not "Home" — the member-bar now carries a "Main site" link, so
  // an unqualified "Home" would read as the public home page.
  { label: "My Home",          href: "/account/dashboard",            icon: Home          },
  { label: "My Registrations", href: "/account/programs",             icon: CalendarCheck },
  { label: "Library",          href: "/account/courses",              icon: BookOpen      },
  { label: "My Profile",       href: "/account/dashboard-my-profile", icon: UserCircle    },
];

const STAFF_LINKS: (NavLink & { adminOnly?: boolean; registrarOk?: boolean })[] = [
  { label: "Members",      href: "/admin/members",      icon: Users,       registrarOk: true },
  { label: "Households",   href: "/admin/households",   icon: HouseHeart,  registrarOk: true },
  { label: "Hubs",         href: "/admin/hubs",          icon: Layers,      adminOnly: true   },
  { label: "Emails",       href: "/admin/emails",        icon: Mail,        adminOnly: true   },
  { label: "Google Files", href: "/admin/google-files",  icon: ShieldCheck, adminOnly: true   },
];

const COLLAPSE_KEY = "rim-account-sidebar-collapsed";

function teamInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "T";
}

export default function AccountSidebar({ roles, hubLinks = [] }: Props) {
  const pathname = usePathname();
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(pathname.startsWith("/admin/"));
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (
        window.matchMedia("(min-width: 701px)").matches &&
        localStorage.getItem(COLLAPSE_KEY) === "1"
      ) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsed(true);
      }
    } catch {}
  }, []);

  const hasRegistrar = roles.includes("REGISTRAR") || roles.includes("ADMIN");
  const isAdmin      = roles.includes("ADMIN");

  // Files live per-Space (each hub's Files tab + the Community Space); the
  // global finder and the native Documents system were both retired (session
  // 165 — Google Workspace is the document/file system now).
  const memberLinks: NavLink[] = MEMBER_LINKS;

  function linkClass(href: string) {
    const active =
      pathname === href ||
      (href !== "/account/dashboard" && pathname.startsWith(href));
    return `ac-sidebar__link${active ? " ac-sidebar__link--active" : ""}`;
  }

  const visibleStaffLinks = STAFF_LINKS.filter((l) => {
    if (l.adminOnly)   return isAdmin;
    if (l.registrarOk) return hasRegistrar;
    return false;
  });
  const isHubRoute = pathname.startsWith("/account/hub/");

  function setCollapsedAndRemember(next: boolean) {
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {}
  }

  function toggleTeams() {
    if (collapsed) {
      setCollapsedAndRemember(false);
      setTeamsOpen(true);
      return;
    }
    setTeamsOpen((open) => !open);
  }

  function toggleManage() {
    if (collapsed) {
      setCollapsedAndRemember(false);
      setManageOpen(true);
      return;
    }
    setManageOpen((open) => !open);
  }

  return (
    <nav
      className={`ac-sidebar${collapsed ? " ac-sidebar--collapsed" : ""}`}
      aria-label="Account navigation"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="ac-sidebar__nav">
        <button
          type="button"
          className="ac-sidebar__toggle"
          onClick={() => setCollapsedAndRemember(!collapsed)}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed
            ? <ChevronsRight size={17} strokeWidth={1.75} />
            : <ChevronsLeft size={17} strokeWidth={1.75} />}
        </button>
        <p className="ac-sidebar__section-label">My RIM</p>
        {memberLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={linkClass(l.href)}
            title={collapsed ? l.label : undefined}
          >
            <l.icon size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
            <span className="ac-sidebar__label">{l.label}</span>
          </Link>
        ))}

        {hubLinks.length > 0 && (
          <div className="ac-sidebar__group">
            <div className="ac-sidebar__divider" role="separator" />
            <button
              type="button"
              className="ac-sidebar__group-toggle"
              onClick={toggleTeams}
              aria-expanded={!collapsed && (teamsOpen || isHubRoute)}
              aria-label="Your teams"
              title={collapsed ? "Your teams" : undefined}
            >
              <UsersRound size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
              <span className="ac-sidebar__label">Your teams</span>
              <ChevronDown size={15} className={`ac-sidebar__chevron${teamsOpen ? " ac-sidebar__chevron--open" : ""}`} />
            </button>
            {(teamsOpen || isHubRoute) && hubLinks.map((h) => (
              <Link
                key={h.slug}
                href={`/account/hub/${h.slug}`}
                className={`${linkClass(`/account/hub/${h.slug}`)} ac-sidebar__link--nested`}
                title={h.name}
              >
                <span className="ac-sidebar__team-mark" aria-hidden="true">{teamInitials(h.name)}</span>
                <span className="ac-sidebar__label">{h.name}</span>
              </Link>
            ))}
          </div>
        )}

        {visibleStaffLinks.length > 0 && (
          <div className="ac-sidebar__group">
            <div className="ac-sidebar__divider" role="separator" />
            <button
              type="button"
              className="ac-sidebar__group-toggle"
              onClick={toggleManage}
              aria-expanded={!collapsed && manageOpen}
              aria-label="Manage RIM"
              title={collapsed ? "Manage RIM" : undefined}
            >
              <Settings size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
              <span className="ac-sidebar__label">Manage RIM</span>
              <ChevronDown size={15} className={`ac-sidebar__chevron${manageOpen ? " ac-sidebar__chevron--open" : ""}`} />
            </button>
            {manageOpen && visibleStaffLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`${linkClass(l.href)} ac-sidebar__link--nested`}
                title={l.label}
              >
                <l.icon size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
                <span className="ac-sidebar__label">{l.label}</span>
              </Link>
            ))}
          </div>
        )}

      </div>
    </nav>
  );
}
