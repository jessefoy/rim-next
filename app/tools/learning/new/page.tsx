/**
 * /tools/learning/new — Create a new course/series
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CourseEditor from "@/components/CourseEditor";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: "Course Manager — New Series" };
}

export default async function NewCoursePage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <CourseEditor isEditing={false} />;
}
