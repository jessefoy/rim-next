/**
 * lib/enrollment.ts — Series enrollment helpers
 *
 * Four exported functions for enrolling members in series (courses):
 *   enrollMember                — basic upsert for one course
 *   enrollMemberInOnboardingSeries — enroll in all isOnboarding=true courses
 *   enrollMemberInProgramCourse — enroll in all courses linked to a program
 *   enrollMemberInRoleSeries    — enroll in all ROLE_REQUIRED courses that match a role
 *
 * All functions are fire-and-forget safe: they never throw to the caller
 * (errors are logged but not re-thrown). Call with .catch(() => {}) if needed.
 */

import { db } from "@/lib/db";
import { EnrollmentSource, Role } from "@prisma/client";

/** Upsert a single SeriesEnrollment — safe to call multiple times. */
export async function enrollMember(
  userId: string,
  courseId: string,
  source: EnrollmentSource = EnrollmentSource.ADMIN
): Promise<void> {
  await db.seriesEnrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, enrollmentSource: source },
    update: {}, // already enrolled — no-op; preserve original enrollmentSource
  });
}

/**
 * Enroll a member in every active series marked isOnboarding=true.
 * Called when a new member account is created or when a member completes
 * the community agreements on the welcome page.
 */
export async function enrollMemberInOnboardingSeries(userId: string): Promise<void> {
  try {
    const courses = await db.course.findMany({
      where: { isOnboarding: true, isActive: true },
      select: { id: true },
    });
    await Promise.all(
      courses.map((c) => enrollMember(userId, c.id, EnrollmentSource.ONBOARDING))
    );
  } catch (err) {
    console.error("[enrollment] enrollMemberInOnboardingSeries failed:", err);
  }
}

/**
 * Enroll a member in every series linked to a program via the ProgramCourse
 * join table. Called after a free/waitlisted registration is created (status=REGISTERED)
 * and after a dana payment is completed via Stripe.
 */
export async function enrollMemberInProgramCourse(
  userId: string,
  programId: string
): Promise<void> {
  try {
    const programCourses = await db.programCourse.findMany({
      where: { programId },
      select: { courseId: true },
    });
    await Promise.all(
      programCourses.map((pc) =>
        enrollMember(userId, pc.courseId, EnrollmentSource.PROGRAM)
      )
    );
  } catch (err) {
    console.error("[enrollment] enrollMemberInProgramCourse failed:", err);
  }
}

/**
 * Enroll a member in every active series whose requiredRoles array
 * includes the given role. Called when a new role is added to a member.
 *
 * Migrated session 123 to the orthogonal-flag model: we now match by
 * non-empty requiredRoles instead of the legacy accessLevel enum. The
 * effect is identical for every existing course (the backfill set
 * requiredRoles to match the old ROLE_REQUIRED rows), but the query
 * no longer depends on the enum.
 */
export async function enrollMemberInRoleSeries(
  userId: string,
  role: string
): Promise<void> {
  try {
    const courses = await db.course.findMany({
      where: {
        isActive: true,
        requiredRoles: { has: role as Role },
      },
      select: { id: true },
    });
    await Promise.all(
      courses.map((c) => enrollMember(userId, c.id, EnrollmentSource.ROLE))
    );
  } catch (err) {
    console.error("[enrollment] enrollMemberInRoleSeries failed:", err);
  }
}
