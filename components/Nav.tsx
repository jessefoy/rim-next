"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect } from "react";

interface NavProps {
  memberArea?: boolean;
}

export default function Nav({ memberArea = false }: NavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isLoggedIn = !!session;
  const isAdmin = session?.user?.roles?.includes("ADMIN") ?? false;
  // Auto-detect member area from route so layout doesn't need to pass prop
  const isMemberArea = memberArea || (pathname?.startsWith("/account") ?? false) || (pathname?.startsWith("/admin") ?? false);

  const current = (path: string) =>
    pathname === path || pathname.startsWith(path + "/") ? " w--current" : "";

  // Load nav.js after mount
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/nav.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <>
      {/* ── Desktop Nav ─────────────────────────────────────── */}
      <div
        data-collapse="small"
        data-animation="default"
        data-duration="400"
        data-easing="ease"
        data-easing2="ease"
        role="banner"
        className="navigation w-nav"
      >
        <div className="navigation-container">
          <div className="navigation-left">
            <Link href="/" className="brand-3 w-nav-brand">
              <img
                src="/images/Rooted-In-Mindfulness-Logo.png"
                alt="Rooted In Mindfulness"
                height={45}
                className="flowbase-logo"
              />
              <h1 className="heading-8">
                {isMemberArea ? "My Member Area" : "Rooted In Mindfulness"}
              </h1>
            </Link>
          </div>

          <div className="navigation-right">
            <nav role="navigation" className="nav-menu-2 w-nav-menu">
              {isMemberArea ? (
                /* Member area desktop nav — minimal: hub + programs + admin tools + sign out.
                   Sub-sections (library, registrations, profile, agreements) live on the hub. */
                <>
                  <Link href="/account/dashboard" className={`navigation-link w-nav-link${current("/account/dashboard")}`}>
                    My Dashboard
                  </Link>
                  <Link href="/community-programs" className="navigation-link w-nav-link">
                    Programs
                  </Link>
                  {isAdmin && (
                    <div data-hover="true" data-delay="0" className="dropdown w-dropdown">
                      <div className="dropdown-toggle w-dropdown-toggle">
                        <div className="icon-4 w-icon-dropdown-toggle"></div>
                        <div className="text-block-14">
                          <span className="text-span-24">Admin</span>
                        </div>
                      </div>
                      <nav className="navigation-dropdown w-dropdown-list">
                        <div className="dropdown-pointer">
                          <div className="dropdown-wrapper">
                            <Link href="/admin/members" className={`dropdown-link w-inline-block${current("/admin/members")}`}>
                              <div className="nav-content-wrap">
                                <div className="dropdown-title">Members</div>
                                <div className="nav-link-details">Member management</div>
                              </div>
                            </Link>
                            <Link href="/admin/sitemap" className={`dropdown-link w-inline-block${current("/admin/sitemap")}`}>
                              <div className="nav-content-wrap">
                                <div className="dropdown-title">Site Architecture</div>
                                <div className="nav-link-details">All pages reference</div>
                              </div>
                            </Link>
                          </div>
                          <div className="pointer"></div>
                        </div>
                      </nav>
                    </div>
                  )}
                  <button onClick={() => signOut({ callbackUrl: "/" })} className="navigation-link w-nav-link" style={{ background: "none", border: "none", cursor: "pointer" }}>
                    Sign Out
                  </button>
                </>
              ) : (
                /* Public desktop nav */
                <>
                  <Link href="/community-programs" className={`navigation-link w-nav-link${current("/community-programs")}`}>
                    Programs
                  </Link>

                  {/* Get Involved dropdown */}
                  <div data-hover="true" data-delay="0" className="dropdown w-dropdown">
                    <div className="dropdown-toggle w-dropdown-toggle">
                      <div className="icon-4 w-icon-dropdown-toggle"></div>
                      <div className="text-block-14">
                        <span className="text-span-24">Get Involved</span>
                      </div>
                    </div>
                    <nav className="navigation-dropdown w-dropdown-list">
                      <div className="dropdown-pointer">
                        <div className="dropdown-wrapper">
                          <Link href="/volunteerism/volunteer" className={`dropdown-link w-inline-block${current("/volunteerism")}`}>
                            <div className="nav-content-wrap">
                              <div className="dropdown-title">Volunteer</div>
                              <div className="nav-link-details">Help Co-Create Refuge at RIM</div>
                            </div>
                          </Link>
                          <Link href="/kalyana-mitta/community-groups-events" className={`dropdown-link w-inline-block${current("/kalyana-mitta")}`}>
                            <div className="nav-content-wrap">
                              <div className="dropdown-title">Start a Community Group</div>
                              <div className="nav-link-details">Create a Community Group or Event</div>
                            </div>
                          </Link>
                        </div>
                        <div className="pointer"></div>
                      </div>
                    </nav>
                  </div>

                  {/* Member Area dropdown */}
                  <div data-hover="true" data-delay="0" className="dropdown w-dropdown">
                    <div className="dropdown-toggle w-dropdown-toggle">
                      <div className="icon-4 w-icon-dropdown-toggle"></div>
                      <div className="text-block-14">
                        <span className="text-span-8">
                          {isLoggedIn && session.user?.name
                            ? `Hi, ${session.user.name.split(" ")[0]}`
                            : "Member Area"}
                        </span>
                      </div>
                    </div>
                    <nav className="navigation-dropdown w-dropdown-list">
                      <div className="dropdown-pointer">
                        <div className="dropdown-wrapper">
                          {isLoggedIn ? (
                            <>
                              <Link href="/account/dashboard" className="dropdown-link w-inline-block">
                                <div className="nav-content-wrap">
                                  <div className="dropdown-title">My Dashboard</div>
                                  <div className="nav-link-details">Today&apos;s Sessions &amp; Member Resources</div>
                                </div>
                              </Link>
                              <button onClick={() => signOut({ callbackUrl: "/" })} className="dropdown-link w-inline-block" style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}>
                                <div className="nav-content-wrap">
                                  <div className="dropdown-title">Sign Out</div>
                                  <div className="nav-link-details">Log out of your account</div>
                                </div>
                              </button>
                            </>
                          ) : (
                            <>
                              <Link href="/login" className="dropdown-link w-inline-block">
                                <div className="nav-content-wrap">
                                  <div className="dropdown-title">Login</div>
                                  <div className="nav-link-details">Access Community Resources</div>
                                </div>
                              </Link>
                              <Link href="/community-membership" className="dropdown-link w-inline-block">
                                <div className="nav-content-wrap">
                                  <div className="dropdown-title">Join Us</div>
                                  <div className="nav-link-details">Community values &amp; how to join</div>
                                </div>
                              </Link>
                            </>
                          )}
                        </div>
                        <div className="pointer"></div>
                      </div>
                    </nav>
                  </div>
                </>
              )}
            </nav>

            <div className="login-buttons">
              <Link href="/donate" className="button-menu w-button">DONATE</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Nav ──────────────────────────────────────── */}
      <div
        data-collapse="medium"
        data-animation="default"
        data-duration="400"
        data-easing="ease-out"
        data-easing2="ease-out"
        role="banner"
        className="navigation-mob w-nav"
      >
        <div className="navigation-container-mob">
          <Link href="/" className="brand-4 w-nav-brand">
            <img src="/images/Rooted-In-Mindfulness-Logo.png" alt="Rooted In Mindfulness" className="flowbase-logo" />
            <h1 className="heading-8">
              {isMemberArea ? "My Member Area" : "Rooted In Mindfulness"}
            </h1>
          </Link>

          <nav role="navigation" className="mobile-nav w-nav-menu">
            {isMemberArea ? (
              <>
                {/* Mobile member area — minimal: hub + programs + admin tools + sign out */}
                <Link href="/account/dashboard" className={`mobile-nav-link w-nav-link${current("/account/dashboard")}`}>My Dashboard</Link>
                <Link href="/community-programs" className="mobile-nav-link w-nav-link">Programs</Link>
                {isAdmin && <Link href="/admin/members" className={`mobile-nav-link w-nav-link${current("/admin/members")}`}>Admin — Members</Link>}
                {isAdmin && <Link href="/admin/sitemap" className={`mobile-nav-link w-nav-link${current("/admin/sitemap")}`}>Admin — Site Architecture</Link>}
                <button onClick={() => signOut({ callbackUrl: "/" })} className="mobile-nav-link w-nav-link" style={{ background: "none", border: "none", cursor: "pointer" }}>Sign Out</button>
                <Link href="/donate" className="mobile-nav-link donate-nav-link w-nav-link">Donate Today</Link>
              </>
            ) : (
              <>
                {!isLoggedIn && <Link href="/login" className="mobile-nav-link w-nav-link">Login</Link>}
                <Link href="/community-programs" className={`mobile-nav-link w-nav-link${current("/community-programs")}`}>Programs</Link>
                <Link href="/volunteerism/volunteer" className={`mobile-nav-link w-nav-link${current("/volunteerism")}`}>Volunteer Opportunities</Link>
                <Link href="/kalyana-mitta/community-groups-events" className={`mobile-nav-link w-nav-link${current("/kalyana-mitta")}`}>Start A Community Group</Link>
                {!isLoggedIn && <Link href="/community-membership" className="mobile-nav-link w-nav-link">Join RIM</Link>}
                {isLoggedIn && <Link href="/account/dashboard" className="mobile-nav-link w-nav-link">My Dashboard</Link>}
                {isLoggedIn && <button onClick={() => signOut({ callbackUrl: "/" })} className="mobile-nav-link w-nav-link" style={{ background: "none", border: "none", cursor: "pointer" }}>Sign Out</button>}
                <Link href="/donate" className="mobile-nav-link donate-nav-link w-nav-link">Donate Today</Link>
              </>
            )}
          </nav>

          <div className="menu-mob w-nav-button">
            <div className="icon-5 w-icon-nav-menu"></div>
          </div>
        </div>
      </div>
    </>
  );
}
