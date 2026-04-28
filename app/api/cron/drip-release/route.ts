import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLessonAvailable } from "@/lib/drip";
import { sendDripLessonAvailableEmail } from "@/lib/email";

const BASE_URL =
  (process.env.NEXTAUTH_URL ?? "http://localhost:3000").trim().replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all drip-enabled active courses
  const dripCourses = await db.course.findMany({
    where: { dripEnabled: true, isActive: true },
    include: {
      lessons: {
        include: {
          lesson: {
            select: {
              id: true, slug: true, titleDisplayed: true,
              releaseDate: true, releaseDelayDays: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      enrollments: {
        where: { completedAt: null },
        include: {
          user: { select: { id: true, email: true, firstName: true } },
        },
      },
    },
  });

  let totalSent = 0;

  for (const course of dripCourses) {
    for (const enrollment of course.enrollments) {
      const user = enrollment.user;
      if (!user.email) continue;

      // Check each lesson in this course for this enrollment
      for (let idx = 0; idx < course.lessons.length; idx++) {
        const cl = course.lessons[idx];
        const lesson = cl.lesson;

        // Check if available NOW
        const availableNow = isLessonAvailable(
          { id: lesson.id, releaseDate: lesson.releaseDate, releaseDelayDays: lesson.releaseDelayDays },
          idx,
          { dripEnabled: course.dripEnabled, dripIntervalDays: course.dripIntervalDays },
          { enrolledAt: enrollment.enrolledAt },
          now
        );

        // Check if was NOT available yesterday (became available today)
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const availableYesterday = isLessonAvailable(
          { id: lesson.id, releaseDate: lesson.releaseDate, releaseDelayDays: lesson.releaseDelayDays },
          idx,
          { dripEnabled: course.dripEnabled, dripIntervalDays: course.dripIntervalDays },
          { enrolledAt: enrollment.enrolledAt },
          yesterday
        );

        // Only notify if just became available (wasn't available yesterday)
        if (!availableNow || availableYesterday) continue;
        // Position 0 is always available immediately — skip (no notification for lesson 1)
        if (idx === 0) continue;

        // Check dedup — already notified?
        const existing = await db.dripNotification.findUnique({
          where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
        });
        if (existing) continue;

        // Send notification
        await sendDripLessonAvailableEmail({
          to: user.email,
          memberFirstName: user.firstName ?? "there",
          lessonTitle: lesson.titleDisplayed,
          seriesTitle: course.title,
          lessonUrl: `${BASE_URL}/lessons/${lesson.slug}?course=${course.slug}`,
        });

        // Record dedup
        await db.dripNotification.create({
          data: { userId: user.id, lessonId: lesson.id },
        });

        totalSent++;
      }
    }
  }

  console.log(`[drip-release] Sent ${totalSent} lesson availability notifications`);
  return NextResponse.json({ ok: true, totalSent });
}
