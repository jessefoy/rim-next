/**
 * /tools/learning — Course/Series list
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import ManualHelpIcon from "@/components/ManualHelpIcon";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: "Course Manager — Series" };
}

export default async function SeriesListPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const courses = await db.course.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      _count: { select: { lessons: true } },
    },
  });

  return (
    <div className="th-list">
      <div className="th-list__header">
        <h2 className="th-list__title">Series <ManualHelpIcon manualSlug="course-hub" /></h2>
        <Link href="/tools/learning/new" className="th-btn th-btn--primary">
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
                  <Link href={`/tools/learning/${course.slug}`} className="th-link">
                    {course.title}
                  </Link>
                </td>
                <td className="th-table__muted">{course.slug}</td>
                <td>
                  <span className={`th-badge ${course.accessLevel === "ALL_MEMBERS" ? "th-badge--green" : "th-badge--blue"}`}>
                    {course.accessLevel === "ALL_MEMBERS" ? "All Members" : "Registration Required"}
                  </span>
                </td>
                <td>{course._count.lessons}</td>
                <td>
                  <span className={`th-badge ${course.isActive ? "th-badge--green" : "th-badge--muted"}`}>
                    {course.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <Link href={`/tools/learning/${course.slug}`} className="th-link">
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
