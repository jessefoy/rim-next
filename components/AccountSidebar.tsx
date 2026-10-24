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
import { signOut } from "next-auth/react";
import { isPersonalAccountPath, setPersonalNav } from "@/lib/personalNav";
import {
  Menu,
  X,
  Home,
  Bell,
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
  Presentation,
  UserRound,
  SlidersHorizontal,
  LogOut,
  UserPlus,
  Inbox,
} from "lucide-react";

interface Props { roles: string[]; showTeams: boolean; showTeaching?: boolean; notificationsUnread?: number; }

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
  // "My Home", not "Home": the site header's logo is the public home page.
  { label: "My Home",          href: "/account/dashboard",            icon: Home          },
  // Every notice about you, your teams, programs and account (2026-10-20).
  { label: "Notifications",    href: "/account/notifications",        icon: Bell          },
  { label: "Library",          href: "/account/courses",              icon: BookOpen      },
  { label: "My Teams", href: "/account/teams", icon: UsersRound },
  // For someone who teaches a current program, and the guiding teacher (2026-10-24).
  { label: "Teaching", href: "/account/teaching", icon: Presentation },
];

const STAFF_LINKS: (NavLink & { adminOnly?: boolean; registrarOk?: boolean })[] = [
  { label: "Members",      href: "/admin/members",      icon: Users,       registrarOk: true },
  { label: "Households",   href: "/admin/households",   icon: HouseHeart,  registrarOk: true },
  { label: "Form submissions", href: "/admin/form-submissions", icon: Inbox, adminOnly: true },
  // Temporary: remove with /admin/import-legacy after the domain move.
  { label: "Import members", href: "/admin/import-legacy", icon: UserPlus,  adminOnly: true   },
  { label: "Teams",        href: "/admin/hubs",          icon: Layers,      adminOnly: true   },
  { label: "Emails",       href: "/admin/emails",        icon: Mail,        adminOnly: true   },
  { label: "Google Files", href: "/admin/google-files",  icon: ShieldCheck, adminOnly: true   },
];

const COLLAPSE_KEY = "rim-account-sidebar-collapsed";

export default function AccountSidebar({ roles, showTeams, showTeaching = false, notificationsUnread = 0 }: Props) {
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

  // The site's own header sits above this rail on every page (see
  // lib/personalNav.ts), and the rail holds what the old member header's
  // account menu did: My Profile and Sign out, plus Manage RIM for staff
  // outside administration (where its own group shows instead). On phones the header's Menu lists the personal pages,
  // so there the rail and its drawer handle appear only in administration.
  const personal = isPersonalAccountPath(pathname);
  useEffect(() => {
    setPersonalNav({ showTeams, showTeaching, canManage: hasRegistrar, notifications: notificationsUnread });
    return () => setPersonalNav(null);
  }, [showTeams, showTeaching, hasRegistrar, notificationsUnread]);

  // Files live per-Space (each hub's Files tab + the Community Space); the
  // global finder and the native Documents system were both retired (session
  // 165 — Google Workspace is the document/file system now).
  // My Teams only for someone who belongs to a team (AccountLayout decides).
  // Teaching only for someone who teaches a current program, or the guiding
  // teacher (AccountLayout decides; lib/teaching.ts).
  const memberLinks: NavLink[] = MEMBER_LINKS.filter(
    (l) => (showTeams || l.href !== "/account/teams") && (showTeaching || l.href !== "/account/teaching"),
  );

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
      {/* Mobile top bar — the drawer's handle. Hidden on desktop, and absent
          on the personal pages (the site header's Menu lists them). */}
      {!personal && (
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
      )}

      {/* Backdrop (mobile only) */}
      {mobileOpen && !personal && (
        <div
          className="ac-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

    <nav
      ref={drawerRef}
      className={`ac-sidebar${collapsed ? " ac-sidebar--collapsed" : ""}${mobileOpen ? " ac-sidebar--open" : ""}${personal ? " ac-sidebar--site" : ""}`}
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
            {l.href === "/account/notifications" && notificationsUnread > 0 && (
              <span className="hub-ws-badge ac-sidebar__badge">
                {notificationsUnread > 99 ? "99+" : notificationsUnread}
                <span className="rim-sr-only"> unread</span>
              </span>
            )}
          </Link>
        ))}

        <div className="ac-sidebar__divider" role="separator" />
        <Link href="/account/community-care" aria-current={pathname === "/account/community-care" ? "page" : undefined} className={linkClass("/account/community-care")} title={collapsed ? "Community Care" : undefined}>
          <Heart size={17} strokeWidth={1.75} fill="currentColor" className="ac-sidebar__icon ac-sidebar__icon--care" />
          <span className="ac-sidebar__label">Community Care</span>
        </Link>
        <Link href="/account/dashboard-my-profile" aria-current={pathname === "/account/dashboard-my-profile" ? "page" : undefined} className={linkClass("/account/dashboard-my-profile")} title={collapsed ? "My Profile" : undefined}>
          <UserRound size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
          <span className="ac-sidebar__label">My Profile</span>
        </Link>
        {!isAdminRoute && hasRegistrar && (
          <Link href="/admin/members" className="ac-sidebar__link" title={collapsed ? "Manage RIM" : undefined}>
            <SlidersHorizontal size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
            <span className="ac-sidebar__label">Manage RIM</span>
          </Link>
        )}
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

        <div className="ac-sidebar__divider" role="separator" />
        <button
          type="button"
          className="ac-sidebar__link ac-sidebar__signout"
          onClick={() => signOut({ callbackUrl: "/" })}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
          <span className="ac-sidebar__label">Sign out</span>
        </button>
      </div>
    </nav>
    </>
  );
}
