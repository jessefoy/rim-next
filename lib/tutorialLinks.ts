/**
 * Links into /tutorials from the places people get stuck (2026-10-21). Kept
 * apart from components/tutorials so a page that only links to a step doesn't
 * load the tutorials' drawings.
 */

/** The tutorial written in a hosting team's own words, where one exists.
 *  Every other hosting team gets Hosting on Zoom ("host", "hosting"). */
const CLAIM_HOST_HELP_BY_TEAM: Record<string, string> = {
  "peer-led-silent-meditation": "/tutorials/getting-started-for-guides#step-12",
};

/** Zoom's part (open Participants, then Claim Host), linked from the host's
 *  page at the Zoom door. Chosen by the program's hosting team. */
export function claimHostHelpHref(hostingHubSlug: string): string {
  return CLAIM_HOST_HELP_BY_TEAM[hostingHubSlug] ?? "/tutorials/hosting-on-zoom#step-4";
}
