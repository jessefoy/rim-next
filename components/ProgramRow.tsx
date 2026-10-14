import Link from "next/link";
import ProgramCardNotices from "@/components/ProgramCardNotices";

/**
 * One program as a plain row in a `.pl-list`: its name, one line of when and
 * where, its line, and "View". Shared by Programs & Events and the Kalyana
 * Mitta groups page so a program reads the same wherever it is listed
 * (2026-10-14; RIM_Public_Pages.md, "Programs & Events: the three ways, said
 * once"). The caller wraps rows in `<ul className="pl-list">`.
 */
export default function ProgramRow({
  href,
  title,
  line,
  tagline,
  announcement = null,
  titleTag: TitleTag = "h3",
}: {
  href: string;
  title: string;
  line?: string | null;
  tagline?: string | null;
  announcement?: string | null;
  titleTag?: "h3" | "h4";
}) {
  return (
    <li>
      <Link href={href} className="pl-row">
        <div className="pl-row__main">
          <TitleTag className="pl-row__title">{title}</TitleTag>
          {line && <span className="pl-row__when">{line}</span>}
          {tagline && <span className="pl-row__line">{tagline}</span>}
          <ProgramCardNotices announcement={announcement} />
        </div>
        <div className="pl-row__go" aria-hidden="true">
          View <span className="pl-row__arrow">→</span>
        </div>
      </Link>
    </li>
  );
}

/** Lists say "All times are Central" once, so a row drops the trailing CT. */
export const dropCt = (s: string | null | undefined) => (s ? s.replace(/\s+CT$/, "") : s);
