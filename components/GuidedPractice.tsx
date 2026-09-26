import Link from "next/link";
import { db } from "@/lib/db";
import { buildSubtitle, hasConcludedOneTime, participationLabel } from "@/lib/programUtils";

export default async function GuidedPractice() {
  const programs = await db.program.findMany({
    where: {
      slug: "meditation-and-dharma-talk",
      archivedAt: null, hideFromProgramPageList: false,
      category: { hideFromProgramsPage: false },
    },
    include: { category: true },
    orderBy: { sortOrder: "asc" },
  });
  const visible = programs.filter((p) => !(p.hideWhenPast && hasConcludedOneTime(p)));
  if (!visible.length) return <p><Link href="/this-week">See this week’s gatherings</Link> for current opportunities to practice.</p>;
  return (
    <ul className="pp-guided-practice">
      {visible.map((program) => (
        <li key={program.id}>
          <Link href={`/programs/${program.slug}`}>{program.name}</Link>
          <span>{buildSubtitle(program)}</span>
          <span>{participationLabel(program)}</span>
        </li>
      ))}
    </ul>
  );
}
