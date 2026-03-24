/**
 * /tools/learning/lessons/new — Create a new lesson
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LessonEditor from "@/components/LessonEditor";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: "Course Manager — New Lesson" };
}

export default async function NewLessonPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <LessonEditor isEditing={false} />;
}
