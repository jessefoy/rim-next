import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import TeacherAdmin from "@/components/TeacherAdmin";

export const metadata = { title: "Teachers — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminTeachersPage() {
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

  const teachers = await db.teacher.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { lessons: true } } },
  });

  const serialized = teachers.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    isActive: t.isActive,
    lessonCount: t._count.lessons,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="adm-page">
      <div className="adm-content">
        <h1 className="adm-title">Teachers</h1>
        <TeacherAdmin teachers={serialized} />
      </div>
    </div>
  );
}
