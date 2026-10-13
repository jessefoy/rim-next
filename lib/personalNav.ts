/**
 * The member's personal pages wear the public site's header (2026-10-12).
 *
 * Testers said of the member area: "I couldn't get back to the site, I was
 * somewhere else." The separate member header made My Home feel like a second
 * website, so the personal pages now keep the site's own header, logo and
 * footer, and the member rail sits inside the page as local navigation.
 * Team spaces, tools and administration keep the work header for now.
 *
 * Read by Nav (which header), AccountSidebar (rail placement) and
 * FooterWrapper (the footer shows on these pages).
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
 * the root layout and cannot see the account layout's data, so the rail
 * publishes it here while a personal page is mounted (and clears it after).
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
