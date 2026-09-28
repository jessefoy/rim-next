"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useRef } from "react";

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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  const desktopNav = useRef<HTMLElement>(null);
  const caretRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  // Which panel hover opened, so a click on its arrow pins it rather than
  // closing what the pointer just revealed.
  const hoverOpened = useRef<string | null>(null);

  const firstName = session?.user?.name?.split(" ")[0] ?? null;
  const menus = publicMenus(isLoggedIn, firstName);

  // Desktop panels: open on hover intent (300ms; 80ms when moving from one
  // open panel to the next), on the arrow button, or from the keyboard.
  const clearHover = () => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  const hoverMenu = (id: string | null) => {
    clearHover();
    const delay = id === null ? 300 : openMenu ? 80 : 300;
    hoverTimer.current = window.setTimeout(() => {
      hoverOpened.current = id;
      setOpenMenu(id);
    }, delay);
  };
  const toggleMenu = (id: string) => {
    clearHover();
    if (hoverOpened.current === id && openMenu === id) {
      hoverOpened.current = null;
      return;
    }
    hoverOpened.current = null;
    setOpenMenu((current) => (current === id ? null : id));
  };
  const closeMenu = (focusId?: string) => {
    clearHover();
    hoverOpened.current = null;
    setOpenMenu(null);
    if (focusId) caretRefs.current[focusId]?.focus();
  };

  // Close transient chrome on route change
  useEffect(() => {
    // Navigation closes transient chrome after the new route commits.
    // A pending hover timer must not reopen a panel on the new page.
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    hoverOpened.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
    setOpenMenu(null);
    if (accountMenu.current) accountMenu.current.open = false;
  }, [pathname]);

  // An open desktop panel closes on Escape or a click outside the nav.
  useEffect(() => {
    if (!openMenu) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !desktopNav.current?.contains(event.target)) setOpenMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  // The phone sheet is modal: the page behind stops scrolling, focus moves in
  // and is trapped, Escape and Close both close it, and focus returns to the
  // Menu button.
  const closeSheet = () => {
    setMenuOpen(false);
    window.requestAnimationFrame(() => menuButton.current?.focus());
  };
  useEffect(() => {
    if (!menuOpen) return;
    // Lock on <html>, not <body>: html carries overflow-x: clip, so a body
    // overflow never reaches the viewport and the page kept scrolling behind
    // the sheet (measured live 2026-09-28).
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        window.requestAnimationFrame(() => menuButton.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !sheet.current) return;
      const focusable = sheet.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // Widening past the phone layout (an iPad rotating) hides the Menu
    // button, so the sheet closes rather than stranding focus on a hidden one.
    const wide = window.matchMedia("(min-width: 1061px)");
    const onWide = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [menuOpen]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const menu = accountMenu.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/")
      ? " nav__link--active"
      : "";

  // Video session pages are full-screen — hide the site nav
  if (isSessionArea) return null;

  // Authenticated member, admin, and tool surfaces share one quiet identity
  // header. Their sidebars and workspace chrome carry the local navigation.
  if (isMemberArea) {
    const memberName = firstName ?? "My profile";
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
          {session?.user?.roles?.some((role: string) => ["ADMIN", "REGISTRAR"].includes(role)) && (
            <Link href="/admin/members" className="member-bar__manage">Manage RIM</Link>
          )}
          <details className="member-menu" ref={accountMenu} onKeyDown={(event) => {
            if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
          }}>
            <summary className="member-bar__profile" aria-label={`${memberName}, account menu`}>
              <span className="member-bar__avatar" aria-hidden="true">{memberName.charAt(0).toUpperCase()}</span>
              <span className="member-bar__profile-name">My account</span>
            </summary>
            <nav className="member-menu__panel" aria-label="My account">
              <Link href="/account/dashboard-my-profile">My Profile</Link>
              <Link href="/account/community-care">Community Care</Link>
              <Link href="/">Main site</Link>
              <button type="button" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
            </nav>
          </details>
        </div>
      </header>
    );
  }

  return (
    <header className="nav">
      <div className="nav__inner">
        <Link href="/" className="nav__brand">
          <img
            src="/images/Rooted-In-Mindfulness-Logo.png"
            alt="Rooted In Mindfulness"
            height={45}
          />
          <span className="nav__brand-name">Rooted In Mindfulness</span>
        </Link>

        {/* Public only: member/admin/tool routes return the member-bar above. */}
        <PublicDesktopNav
          menus={menus}
          openMenu={openMenu}
          isActive={isActive}
          onHover={hoverMenu}
          onToggle={toggleMenu}
          onClose={closeMenu}
          caretRefs={caretRefs}
          navRef={desktopNav}
        />

        <Link href="/donate" className="nav__donate">
          Donate
        </Link>

        <button
          ref={menuButton}
          type="button"
          className="nav__menu-btn"
          aria-expanded={menuOpen}
          aria-controls="nav-sheet"
          onClick={() => setMenuOpen(true)}
        >
          <MenuIcon />
          Menu
        </button>
      </div>

      {menuOpen && (
        <PublicNavSheet
          menus={menus}
          isLoggedIn={isLoggedIn}
          isActive={isActive}
          sheetRef={sheet}
          closeRef={closeButton}
          onClose={closeSheet}
          onNavigate={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
}

/* ── The public menu, one list for both layouts ─────────────────────────────
   2026-09-28 (Addendum C3, Jesse's choices): each top-level label is a link
   to a real page, with a separate 44px arrow button that opens its panel;
   Members has no single page, so it stays a toggle. Panels carry a short line
   under each link (information scent). The phone sheet groups the same links
   under the same headings, without the lines. */
type MenuItem = { title: string; desc: string; href?: string; action?: "signout" };
type Menu = { id: string; label: string; href?: string; items: MenuItem[] };

export function publicMenus(isLoggedIn: boolean, firstName: string | null): Menu[] {
  return [
    {
      id: "practice",
      label: "Our Practice",
      href: "/why-we-practice",
      items: [
        { title: "Why We Practice", desc: "What the practice is for", href: "/why-we-practice" },
        { title: "Taking Care", desc: "The eight words of our practice", href: "/care" },
        { title: "Our Roots", desc: "Silent illumination and the Buddhist tradition", href: "/our-roots" },
        { title: "About RIM", desc: "Our vision, mission, and story", href: "/about" },
      ],
    },
    {
      id: "programs",
      label: "Programs",
      href: "/community-programs",
      items: [
        { title: "Programs & Events", desc: "Foundations, weekly gatherings, workshops, and retreats", href: "/community-programs" },
        { title: "This Week’s Schedule", desc: "What is happening in the next seven days", href: "/this-week" },
      ],
    },
    {
      id: "involved",
      label: "Get Involved",
      href: "/volunteerism/volunteer",
      items: [
        { title: "Volunteer", desc: "Help co-create RIM", href: "/volunteerism/volunteer" },
        { title: "Community Groups", desc: "Practice with others near you", href: "/kalyana-mitta/community-groups-events" },
        { title: "Outreach for Organizations", desc: "Taking CARE for organizations", href: "/outreach" },
      ],
    },
    {
      id: "members",
      label: isLoggedIn && firstName ? `Hi, ${firstName}` : "Members",
      items: isLoggedIn
        ? [
            { title: "My Home", desc: "Today’s sessions and resources", href: "/account/dashboard" },
            { title: "Community Care Agreements", desc: "Our shared vision, and what we ask of members", href: "/community-care-agreements" },
            { title: "Sign out", desc: "Log out of your account", action: "signout" },
          ]
        : [
            { title: "Become a Member", desc: "Read our community care agreements and join", href: "/join" },
            { title: "Sign in", desc: "Already a member? Continue here", href: "/login" },
            { title: "Community Care Agreements", desc: "Our shared vision, and what we ask of members", href: "/community-care-agreements" },
          ],
    },
  ];
}

function Caret() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 5h12M3 9h12M3 13h12" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
    </svg>
  );
}

function MenuEntry({
  item,
  className,
  onNavigate,
}: {
  item: MenuItem;
  className: string;
  onNavigate?: () => void;
}) {
  if (item.action === "signout") {
    return (
      <button type="button" className={className} onClick={() => signOut({ callbackUrl: "/" })}>
        <span className="nav__panel-title">{item.title}</span>
        <span className="nav__panel-desc">{item.desc}</span>
      </button>
    );
  }
  return (
    <Link href={item.href ?? "/"} className={className} onClick={onNavigate}>
      <span className="nav__panel-title">{item.title}</span>
      <span className="nav__panel-desc">{item.desc}</span>
    </Link>
  );
}

export function PublicDesktopNav({
  menus,
  openMenu,
  isActive,
  onHover,
  onToggle,
  onClose,
  caretRefs,
  navRef,
}: {
  menus: Menu[];
  openMenu: string | null;
  isActive: (path: string) => string;
  onHover: (id: string | null) => void;
  onToggle: (id: string) => void;
  onClose: (focusCaret?: string) => void;
  caretRefs?: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  navRef?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <nav className="nav__desktop" aria-label="Main navigation" ref={navRef}>
      <Link href="/new-to-rim" className={`nav__link${isActive("/new-to-rim")}`}>
        New to RIM
      </Link>
      {menus.map((menu, index) => {
        const open = openMenu === menu.id;
        const panelId = `nav-panel-${menu.id}`;
        const last = index === menus.length - 1;
        const current = menu.items.some((item) => item.href && isActive(item.href));
        return (
          <div
            key={menu.id}
            className={`nav__dropdown${open ? " nav__dropdown--open" : ""}`}
            // Hover intent is for a mouse only: a tap on touch sends an
            // enter event too, and must not start a timer.
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") onHover(menu.id);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") onHover(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && open) {
                event.stopPropagation();
                onClose(menu.id);
              }
            }}
            // Close when focus moves to something outside. A blur with no
            // new target is a click (Safari does not focus links on click);
            // the outside-click listener handles that, so a mouse click on a
            // keyboard-opened panel still reaches its link.
            onBlur={(event) => {
              const next = event.relatedTarget as Node | null;
              if (open && next && !event.currentTarget.contains(next)) onClose();
            }}
          >
            {menu.href ? (
              <>
                <Link href={menu.href} className={`nav__link${current ? " nav__link--active" : ""}`}>
                  {menu.label}
                </Link>
                <button
                  type="button"
                  className="nav__caret"
                  aria-expanded={open}
                  aria-controls={panelId}
                  aria-label={`${menu.label} menu`}
                  onClick={() => onToggle(menu.id)}
                  ref={(el) => {
                    if (caretRefs) caretRefs.current[menu.id] = el;
                  }}
                >
                  <Caret />
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`nav__link nav__link--toggle${current ? " nav__link--active" : ""}`}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => onToggle(menu.id)}
                ref={(el) => {
                  if (caretRefs) caretRefs.current[menu.id] = el;
                }}
              >
                <span className="nav__link-label">{menu.label}</span>
                <Caret />
              </button>
            )}
            <div
              id={panelId}
              className={`nav__panel${last ? " nav__panel--end" : ""}`}
              hidden={!open}
            >
              {menu.items.map((item) => (
                <MenuEntry
                  key={item.title}
                  item={item}
                  className="nav__panel-link"
                  onNavigate={() => onClose()}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function PublicNavSheet({
  menus,
  isLoggedIn,
  isActive,
  sheetRef,
  closeRef,
  onClose,
  onNavigate,
}: {
  menus: Menu[];
  isLoggedIn: boolean;
  isActive: (path: string) => string;
  sheetRef?: React.RefObject<HTMLDivElement | null>;
  closeRef?: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const groups = menus.filter((menu) => menu.id !== "members");
  const agreements = { title: "Community Care Agreements", href: "/community-care-agreements" };
  return (
    <div
      id="nav-sheet"
      className="nav__sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      ref={sheetRef}
    >
      <div className="nav__sheet-top">
        <Link onClick={onNavigate} href="/" className="nav__brand">
          <img src="/images/Rooted-In-Mindfulness-Logo.png" alt="Rooted In Mindfulness" height={40} />
          <span className="nav__brand-name">Rooted In Mindfulness</span>
        </Link>
        <button type="button" className="nav__menu-btn" onClick={onClose} ref={closeRef}>
          <CloseIcon />
          Close
        </button>
      </div>
      <nav className="nav__sheet-body" aria-label="Main navigation">
        <Link onClick={onNavigate} href="/new-to-rim" className={`nav__sheet-lead${isActive("/new-to-rim")}`}>
          New to RIM
        </Link>
        {groups.map((menu) => (
          <div key={menu.id} className="nav__sheet-group">
            <p className="nav__sheet-label">{menu.label}</p>
            {menu.items.map((item) => (
              <Link
                onClick={onNavigate}
                key={item.title}
                href={item.href ?? "/"}
                className={`nav__sheet-link${item.href ? isActive(item.href) : ""}`}
              >
                {item.title}
              </Link>
            ))}
            {menu.id === "involved" && (
              <Link
                onClick={onNavigate}
                href={agreements.href}
                className={`nav__sheet-link${isActive(agreements.href)}`}
              >
                {agreements.title}
              </Link>
            )}
          </div>
        ))}
      </nav>
      <div className="nav__sheet-foot">
        <div className="nav__sheet-pair">
          {isLoggedIn ? (
            <>
              <Link onClick={onNavigate} href="/account/dashboard">My Home</Link>
              <button type="button" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link onClick={onNavigate} href="/login">Sign in</Link>
              <Link onClick={onNavigate} href="/join">Become a member</Link>
            </>
          )}
        </div>
        <Link onClick={onNavigate} href="/donate" className="nav__donate nav__donate--block">
          Donate
        </Link>
      </div>
    </div>
  );
}
