import { db } from "@/lib/db";
import CategoryOrderClient from "@/components/registrar/CategoryOrderClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Program Categories — Rooted In Mindfulness" };

export default async function CategoriesPage() {
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
