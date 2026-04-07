"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export default function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isLoggedIn = !!session;
  const isAdmin = session?.user?.roles?.includes("ADMIN") ?? false;
  const isSessionArea = pathname?.startsWith("/session") ?? false;
  const isMemberArea =
    (pathname?.startsWith("/account") ?? false) ||
    (pathname?.startsWith("/admin") ?? false) ||
    (pathname?.startsWith("/tools") ?? false);

  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen]);

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/")
      ? " nav__link--active"
      : "";

  // Video session pages are full-screen — hide the site nav
  if (isSessionArea) return null;

  return (
    <header className="nav">
      <div className="nav__inner">
        {/* Brand */}
        <Link href="/" className="nav__brand">
          <img
            src="/images/Rooted-In-Mindfulness-Logo.png"
            alt="Rooted In Mindfulness"
            height={40}
          />
          <span className="nav__brand-name">Rooted In Mindfulness</span>
        </Link>

        {/* ── Desktop nav ───────────────────────────────── */}
        <nav className="nav__desktop" aria-label="Main navigation">
          {isMemberArea ? (
            /* Member area desktop: minimal */
            <>
              <Link
                href="/account/dashboard"
                className={`nav__link${isActive("/account/dashboard")}`}
              >
                My Dashboard
              </Link>
              <Link
                href="/community-programs"
                className={`nav__link${isActive("/community-programs")}`}
              >
                Programs
              </Link>
              <Link
                href="/courses"
                className={`nav__link${isActive("/courses")}`}
              >
                Courses
              </Link>
              <Link
                href="/teachers"
                className={`nav__link${isActive("/teachers")}`}
              >
                Teachers
              </Link>

              {isAdmin && (
                <div className="nav__dropdown">
                  <button className="nav__dropdown-toggle">
                    Admin
                    <span className="nav__dropdown-caret" aria-hidden="true">▾</span>
                  </button>
                  <div className="nav__dropdown-panel">
                    <div className="nav__dropdown-panel-inner">
                      <Link
                        href="/admin/sitemap"
                        className="nav__dropdown-link"
                      >
                        <div className="nav__dropdown-title">Site Architecture</div>
                        <div className="nav__dropdown-desc">All pages reference</div>
                      </Link>
                      <Link
                        href="/admin/features"
                        className="nav__dropdown-link"
                      >
                        <div className="nav__dropdown-title">Feature Inventory</div>
                        <div className="nav__dropdown-desc">Every feature, categorized</div>
                      </Link>
                      <a
                        href="https://rooted-in-mindfulness.sanity.studio/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nav__dropdown-link"
                      >
                        <div className="nav__dropdown-title">Sanity Studio</div>
                        <div className="nav__dropdown-desc">Edit site content</div>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="nav__link"
              >
                Sign Out
              </button>
            </>
          ) : (
            /* Public desktop nav */
            <>
              <Link
                href="/community-programs"
                className={`nav__link${isActive("/community-programs")}`}
              >
                Programs
              </Link>
              <Link
                href="/courses"
                className={`nav__link${isActive("/courses")}`}
              >
                Courses
              </Link>
              <Link
                href="/teachers"
                className={`nav__link${isActive("/teachers")}`}
              >
                Teachers
              </Link>

              {/* Get Involved dropdown */}
              <div className="nav__dropdown">
                <button className="nav__dropdown-toggle">
                  Get Involved
                  <span className="nav__dropdown-caret" aria-hidden="true">▾</span>
                </button>
                <div className="nav__dropdown-panel">
                  <div className="nav__dropdown-panel-inner">
                    <Link
                      href="/volunteerism/volunteer"
                      className="nav__dropdown-link"
                    >
                      <div className="nav__dropdown-title">Volunteer</div>
                      <div className="nav__dropdown-desc">Help Co-Create Refuge at RIM</div>
                    </Link>
                    <Link
                      href="/kalyana-mitta/community-groups-events"
                      className="nav__dropdown-link"
                    >
                      <div className="nav__dropdown-title">Start a Community Group</div>
                      <div className="nav__dropdown-desc">Create a Community Group or Event</div>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Member Area dropdown */}
              <div className="nav__dropdown">
                <button className="nav__dropdown-toggle">
                  {isLoggedIn && session.user?.name
                    ? `Hi, ${session.user.name.split(" ")[0]}`
                    : "Member Area"}
                  <span className="nav__dropdown-caret" aria-hidden="true">▾</span>
                </button>
                <div className="nav__dropdown-panel">
                  <div className="nav__dropdown-panel-inner">
                    {isLoggedIn ? (
                      <>
                        <Link href="/account/dashboard" className="nav__dropdown-link">
                          <div className="nav__dropdown-title">My Dashboard</div>
                          <div className="nav__dropdown-desc">Today&apos;s Sessions &amp; Resources</div>
                        </Link>
                        <button
                          onClick={() => signOut({ callbackUrl: "/" })}
                          className="nav__dropdown-link"
                          style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
                        >
                          <div className="nav__dropdown-title">Sign Out</div>
                          <div className="nav__dropdown-desc">Log out of your account</div>
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href="/login" className="nav__dropdown-link">
                          <div className="nav__dropdown-title">Login</div>
                          <div className="nav__dropdown-desc">Access Community Resources</div>
                        </Link>
                        <Link href="/community-membership" className="nav__dropdown-link">
                          <div className="nav__dropdown-title">Join Us</div>
                          <div className="nav__dropdown-desc">Community values &amp; how to join</div>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </nav>

        {/* Donate CTA */}
        <Link href="/donate" className="nav__donate">DONATE</Link>

        {/* Hamburger */}
        <button
          className={`nav__hamburger${menuOpen ? " nav__hamburger--open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* ── Mobile nav ────────────────────────────────── */}
      {menuOpen && (
        <nav className="nav__mobile" aria-label="Mobile navigation">
          {isMemberArea ? (
            <>
              <Link
                href="/account/dashboard"
                className={`nav__mobile-link${isActive("/account/dashboard")}`}
              >
                My Dashboard
              </Link>
              <Link href="/community-programs" className="nav__mobile-link">
                Programs
              </Link>
              <Link href="/courses" className={`nav__mobile-link${isActive("/courses")}`}>
                Courses
              </Link>
              <Link href="/teachers" className={`nav__mobile-link${isActive("/teachers")}`}>
                Teachers
              </Link>
              {isAdmin && (
                <Link
                  href="/admin/sitemap"
                  className={`nav__mobile-link${isActive("/admin/sitemap")}`}
                >
                  Admin — Site Architecture
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/admin/features"
                  className={`nav__mobile-link${isActive("/admin/features")}`}
                >
                  Admin — Feature Inventory
                </Link>
              )}
              {isAdmin && (
                <a
                  href="https://rooted-in-mindfulness.sanity.studio/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav__mobile-link"
                >
                  Admin — Sanity Studio
                </a>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="nav__mobile-link"
              >
                Sign Out
              </button>
              <Link href="/donate" className="nav__mobile-donate">
                Donate Today
              </Link>
            </>
          ) : (
            <>
              {!isLoggedIn && (
                <Link href="/login" className="nav__mobile-link">
                  Login
                </Link>
              )}
              <Link
                href="/community-programs"
                className={`nav__mobile-link${isActive("/community-programs")}`}
              >
                Programs
              </Link>
              <Link
                href="/courses"
                className={`nav__mobile-link${isActive("/courses")}`}
              >
                Courses
              </Link>
              <Link
                href="/teachers"
                className={`nav__mobile-link${isActive("/teachers")}`}
              >
                Teachers
              </Link>
              <Link
                href="/volunteerism/volunteer"
                className={`nav__mobile-link${isActive("/volunteerism")}`}
              >
                Volunteer Opportunities
              </Link>
              <Link
                href="/kalyana-mitta/community-groups-events"
                className={`nav__mobile-link${isActive("/kalyana-mitta")}`}
              >
                Start A Community Group
              </Link>
              {!isLoggedIn && (
                <Link href="/community-membership" className="nav__mobile-link">
                  Join RIM
                </Link>
              )}
              {isLoggedIn && (
                <Link href="/account/dashboard" className="nav__mobile-link">
                  My Dashboard
                </Link>
              )}
              {isLoggedIn && (
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="nav__mobile-link"
                >
                  Sign Out
                </button>
              )}
              <Link href="/donate" className="nav__mobile-donate">
                Donate Today
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
