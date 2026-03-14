"use client";

/**
 * AccountSidebar — role-aware nav for all /account/* pages.
 *
 * Desktop: sticky 220px left column.
 * Mobile:  horizontal scroll strip below the main site nav.
 *
 * Link structure:
 *   Member links (always visible)
 *   ── divider (if any role links below) ──
 *   My Sessions   HOST+
 *   Programs      REGISTRAR+
 *   Members       REGISTRAR+ or ADMIN
 *   ── divider (ADMIN only) ──
 *   Manual        ADMIN
 *   Roadmap       ADMIN
 *
 * CSS prefix: ac-
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface HubLink {
  slug: string;
  name: string;
}

interface Props {
  roles: string[];
  hubLinks?: HubLink[];
}

interface NavLink {
  label: string;
  href: string;
}

const MEMBER_LINKS: NavLink[] = [
  { label: "Dashboard",    href: "/account/dashboard" },
  { label: "My Programs",  href: "/account/programs" },
  { label: "My Library",   href: "/account/dashboard-my-library" },
  { label: "My Profile",   href: "/account/dashboard-my-profile" },
];

export default function AccountSidebar({ roles, hubLinks = [] }: Props) {
  const pathname = usePathname();

  const hasRegistrar  = roles.includes("REGISTRAR") || roles.includes("ADMIN");
  const isAdmin       = roles.includes("ADMIN");
  const hasRoleLinks  = hasRegistrar || isAdmin;

  function linkClass(href: string) {
    const active =
      pathname === href ||
      (href !== "/account/dashboard" && pathname.startsWith(href));
    return `ac-sidebar__link${active ? " ac-sidebar__link--active" : ""}`;
  }

  return (
    <nav className="ac-sidebar" aria-label="Account navigation">
      <div className="ac-sidebar__nav">

        {/* ── Member links (always) ── */}
        {MEMBER_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={linkClass(l.href)}>
            {l.label}
          </Link>
        ))}

        {/* ── Your Hubs ── */}
        {hubLinks.length > 0 && (
          <>
            <div className="ac-sidebar__divider" role="separator" />
            <div className="ac-sidebar__section-label">Your Hubs</div>
            {hubLinks.map((h) => (
              <Link
                key={h.slug}
                href={`/account/hub/${h.slug}`}
                className={linkClass(`/account/hub/${h.slug}`)}
              >
                {h.name}
              </Link>
            ))}
          </>
        )}

        {/* ── Role links ── */}
        {hasRoleLinks && <div className="ac-sidebar__divider" role="separator" />}

        {hasRegistrar && (
          <Link href="/admin/members" className={linkClass("/admin/members")}>
            Members
          </Link>
        )}

        {hasRegistrar && (
          <Link href="/admin/households" className={linkClass("/admin/households")}>
            Households
          </Link>
        )}

        {/* ── Admin-only links ── */}
        {isAdmin && <div className="ac-sidebar__divider" role="separator" />}

        {isAdmin && (
          <Link href="/admin/emails" className={linkClass("/admin/emails")}>
            Emails
          </Link>
        )}

        {isAdmin && (
          <Link href="/admin/manual" className={linkClass("/admin/manual")}>
            Manual
          </Link>
        )}

        {isAdmin && (
          <Link href="/admin/roadmap" className={linkClass("/admin/roadmap")}>
            Roadmap
          </Link>
        )}

      </div>
    </nav>
  );
}
