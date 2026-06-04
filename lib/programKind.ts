/**
 * Program offering KIND — the structural "what is this offering" vocabulary.
 *
 * Established session 137 (2026-06-04). The kind lives on `ProgramCategory.kind`
 * (a program inherits its category's kind). It answers Axis 1 — *what the
 * offering is*. Registration (`Program.registrationEnabled` + `danaMode`) is the
 * separate Axis 2 — *what registering does*. Behavior (dashboard placement,
 * access gates) is computed from the two together. See RIM_Offering_Model.md.
 *
 * Storage is a stable string CODE; the human LABEL lives here in code, so
 * renaming a kind never touches the database, and adding a kind is a small
 * change. Codes are the only sticky part.
 */

export const PROGRAM_KINDS = [
  {
    code: "DROP_IN",
    label: "Drop-In",
    hint: "Open practice or teaching — anyone can drop in, no registration needed.",
  },
  {
    code: "COMMUNITY_GROUP",
    label: "Community Group",
    hint: "An ongoing peer community. Open to drop in unless it takes registration.",
  },
  {
    code: "CLASS",
    label: "Class",
    hint: "A taught course, series, or workshop you register for.",
  },
  {
    code: "EVENT",
    label: "Event",
    hint: "A one-time gathering, including a day-long one.",
  },
  {
    code: "RETREAT",
    label: "Retreat",
    hint: "A multi-day immersive offering.",
  },
  {
    code: "SERVICE",
    label: "Service",
    hint: "A community service offering.",
  },
  {
    code: "PRIVATE",
    label: "Private",
    hint: "One-on-one sessions; hidden from public listings.",
  },
] as const;

export type ProgramKindCode = (typeof PROGRAM_KINDS)[number]["code"];

export const PROGRAM_KIND_CODES: readonly string[] = PROGRAM_KINDS.map((k) => k.code);

/** Human label for a kind code; falls back to the raw code if unknown. */
export function kindLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return PROGRAM_KINDS.find((k) => k.code === code)?.label ?? code;
}

export function isValidKind(code: string | null | undefined): code is ProgramKindCode {
  return !!code && PROGRAM_KIND_CODES.includes(code);
}

/**
 * Is this offering openly droppable — i.e. shown on the community schedule /
 * dashboard "Today" with a public Join, for everyone, regardless of
 * registration?
 *
 * - DROP_IN          → always open
 * - COMMUNITY_GROUP  → open only when it does NOT require registration
 *   (an open community circle like Recovery Dharma is droppable; a registered
 *   one like Qigong is a commitment that surfaces via "Coming up for you")
 * - everything else  → a commitment: CLASS / EVENT / RETREAT / SERVICE / PRIVATE
 *   never offer a public Join to a non-registrant
 *
 * Null kind falls back to the legacy heuristic ("no registration = drop-in")
 * so the dashboard never empties out if a category's kind is unset.
 */
export function isOpenlyDroppable(
  kind: string | null | undefined,
  registrationEnabled: boolean,
): boolean {
  if (kind === "DROP_IN") return true;
  if (kind === "COMMUNITY_GROUP") return !registrationEnabled;
  if (kind == null) return !registrationEnabled;
  return false;
}
