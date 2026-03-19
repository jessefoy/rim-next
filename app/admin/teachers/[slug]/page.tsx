import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import TeacherEditor from "@/components/TeacherEditor";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const teacher = await db.teacher.findUnique({ where: { slug }, select: { name: true } });
  return { title: `Edit: ${teacher?.name ?? "Teacher"} — Admin` };
}

export default async function AdminTeacherEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
    return (
      <div className="adm-page">
        <div className="adm-content">
          <p className="adm-unauthorized">You don&rsquo;t have permission to access this area.</p>
        </div>
      </div>
    );
  }

  const teacher = await db.teacher.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, bio: true, photoUrl: true, isActive: true },
  });

  if (!teacher) notFound();

  const serialized = {
    id: teacher.id,
    name: teacher.name,
    slug: teacher.slug,
    bio: teacher.bio ?? null,
    photoUrl: teacher.photoUrl ?? null,
    isActive: teacher.isActive,
    lessons: [] as { lessonId: string; lessonSlug: string; lessonTitle: string; courses: { courseSlug: string; courseTitle: string }[] }[],
  };

  return (
    <div className="adm-page">
      <div className="adm-content">
        <div className="adm-header">
          <a href="/admin/teachers" className="adm-back-link">← All Teachers</a>
          <h1 className="adm-title">Edit Teacher</h1>
        </div>
        <TeacherEditor initialData={serialized} />
      </div>
    </div>
  );
}
