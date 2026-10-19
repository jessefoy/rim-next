/**
 * /tools/learning/lessons/new — Create a new lesson
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { hasToolAccess } from "@/lib/toolAuth";
import LessonEditor from "@/components/LessonEditor";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: "Course Manager - New Lesson" };
}

export default async function NewLessonPage() {
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running
  // its layout, so the layout alone doesn't protect this data (2026-10-19 audit).
  if (!(await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning"))) notFound();

  return <LessonEditor isEditing={false} />;
}
