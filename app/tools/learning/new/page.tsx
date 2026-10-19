/**
 * /tools/learning/new — Create a new course/series
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { hasToolAccess } from "@/lib/toolAuth";
import CourseEditor from "@/components/CourseEditor";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: "Course Manager - New Series" };
}

export default async function NewCoursePage() {
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running
  // its layout, so the layout alone doesn't protect this data (2026-10-19 audit).
  if (!(await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning"))) notFound();

  return <CourseEditor isEditing={false} />;
}
