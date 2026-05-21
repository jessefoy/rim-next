/**
 * lib/courseAccess.ts — Course access state for the visitor.
 *
 * Canonical reference: RIM_Offering_Model.md (decided session 118).
 *
 * The course detail page at /course/[slug] needs to handle six visitor
 * states. The page itself shouldn't carry that logic — it lives here so
 * lesson access checks, registration emails, and any future surface can
 * call into the same source of truth.
 *
 * Migration note: during the transition slice (session 123), the helper
 * reads ONLY the new orthogonal flags (allowSelfEnroll,
 * selfEnrollDanaRequired, requiredRoles) — never the legacy accessLevel
 * enum. The schema-slice migration backfilled the flags from the enum
 * for every existing course, and the API endpoints that accept
 * accessLevel now also derive the matching flag values on write
 * (see /api/courses/route.ts and /api/courses/[slug]/route.ts), so
 * the two stay in sync until the enum drops in a later pass.
 */

import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

// ── Types ────────────────────────────────────────────────────────────────────

export type LiveCohort = {
  programSlug: string;
  programName: string;
};

export type CourseAccessState =
  // Visitor is not signed in. Page renders the public landing with a
  // sign-in-first enroll CTA.
  | { kind: "anonymous" }

  // Visitor is enrolled (SeriesEnrollment, CourseAccess grant, or
  // registered for a linked Program). Page renders the TOC.
  | { kind: "enrolled"; source: "SERIES" | "ACCESS_GRANT" | "PROGRAM" }

  // Visitor can self-enroll for free.
  | { kind: "can_self_enroll_free" }

  // Visitor can self-enroll, but dana payment is required first.
  | { kind: "can_self_enroll_dana" }

  // Visitor doesn't have one of the requiredRoles (and isn't an admin).
  // CTA slot shows accessRestrictionMessage (or a derived default).
  | { kind: "role_gated"; requiredRoles: string[] }

  // The course has no self-enroll path; access flows through a live
  // Program registration. If a Program is registering now, the CTA
  // points to it; otherwise the CTA shows a friendly message.
  | { kind: "bundled_only"; liveCohort: LiveCohort | null };

/**
 * Minimum Course fields required to compute access. Callers pass the
 * shape they already loaded — the helper does not re-query the Course.
 */
export type CourseAccessInput = {
  id: string;
  slug: string;
  allowSelfEnroll: boolean;
  selfEnrollDanaRequired: boolean;
  requiredRoles: Role[] | string[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the visitor's state with respect to a given course.
 * Pass the user's session info plus the loaded Course fields.
 */
export async function getCourseAccessState(args: {
  userId: string | null;
  userRoles: string[];
  course: CourseAccessInput;
}): Promise<CourseAccessState> {
  const { userId, userRoles, course } = args;

  if (!userId) {
    return { kind: "anonymous" };
  }

  const isAdmin = userRoles.includes("ADMIN");

  // 1. Check the three enrollment paths in OR.
  //
  // SeriesEnrollment is the canonical enrolled-by-some-path record;
  // CourseAccess is the admin-grant record (independent path); a
  // Registration on a linked Program also grants access while that
  // registration is active.
  const seriesEnrollment = await db.seriesEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { id: true },
  });
  if (seriesEnrollment) {
    return { kind: "enrolled", source: "SERIES" };
  }

  const grant = await db.courseAccess.findUnique({
    where: { userId_courseSlug: { userId, courseSlug: course.slug } },
    select: { id: true },
  });
  if (grant) {
    return { kind: "enrolled", source: "ACCESS_GRANT" };
  }

  const programCourses = await db.programCourse.findMany({
    where: { courseId: course.id },
    select: { programId: true },
  });
  if (programCourses.length > 0) {
    const reg = await db.registration.findFirst({
      where: {
        userId,
        programId: { in: programCourses.map((pc) => pc.programId) },
        status: { in: ["REGISTERED", "APPROVED"] },
      },
      select: { id: true },
    });
    if (reg) {
      return { kind: "enrolled", source: "PROGRAM" };
    }
  }

  // 2. Role-gated — admin bypasses; otherwise must hold at least one
  // listed role to even see the self-enroll path.
  if (course.requiredRoles.length > 0 && !isAdmin) {
    const hasRole = (course.requiredRoles as string[]).some((r) =>
      userRoles.includes(r)
    );
    if (!hasRole) {
      return {
        kind: "role_gated",
        requiredRoles: course.requiredRoles as string[],
      };
    }
  }

  // 3. Self-enroll path.
  if (course.allowSelfEnroll) {
    if (course.selfEnrollDanaRequired) {
      return { kind: "can_self_enroll_dana" };
    }
    return { kind: "can_self_enroll_free" };
  }

  // 4. No self-enroll, no enrollment, no role gate — bundled-only.
  // Resolve the live cohort if one is currently registering:
  // linked Program, not archived, registration enabled and not closed,
  // start date in the future, registration deadline (if set) in the future.
  let liveCohort: LiveCohort | null = null;
  if (programCourses.length > 0) {
    const now = new Date();
    const candidate = await db.program.findFirst({
      where: {
        id: { in: programCourses.map((pc) => pc.programId) },
        archivedAt: null,
        registrationEnabled: true,
        registrationClosed: false,
        startDatetime: { gt: now },
        OR: [
          { registrationDeadline: null },
          { registrationDeadline: { gt: now } },
        ],
      },
      orderBy: { startDatetime: "asc" },
      select: { slug: true, name: true },
    });
    if (candidate) {
      liveCohort = {
        programSlug: candidate.slug,
        programName: candidate.name,
      };
    }
  }

  return { kind: "bundled_only", liveCohort };
}

/**
 * Convenience boolean — does this user have access to the course's
 * content (lessons, TOC)? Use on lesson pages where the only question
 * is "do they get in?"
 */
export async function hasCourseAccess(args: {
  userId: string | null;
  userRoles: string[];
  course: CourseAccessInput;
}): Promise<boolean> {
  if (!args.userId) return false;
  const state = await getCourseAccessState(args);
  return state.kind === "enrolled";
}

/**
 * Derived default for accessRestrictionMessage when the field is empty.
 * Per RIM_Offering_Model.md open question #5, ship with sensible
 * defaults; admins author per-course overrides via the Course Editor.
 *
 * Returns an empty string for states that don't show a restriction
 * message (anonymous / enrolled / can self-enroll).
 */
export function defaultRestrictionMessage(state: CourseAccessState): string {
  if (state.kind === "role_gated") {
    return "This course is offered to specific community members. If you'd like to learn more, get in touch.";
  }
  if (state.kind === "bundled_only" && !state.liveCohort) {
    return "Currently offered through live cohorts — check back when registration opens.";
  }
  return "";
}

/**
 * Translate a legacy CourseAccessLevel enum value to the corresponding
 * orthogonal-flag values. Used by the API write endpoints during the
 * transition so a save through the existing editor keeps the new flags
 * consistent with the legacy enum.
 *
 * Once the editor learns to write the new flags directly (session-123
 * step 5), this helper can be removed.
 */
export function flagsFromAccessLevel(accessLevel: string): {
  allowSelfEnroll: boolean;
  selfEnrollDanaRequired: boolean;
} {
  switch (accessLevel) {
    case "ALL_MEMBERS":
      return { allowSelfEnroll: true, selfEnrollDanaRequired: false };
    case "REGISTRATION_REQUIRED":
      return { allowSelfEnroll: false, selfEnrollDanaRequired: false };
    case "ROLE_REQUIRED":
      return { allowSelfEnroll: true, selfEnrollDanaRequired: false };
    default:
      return { allowSelfEnroll: false, selfEnrollDanaRequired: false };
  }
}
