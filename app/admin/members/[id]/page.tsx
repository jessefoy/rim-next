import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import MemberDetail from "@/components/MemberDetail";

export const dynamic = "force-dynamic";

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    include: {
      registrations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          programTitle: true,
          programSlug: true,
          status: true,
          donationStatus: true,
          createdAt: true,
        },
      },
      courseAccess: {
        orderBy: { createdAt: "asc" },
        select: { id: true, courseSlug: true, createdAt: true },
      },
    },
  });

  if (!user) notFound();

  const serialized = {
    ...user,
    archivedAt: user.archivedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    registrations: user.registrations.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    courseAccess: user.courseAccess.map((g) => ({
      ...g,
      createdAt: g.createdAt.toISOString(),
    })),
  };

  return (
    <div className="adm-page">
      <div className="adm-content adm-content--narrow">
        <MemberDetail member={serialized} />
      </div>
    </div>
  );
}
