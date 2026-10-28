/**
 * The system powers in the words Roles & access uses
 * (components/member-sections/RolesSection.tsx), for every place the registry
 * names a person's roles. A role not listed (the retired HOST and SUPPORT) is
 * residual data and is not shown. Order is display order.
 */
export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  GUIDING_TEACHER: "Guiding teacher",
  REGISTRAR: "Registrar",
  TEACHER: "Teacher",
  HOST_MANAGER: "Scheduling manager",
  CONTENT_EDITOR: "Content editor",
};

const ROLE_ORDER = Object.keys(ROLE_LABELS);

/** A person's roles that are shown, in display order. */
export const shownRoles = (roles: string[]) => ROLE_ORDER.filter((r) => roles.includes(r));
