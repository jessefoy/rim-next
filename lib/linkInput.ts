/**
 * Tidy a link someone typed or pasted (2026-10-14). Shared by every link box
 * (the rich text editor's link button, the email template editor) and by the
 * program save routes for a venue's Location Link, so a link means the same
 * thing wherever it is entered. Dependency-free.
 *
 * - trims, and drops a doubled scheme ("https://https://docs.google…", from
 *   pasting after a prefilled "https://");
 * - turns a bare email address into a mailto: link;
 * - adds https:// to a bare web address ("docs.google.com/…");
 * - leaves http(s), mailto:, tel:, and in-site links ("/programs/x", "#a")
 *   as they are, and anything else unchanged for the caller to refuse.
 */
export function normalizeLinkInput(raw: string): string {
  let url = raw.trim();
  if (!url) return "";
  url = url.replace(/^(?:https?:\/\/\s*)+(?=https?:\/\/)/i, "");
  if (/^(?:https?:|mailto:|tel:)/i.test(url) || /^[\/#]/.test(url)) return url;
  if (/^[^\s@\/:]+@[^\s@\/:]+\.[a-z]{2,}$/i.test(url)) return `mailto:${url}`;
  if (/^[^\s@\/:.][^\s@\/:]*\.[a-z]{2,}(?:[\/?#:][^\s]*)?$/i.test(url)) return `https://${url}`;
  return url;
}

/**
 * A team's slug changed: point a link at its new address (2026-10-16). Only
 * RIM's own links are touched (an in-site path, or a full URL on one of
 * `ownOrigins`): the `/account/hub/<slug>` path segment and a `hub=<slug>`
 * query value. Anything else, and every other site's link, is returned as it
 * was. Dependency-free.
 */
export function retargetTeamLink(href: string, oldSlug: string, newSlug: string, ownOrigins: string[]): string {
  const trimmed = href.trim();
  const inSite = trimmed.startsWith("/") && !trimmed.startsWith("//");
  let url: URL;
  try {
    url = new URL(trimmed, "https://rim.invalid");
  } catch {
    return href;
  }
  if (!inSite && !ownOrigins.includes(url.origin)) return href;

  const segments = url.pathname.split("/");
  let changed = false;
  for (let i = 0; i + 2 < segments.length; i++) {
    if (segments[i + 1] === "account" && segments[i + 2] === "hub" && segments[i + 3] === oldSlug) {
      segments[i + 3] = newSlug;
      changed = true;
    }
  }
  if (url.searchParams.get("hub") === oldSlug) {
    url.searchParams.set("hub", newSlug);
    changed = true;
  }
  if (!changed) return href;
  url.pathname = segments.join("/");
  return inSite ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}
