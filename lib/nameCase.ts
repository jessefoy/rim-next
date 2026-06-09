/**
 * Conservative proper-case normalizer for member names.
 *
 * A name is identity, so the one thing we must not do is "fix" a name that was
 * already right. This only re-cases names that are entirely UPPERCASE or
 * entirely lowercase (the clearly-accidental ones); any intentional mixed-case
 * name — McDonald, DeShawn, van der Berg, O'Brien, LaToya — is returned as
 * typed. Whitespace is always trimmed/collapsed. Hyphens and apostrophes are
 * title-cased (mary-kate → Mary-Kate, o'brien → O'Brien).
 *
 * Applied at name-entry points (join, registration, welcome, admin add-member)
 * and mirrored once in prisma/migrate.mjs for the one-time cleanup of existing
 * rows. Known imperfections deliberately left for hand-fixing: all-caps Mc/Mac
 * surnames (MCDONALD → Mcdonald) and 2-letter initials (TJ → Tj) — auto-
 * correcting either one mangles legitimate names, so we don't try.
 */
export function toProperName(raw: string): string {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return s;
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (!letters) return s; // no cased letters (numbers, CJK, etc.) — leave alone
  const isAllUpper = letters === letters.toUpperCase() && letters !== letters.toLowerCase();
  const isAllLower = letters === letters.toLowerCase() && letters !== letters.toUpperCase();
  if (!isAllUpper && !isAllLower) return s; // intentional mixed case — respect it
  return s.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
}
