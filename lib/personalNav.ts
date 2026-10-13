/**
 * Every page wears the public site's header (personal pages 2026-10-12; team
 * spaces, Files, tools and administration 2026-10-13, when the separate
 * member header retired).
 *
 * Testers said of the member area: "I couldn't get back to the site, I was
 * somewhere else." The separate member header made My Home feel like a second
 * website, so the site's own header and logo stay put everywhere, and each
 * area's rail sits beneath it as local navigation.
 *
 * The personal pages below differ in three ways: they also keep the site's
 * footer (FooterWrapper), the header marks My Home as current (Nav), and on
 * phones the header's Menu lists them instead of the rail (AccountSidebar).
 */
const PERSONAL_PATHS = [
  "/account/dashboard",
  "/account/dashboard-my-profile",
  "/account/courses",
  "/account/teams",
  "/account/community-care",
  "/account/handful-of-leaves",
  "/account/welcome",
  "/account/reactivate",
];

export function isPersonalAccountPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PERSONAL_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/*
 * What the phone Menu sheet needs to list the member's own pages. Nav lives in
 * the root layout and cannot see the account layout's data, so the account
 * rail publishes it here while mounted (and clears it after); team and tool
 * pages, which have no account rail, fall back to a default in Nav.
 * My Teams shows only for someone on a team (Jesse, 2026-10-12), which only
 * the account layout knows.
 */
export type PersonalNav = { showTeams: boolean; canManage: boolean };

let current: PersonalNav | null = null;
const listeners = new Set<() => void>();

export function setPersonalNav(next: PersonalNav | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function subscribePersonalNav(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPersonalNav() {
  return current;
}

export function getServerPersonalNav() {
  return null;
}
