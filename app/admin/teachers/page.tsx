import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import TeacherAdmin from "@/components/TeacherAdmin";
import ManualHelpIcon from "@/components/ManualHelpIcon";

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
    select: { id: true, name: true, slug: true, isActive: true, createdAt: true },
  });

  const serialized = teachers.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    isActive: t.isActive,
    lessonCount: 0,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="adm-page">
      <div className="adm-content">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <h1 className="adm-title" style={{ margin: 0 }}>Teachers</h1>
          <ManualHelpIcon manualSlug="course-hub" />
        </div>
        <TeacherAdmin teachers={serialized} />
      </div>
    </div>
  );
}
