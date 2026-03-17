/**
 * /account/hub/[slug]/courses — Course list (Courses tab)
 * Server component. Fetches all courses from Postgres.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Courses` };
}

export default async function CoursesListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, roles);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  const courses = await db.course.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      _count: { select: { lessons: true } },
    },
  });

  return (
    <div className="th-list">
      <div className="th-list__header">
        <h2 className="th-list__title">Series</h2>
        <Link href={`/account/hub/${slug}/courses/new`} className="th-btn th-btn--primary">
          New Series
        </Link>
      </div>

      {courses.length === 0 ? (
        <p className="th-empty">No series yet. Create your first series to get started.</p>
      ) : (
        <table className="th-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Access Level</th>
              <th>Lessons</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id}>
                <td>
                  <Link href={`/account/hub/${slug}/courses/${course.slug}`} className="th-link">
                    {course.title}
                  </Link>
                </td>
                <td className="th-table__muted">{course.slug}</td>
                <td>
                  <span className={`th-badge ${course.accessLevel === "MEMBERS" ? "th-badge--green" : "th-badge--blue"}`}>
                    {course.accessLevel === "MEMBERS" ? "All Members" : "Registration Required"}
                  </span>
                </td>
                <td>{course._count.lessons}</td>
                <td>
                  <span className={`th-badge ${course.isActive ? "th-badge--green" : "th-badge--muted"}`}>
                    {course.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <Link href={`/account/hub/${slug}/courses/${course.slug}`} className="th-link">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
