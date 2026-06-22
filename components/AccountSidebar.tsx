"use client";

/**
 * AccountSidebar — role-aware nav for all /account/* pages.
 *
 * Desktop: sticky left column, 220px expanded / 56px collapsed.
 *          Collapse state persisted to localStorage.
 * Mobile:  horizontal scroll strip below the main site nav.
 *
 * CSS prefix: ac-
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarCheck,
  BookOpen,
  FileText,
  UserCircle,
  Users,
  House,
  Layers,
  Mail,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
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
  { label: "Home",             href: "/account/dashboard",            icon: Home          },
  { label: "My Registrations", href: "/account/programs",             icon: CalendarCheck },
  { label: "Library",          href: "/account/courses",              icon: BookOpen      },
  { label: "Documents",        href: "/account/documents",            icon: FileText      },
  { label: "My Profile",       href: "/account/dashboard-my-profile", icon: UserCircle    },
];

const STAFF_LINKS: (NavLink & { adminOnly?: boolean; registrarOk?: boolean })[] = [
  { label: "Members",    href: "/admin/members",    icon: Users,    registrarOk: true },
  { label: "Households", href: "/admin/households", icon: House,    registrarOk: true },
  { label: "Hubs",       href: "/admin/hubs",       icon: Layers,   adminOnly: true   },
  { label: "Emails",     href: "/admin/emails",     icon: Mail,     adminOnly: true   },
];

const STORAGE_KEY = "ac-sidebar-collapsed";

export default function AccountSidebar({ roles, hubLinks = [] }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const hasRegistrar = roles.includes("REGISTRAR") || roles.includes("ADMIN");
  const isAdmin      = roles.includes("ADMIN");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
    setMounted(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

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

  // Render an empty shell before mount to avoid hydration mismatch
  if (!mounted) {
    return <nav className="ac-sidebar" aria-label="Account navigation" />;
  }

  return (
    <nav
      className={`ac-sidebar${collapsed ? " ac-sidebar--collapsed" : ""}`}
      aria-label="Account navigation"
    >
      <button
        className="ac-sidebar__toggle"
        onClick={toggle}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
      >
        {collapsed
          ? <PanelLeftOpen  size={18} strokeWidth={1.75} />
          : <PanelLeftClose size={18} strokeWidth={1.75} />
        }
      </button>

      <div className="ac-sidebar__nav">

        {/* ── Member links (always) ── */}
        {MEMBER_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={linkClass(l.href)}
            title={collapsed ? l.label : undefined}
          >
            <l.icon size={18} strokeWidth={1.75} className="ac-sidebar__icon" />
            <span className="ac-sidebar__label">{l.label}</span>
          </Link>
        ))}

        {/* ── Your Hubs ── */}
        {hubLinks.length > 0 && (
          <>
            <div className="ac-sidebar__divider" role="separator" />
            {!collapsed && (
              <div className="ac-sidebar__section-label">Your Hubs</div>
            )}
            {hubLinks.map((h) => (
              <Link
                key={h.slug}
                href={`/account/hub/${h.slug}`}
                className={linkClass(`/account/hub/${h.slug}`)}
                title={collapsed ? h.name : undefined}
              >
                <Globe size={18} strokeWidth={1.75} className="ac-sidebar__icon" />
                <span className="ac-sidebar__label">{h.name}</span>
              </Link>
            ))}
          </>
        )}

        {/* ── Staff / Admin links ── */}
        {visibleStaffLinks.length > 0 && (
          <>
            <div className="ac-sidebar__divider" role="separator" />
            {!collapsed && (
              <div className="ac-sidebar__section-label">Staff</div>
            )}
            {visibleStaffLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={linkClass(l.href)}
                title={collapsed ? l.label : undefined}
              >
                <l.icon size={18} strokeWidth={1.75} className="ac-sidebar__icon" />
                <span className="ac-sidebar__label">{l.label}</span>
              </Link>
            ))}
          </>
        )}

      </div>
    </nav>
  );
}
