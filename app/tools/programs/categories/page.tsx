import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canUseProgramManager } from "@/lib/toolAuth";
import CategoryOrderClient from "@/components/registrar/CategoryOrderClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Program Categories - Rooted In Mindfulness" };

export default async function CategoriesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running
  // its layout, so the layout alone doesn't protect this data (2026-10-19 audit).
  if (!canUseProgramManager(session.user.roles)) notFound();

  const categories = await db.programCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { programs: true } } },
  });

  const items = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    sortOrder: c.sortOrder,
    programCount: c._count.programs,
    hidden: c.hideFromProgramsPage,
    kind: c.kind ?? null,
  }));

  return <CategoryOrderClient categories={items} />;
}
