"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export default function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isLoggedIn = !!session;
  const isSessionArea = pathname?.startsWith("/session") ?? false;
  const isAccountArea = pathname?.startsWith("/account") ?? false;
  const isMemberArea =
    isAccountArea ||
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

  // Authenticated member, admin, and tool surfaces share one quiet identity
  // header. Their sidebars and workspace chrome carry the local navigation.
  if (isMemberArea) {
    const firstName = session?.user?.name?.split(" ")[0] ?? "My profile";
    return (
      <header className="member-bar">
        <Link href="/account/dashboard" className="member-bar__brand">
          <img
            src="/images/Rooted-In-Mindfulness-Logo.png"
            alt="Rooted In Mindfulness"
            height={38}
          />
          <span>Rooted In Mindfulness</span>
        </Link>
        <div className="member-bar__right">
          {/* The one path back to the public site, on every member/admin/tool
              surface at every viewport — tool and hub pages render this bar
              without the account rail, so the link must live here. On phones
              the bar makes room by dropping the wordmark and profile name. */}
          <Link href="/" className="member-bar__site-link">
            Main site
          </Link>
          <Link
            href="/account/dashboard-my-profile"
            className="member-bar__profile"
            aria-label={`${firstName} — my profile`}
          >
            <span className="member-bar__avatar" aria-hidden="true">
              {firstName.charAt(0).toUpperCase()}
            </span>
            <span className="member-bar__profile-name">{firstName}</span>
          </Link>
          <button onClick={() => signOut({ callbackUrl: "/" })} className="member-bar__sign-out">
            Sign out
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="nav">
      <div className="nav__inner">
        {/* Brand */}
        <Link href="/" className="nav__brand">
          <img
            src="/images/Rooted-In-Mindfulness-Logo.png"
            alt="Rooted In Mindfulness"
            height={45}
          />
          <span className="nav__brand-name">Rooted In Mindfulness</span>
        </Link>

        {/* ── Desktop nav ───────────────────────────────── */}
        {/* Public only: member/admin/tool routes return the member-bar above,
            so this nav never renders there. */}
        <nav className="nav__desktop" aria-label="Main navigation">
              {/* A single page, so a flat link rather than a fourth door. The
                  page keeps its own title ("A Handful of Leaves"); the bar is
                  tight, so the label is short. */}
              <Link
                href="/what-we-practice"
                className={`nav__link${isActive("/what-we-practice")}`}
              >
                Our Practice
              </Link>
              <div className="nav__dropdown">
                <button className="nav__dropdown-toggle">
                  Programs
                  <span className="nav__dropdown-caret" aria-hidden="true">▾</span>
                </button>
                <div className="nav__dropdown-panel">
                  <div className="nav__dropdown-panel-inner">
                    <Link href="/community-programs" className="nav__dropdown-link">
                      <div className="nav__dropdown-title">All Programs</div>
                      <div className="nav__dropdown-desc">Drop-ins, courses, and community groups</div>
                    </Link>
                    <Link href="/this-week" className="nav__dropdown-link">
                      <div className="nav__dropdown-title">This Week&apos;s Schedule</div>
                      <div className="nav__dropdown-desc">What&apos;s happening day by day</div>
                    </Link>
                    <Link href="/your-first-visit" className="nav__dropdown-link">
                      <div className="nav__dropdown-title">Your First Visit</div>
                      <div className="nav__dropdown-desc">What to expect if you&apos;ve never been</div>
                    </Link>
                  </div>
                </div>
              </div>
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
                    : "Members"}
                  <span className="nav__dropdown-caret" aria-hidden="true">▾</span>
                </button>
                <div className="nav__dropdown-panel">
                  <div className="nav__dropdown-panel-inner">
                    {isLoggedIn ? (
                      <>
                        <Link href="/account/dashboard" className="nav__dropdown-link">
                          <div className="nav__dropdown-title">My Home</div>
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
                        <Link href="/join" className="nav__dropdown-link">
                          <div className="nav__dropdown-title">Become a Member</div>
                          <div className="nav__dropdown-desc">Read our community care agreements and join</div>
                        </Link>
                        <Link href="/login" className="nav__dropdown-link">
                          <div className="nav__dropdown-title">Sign in</div>
                          <div className="nav__dropdown-desc">Already a member? Continue here</div>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
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

      {/* ── Mobile nav — public only; member/admin/tool routes return the
             member-bar above and never reach this. ─────── */}
      {menuOpen && (
        <nav className="nav__mobile" aria-label="Mobile navigation">
              {!isLoggedIn && (
                <Link href="/join" className="nav__mobile-link">
                  Become a Member
                </Link>
              )}
              {!isLoggedIn && (
                <Link href="/login" className="nav__mobile-link">
                  Sign in
                </Link>
              )}
              <Link
                href="/what-we-practice"
                className={`nav__mobile-link${isActive("/what-we-practice")}`}
              >
                Our Practice
              </Link>
              <Link
                href="/community-programs"
                className={`nav__mobile-link${isActive("/community-programs")}`}
              >
                All Programs
              </Link>
              <Link
                href="/this-week"
                className={`nav__mobile-link${isActive("/this-week")}`}
              >
                This Week&apos;s Schedule
              </Link>
              <Link
                href="/your-first-visit"
                className={`nav__mobile-link${isActive("/your-first-visit")}`}
              >
                Your First Visit
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
        </nav>
      )}
    </header>
  );
}
