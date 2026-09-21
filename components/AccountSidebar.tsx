"use client";

/**
 * AccountSidebar — role-aware nav for all /account/* pages.
 *
 * Desktop: quiet rail that can collapse to return working width.
 * Mobile: slide-in drawer opened from a hamburger bar — the same pattern as
 * the hub workspace rail (HubWorkspaceSidebar), so the two sibling rails
 * behave identically on phones. (Replaced the horizontal scroll strip,
 * session 172 — the strip hid section labels and expanded groups inline.)
 *
 * CSS prefix: ac-
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNavigationDrawer } from "@/components/hooks/useNavigationDrawer";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Home,
  BookOpen,
  Heart,
  Users,
  HouseHeart,
  Layers,
  Mail,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
  UsersRound,
} from "lucide-react";

interface Props { roles: string[]; }

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
  { label: "Library",          href: "/account/courses",              icon: BookOpen      },
  { label: "My Teams", href: "/account/teams", icon: UsersRound },
];

const STAFF_LINKS: (NavLink & { adminOnly?: boolean; registrarOk?: boolean })[] = [
  { label: "Members",      href: "/admin/members",      icon: Users,       registrarOk: true },
  { label: "Households",   href: "/admin/households",   icon: HouseHeart,  registrarOk: true },
  { label: "Hubs",         href: "/admin/hubs",          icon: Layers,      adminOnly: true   },
  { label: "Emails",       href: "/admin/emails",        icon: Mail,        adminOnly: true   },
  { label: "Google Files", href: "/admin/google-files",  icon: ShieldCheck, adminOnly: true   },
];

const COLLAPSE_KEY = "rim-account-sidebar-collapsed";

export default function AccountSidebar({ roles }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useNavigationDrawer(mobileOpen, () => setMobileOpen(false));

  useEffect(() => {
    // Route changes close the mobile drawer, including browser navigation —
    // mirrors HubWorkspaceSidebar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

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
  const isAdminRoute = pathname.startsWith("/admin/");

  function setCollapsedAndRemember(next: boolean) {
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {}
  }

  return (
    <>
      {/* Mobile top bar — the drawer's handle. Hidden on desktop. */}
      <div className="ac-mobilebar">
        <button
          type="button"
          className="ac-mobilebar__btn"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <div className="ac-mobilebar__name">My RIM</div>
      </div>

      {/* Backdrop (mobile only) */}
      {mobileOpen && (
        <div
          className="ac-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

    <nav
      ref={drawerRef}
      className={`ac-sidebar${collapsed ? " ac-sidebar--collapsed" : ""}${mobileOpen ? " ac-sidebar--open" : ""}`}
      aria-label="Account navigation"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="ac-sidebar__nav">
        <button
          type="button"
          className="ac-sidebar__close"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        >
          <X size={18} strokeWidth={1.75} />
        </button>
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
            aria-current={pathname === l.href ? "page" : undefined}
            className={linkClass(l.href)}
            title={collapsed ? l.label : undefined}
          >
            <l.icon size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
            <span className="ac-sidebar__label">{l.label}</span>
          </Link>
        ))}

        <div className="ac-sidebar__divider" role="separator" />
        <Link href="/account/community-care" className={linkClass("/account/community-care")} title={collapsed ? "Community Care" : undefined}>
          <Heart size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
          <span className="ac-sidebar__label">Community Care</span>
        </Link>
        {isAdminRoute && visibleStaffLinks.length > 0 && (
          <div className="ac-sidebar__group">
            <div className="ac-sidebar__divider" role="separator" />
            <p className="ac-sidebar__section-label">Manage RIM</p>
            {visibleStaffLinks.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)} title={collapsed ? l.label : undefined}>
                <l.icon size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
                <span className="ac-sidebar__label">{l.label}</span>
              </Link>
            ))}
          </div>
        )}

      </div>
    </nav>
    </>
  );
}
