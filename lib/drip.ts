/**
 * lib/drip.ts — Lesson availability logic for drip/scheduled release.
 * Pure functions — no DB calls. All data passed in.
 */

export interface LessonDripFields {
  id: string;
  releaseDate: Date | null;
  releaseDelayDays: number | null;
}

export interface CourseDripFields {
  dripEnabled: boolean;
  dripIntervalDays: number | null;
}

export interface EnrollmentDateFields {
  enrolledAt: Date;
}

/**
 * Is this lesson currently available for a given enrollment?
 * @param positionIndex - 0-indexed position of this lesson in the ordered series
 */
export function isLessonAvailable(
  lesson: LessonDripFields,
  positionIndex: number,
  course: CourseDripFields,
  enrollment: EnrollmentDateFields | null,
  now: Date
): boolean {
  if (!course.dripEnabled) return true;
  if (!enrollment) return false;

  // Fixed date release — overrides interval
  if (lesson.releaseDate) {
    return now >= lesson.releaseDate;
  }

  // Interval-based release
  const delay = lesson.releaseDelayDays ?? course.dripIntervalDays ?? 0;
  const daysToAdd = positionIndex * delay;
  const availableMs = enrollment.enrolledAt.getTime() + daysToAdd * 24 * 60 * 60 * 1000;
  return now >= new Date(availableMs);
}

/**
 * Compute the exact date a lesson becomes available for a given enrollment.
 * Used to show "Available [date]" messages.
 */
export function computeAvailableDate(
  lesson: LessonDripFields,
  positionIndex: number,
  course: CourseDripFields,
  enrollment: EnrollmentDateFields
): Date {
  if (lesson.releaseDate) return lesson.releaseDate;
  const delay = lesson.releaseDelayDays ?? course.dripIntervalDays ?? 0;
  const daysToAdd = positionIndex * delay;
  return new Date(enrollment.enrolledAt.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
}

/** Format a Date as "Day, Month Date" e.g. "Tuesday, April 15" */
export function formatAvailableDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });
}
