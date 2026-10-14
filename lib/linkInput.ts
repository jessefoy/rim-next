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
