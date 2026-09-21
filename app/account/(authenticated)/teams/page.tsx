import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";

export const metadata = { title: "My Teams — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // Match canAccessHub: membership OR guiding teacher. ADMIN alone never
  // reveals team content. Paused memberships retain their existing read door.
  const isTeacher = (session.user.roles ?? []).includes("GUIDING_TEACHER");
  const teams = await db.hub.findMany({
    where: isTeacher ? {} : { members: { some: { userId: session.user.id } } },
    select: { slug: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
  return <AccountLayout><div className="ac-member-page rim-directory">
    <header className="ac-page-head"><div><h1 className="ac-page-title">My Teams</h1>
      <p className="ac-page-sub">Choose a team to find its conversations, files, and shared work.</p></div></header>
    {teams.length ? <ul className="rim-destination-list">{teams.map(team =>
      <li key={team.slug}><Link href={`/account/hub/${team.slug}`}>
        <span>{team.name}{team.status !== "ACTIVE" && <small>{team.status === "ARCHIVED" ? "Archived" : "Inactive"}</small>}</span>
        <span aria-hidden="true">→</span>
      </Link></li>
    )}</ul> : <p className="rim-empty">Your teams will appear here when you join one.</p>}
  </div></AccountLayout>;
}
