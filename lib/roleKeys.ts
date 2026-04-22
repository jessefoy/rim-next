/**
 * Canonical role keys for RoleProfile records.
 *
 * A RoleProfile's `roleKey` identifies which role the description is *for*.
 * New keys can be added without a schema migration — the field is a string.
 * Keep this list in sync with ROLE_KEY_LABELS below.
 *
 * Used by:
 *  - The "My roles" editor (account profile) — dropdown of keyed roles
 *  - Hub.featuredRoles — `role-key` references resolve by matching roleKey
 *  - Admin member profile's role profiles section
 *
 * See RIM_Role_Design.md and the Host Hub Rework spec for why these exist.
 */

export const ROLE_KEYS = {
  GUIDING_TEACHER: "guiding-teacher",
  FOUNDER: "founder",
  VIRTUAL_HOST_COORDINATOR: "virtual-host-coordinator",
  VOLUNTEER_COORDINATOR: "volunteer-coordinator",
  HOST: "host",
  TEACHER: "teacher",
  REGISTRAR: "registrar",
  SUPPORT: "support",
  COURSE_COORDINATOR: "course-coordinator",
} as const;

export type RoleKey = typeof ROLE_KEYS[keyof typeof ROLE_KEYS];

export const ROLE_KEY_LABELS: Record<RoleKey, string> = {
  "guiding-teacher": "Guiding Teacher",
  "founder": "Founder",
  "virtual-host-coordinator": "Virtual Host Coordinator",
  "volunteer-coordinator": "Volunteer Coordinator",
  "host": "Host",
  "teacher": "Teacher",
  "registrar": "Registrar",
  "support": "Support",
  "course-coordinator": "Course Coordinator",
};

/** All keyed role values, in the order they should appear in dropdowns. */
export const ROLE_KEY_VALUES: RoleKey[] = Object.values(ROLE_KEYS) as RoleKey[];

/** Returns the label for a roleKey, or the raw key if unknown. */
export function labelForRoleKey(key: string | null | undefined): string {
  if (!key) return "";
  return (ROLE_KEY_LABELS as Record<string, string>)[key] ?? key;
}
