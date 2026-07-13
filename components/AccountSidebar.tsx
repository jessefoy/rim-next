"use client";

/**
 * AccountSidebar — role-aware nav for all /account/* pages.
 *
 * Desktop: quiet, always-legible left rail.
 * Mobile: horizontal scroll strip below the member header.
 *
 * CSS prefix: ac-
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarCheck,
  BookOpen,
  FileText,
  Network,
  UserCircle,
  Users,
  House,
  Layers,
  Mail,
  Globe,
  ChevronDown,
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
  { label: "Mind Maps",        href: "/account/mindmaps",             icon: Network       },
  { label: "My Profile",       href: "/account/dashboard-my-profile", icon: UserCircle    },
];

const STAFF_LINKS: (NavLink & { adminOnly?: boolean; registrarOk?: boolean })[] = [
  { label: "Members",    href: "/admin/members",    icon: Users,    registrarOk: true },
  { label: "Households", href: "/admin/households", icon: House,    registrarOk: true },
  { label: "Hubs",       href: "/admin/hubs",       icon: Layers,   adminOnly: true   },
  { label: "Emails",     href: "/admin/emails",     icon: Mail,     adminOnly: true   },
];

export default function AccountSidebar({ roles, hubLinks = [] }: Props) {
  const pathname = usePathname();
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const hasRegistrar = roles.includes("REGISTRAR") || roles.includes("ADMIN");
  const isAdmin      = roles.includes("ADMIN");

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

  return (
    <nav className="ac-sidebar" aria-label="Account navigation">
      <div className="ac-sidebar__nav">
        <p className="ac-sidebar__section-label">My RIM</p>
        {MEMBER_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={linkClass(l.href)}
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
              onClick={() => setTeamsOpen((open) => !open)}
              aria-expanded={teamsOpen || isHubRoute}
            >
              <Globe size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
              <span className="ac-sidebar__label">Your teams</span>
              <ChevronDown size={15} className={`ac-sidebar__chevron${teamsOpen ? " ac-sidebar__chevron--open" : ""}`} />
            </button>
            {(teamsOpen || isHubRoute) && hubLinks.map((h) => (
              <Link
                key={h.slug}
                href={`/account/hub/${h.slug}`}
                className={`${linkClass(`/account/hub/${h.slug}`)} ac-sidebar__link--nested`}
              >
                <Globe size={15} strokeWidth={1.75} className="ac-sidebar__icon" />
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
              onClick={() => setManageOpen((open) => !open)}
              aria-expanded={manageOpen}
            >
              <Layers size={17} strokeWidth={1.75} className="ac-sidebar__icon" />
              <span className="ac-sidebar__label">Manage RIM</span>
              <ChevronDown size={15} className={`ac-sidebar__chevron${manageOpen ? " ac-sidebar__chevron--open" : ""}`} />
            </button>
            {manageOpen && visibleStaffLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`${linkClass(l.href)} ac-sidebar__link--nested`}
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
