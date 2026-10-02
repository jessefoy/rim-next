import { db } from "@/lib/db";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  OFFERING_CATEGORIES,
  PUBLIC_CATEGORY_ORDER,
  HOSTED_BY_VOLUNTEERS_LABEL,
  SILENT_MEDITATION_LINE,
  formatLabel,
  isPubliclyListedCategory,
  resolveOffering,
  type OfferingCategoryCode,
} from "@/lib/programOffering";
import HashTargetScroller from "@/components/HashTargetScroller";
import ProgramCardNotices from "@/components/ProgramCardNotices";
import PracticeWithUs from "@/components/PracticeWithUs";
import {
  buildSubtitle,
  fmtLabel,
  computeDateText,
  computeTimeText,
  hasConcludedOneTime,
  categoryDisplayName,
} from "@/lib/programUtils";

export const metadata = {
  title: "Programs and Events - Rooted In Mindfulness",
  description:
    "Weekly meditation and dharma gatherings, Foundations, workshops and retreats, and community groups at Rooted in Mindfulness in Brookfield, Wisconsin, in person and on Zoom.",
};

export const dynamic = "force-dynamic";

const TZ = "America/Chicago";

/** CT calendar parts for a date. */
function ctYmd(d: Date): { y: number; m: number; d: number } {
  const [y, m, day] = d.toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  return { y, m, d: day };
}

function ctMonthShort(d: Date): string {
  return d.toLocaleDateString("en-US", { timeZone: TZ, month: "short" });
}

/**
 * The compact leading date for a one-time program's card:
 *   "Sep 21" · "Sep 10–13" · "Sep 28 – Oct 1"
 * The year rides separately so it only renders when it isn't this year.
 */
function datedEventLead(start: Date, end: Date | null): { lead: string; year: number } {
  const s = ctYmd(start);
  const sMonth = ctMonthShort(start);
  if (end) {
    const e = ctYmd(end);
    if (e.y !== s.y || e.m !== s.m || e.d !== s.d) {
      if (e.y === s.y && e.m === s.m) return { lead: `${sMonth} ${s.d}–${e.d}`, year: s.y };
      return { lead: `${sMonth} ${s.d} – ${ctMonthShort(end)} ${e.d}`, year: s.y };
    }
  }
  return { lead: `${sMonth} ${s.d}`, year: s.y };
}

type ListedProgram = Awaited<ReturnType<typeof loadPrograms>>[number];

async function loadPrograms() {
  return db.program.findMany({
    where: {
      hideFromProgramPageList: false,
      archivedAt: null,
    },
    include: { category: true },
    orderBy: { sortOrder: "asc" },
  });
}

export default async function CommunityProgramsPage() {
  const allPrograms = await loadPrograms();

  // A concluded one-time program leaves the listing on its own the day after
  // its date, unless the editor opted out (hideWhenPast, default true).
  const todayYmd = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const currentYear = Number(todayYmd.split("-")[0]);
  const isOneTime = (p: ListedProgram) => !p.recurrenceFreq && !!p.startDatetime;

  // Each program's Category, Format and checkboxes (its own fields, or its old
  // category while those are empty). A program with no Category is not listed,
  // Private is never listed, and the old category's "hide from the Programs
  // page" flag keeps its meaning.
  const programs = allPrograms
    .filter((p) => !(p.hideWhenPast && hasConcludedOneTime(p)))
    .filter((p) => !p.category?.hideFromProgramsPage)
    .map((p) => ({ ...p, offering: resolveOffering(p) }))
    .filter((p) => isPubliclyListedCategory(p.offering.category));
  const inCategory = (code: OfferingCategoryCode) => programs.filter((p) => p.offering.category === code);

  /** One program as a card: date-led for an upcoming one-time program, the
      schedule and format held right for everything else. */
  const renderCard = (program: ListedProgram, TitleTag: "h3" | "h4" = "h3"): ReactNode => {
    const format = fmtLabel(program.programFormat);
    // The offering's own labels: its Format ("Drop-in", "Course") and, where
    // checked, "Hosted by volunteers". Display only.
    const offering = resolveOffering(program);
    const offeringFormat = formatLabel(offering.format);
    const labels =
      offeringFormat || offering.hostedByVolunteers ? (
        <p className="pl-card__labels">
          {offeringFormat && <span>{offeringFormat}</span>}
          {offering.hostedByVolunteers && <span>{HOSTED_BY_VOLUNTEERS_LABEL}</span>}
        </p>
      ) : null;

    // One-time upcoming: keep the date prominent with the scheduling facts,
    // but keep every program title on the same leading edge. A
    // past-but-kept-listed program falls through to the plain card; a stale
    // date isn't showcased.
    if (isOneTime(program) && !hasConcludedOneTime(program)) {
      const { lead, year } = datedEventLead(program.startDatetime!, program.endDatetime);
      // Prefer the coordinator's dateText (the same override order
      // buildSubtitle uses); it's the cached computed label in practice, but
      // an override must win here too.
      const fullDate =
        program.dateText ||
        computeDateText(program.startDatetime, null, null, null, program.endDatetime);
      const time = program.timeText || computeTimeText(program.startDatetime, program.endDatetime);

      return (
        <Link
          key={program.id}
          href={`/programs/${program.slug}`}
          className="pl-card pl-card--catalog pl-card--date"
        >
          <div className="pl-card__content">
            <div className="pl-card__main">
              <div className="pl-card__title-row">
                <TitleTag className="pl-card__title">{program.name}</TitleTag>
              </div>
              {labels}
              {program.tagline && <span className="pl-card__tagline">{program.tagline}</span>}
              <ProgramCardNotices announcement={program.specialAnnouncement} />
            </div>
            <div className="pl-card__when">
              <time
                className="pl-card__date"
                dateTime={program.startDatetime!.toISOString()}
                aria-label={fullDate}
              >
                {lead}
                {year !== currentYear && <span className="pl-card__date-year">{year}</span>}
              </time>
              {time && <span className="pl-card__schedule">{time}</span>}
              {format && <span className="pl-card__format">{format}</span>}
            </div>
            <span className="pl-card__action" aria-hidden="true">→</span>
          </div>
        </Link>
      );
    }

    const fullSubtitle = buildSubtitle(program);
    const schedule = fullSubtitle?.endsWith(` | ${format}`)
      ? fullSubtitle.slice(0, -(` | ${format}`).length)
      : fullSubtitle;

    return (
      <Link
        key={program.id}
        href={`/programs/${program.slug}`}
        className="pl-card pl-card--catalog"
      >
        <div className="pl-card__content">
          <div className="pl-card__main">
            <div className="pl-card__title-row">
              <TitleTag className="pl-card__title">{program.name}</TitleTag>
            </div>
            {labels}
            {program.tagline && <span className="pl-card__tagline">{program.tagline}</span>}
            <ProgramCardNotices announcement={program.specialAnnouncement} />
          </div>
          {/* What it is on the left, when and how on the right. The card is
              900px wide and the copy ran out around 560, leaving the arrow
              floating alone. */}
          <div className="pl-card__when">
            {schedule && <span className="pl-card__schedule">{schedule}</span>}
            {format && <span className="pl-card__format">{format}</span>}
          </div>
          <span className="pl-card__action" aria-hidden="true">→</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="pl-page">
      <HashTargetScroller />
      {/* ── Hero ─────────────────────────────────────────── */}
      <section
        className="pp-hero"
        style={{
          // A 2:1 band cut from the Unsplash original (Casey Horner,
          // unsplash.com/photos/4rDCa5hBlCs) at the old 48% framing; the
          // 534px file it replaces was stretched ~3x across the hero.
          ["--pp-hero-image" as string]: "url('/images/Looking-Up-Pine-Trees-band-1600.webp')",
          ["--pp-hero-position" as string]: "center",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Practice in community</p>
          <h1 className="pp-hero__title">Programs and Events</h1>
          <p className="pp-hero__body">
            Sit together, study the teachings, and bring what you find into the rest of your life.
            Join us at the center or online, whether you are beginning or have practiced for years.
          </p>
          <div className="pp-hero__actions">
            <Link href="/this-week" className="pp-hero__link pp-hero__link--utility">
              See what&rsquo;s happening this week <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Program Listings, by the three ways ───────────── */}
      <section className="pl-catalog">
        <div className="rim-container">
          {PUBLIC_CATEGORY_ORDER.map((code) => {
            const info = OFFERING_CATEGORIES.find((c) => c.code === code)!;
            const inThis = inCategory(code);
            const alwaysShown = code === "FOUNDATIONS" || code === "ONGOING_LEARNING_PRACTICE" || code === "IMMERSION";
            if (inThis.length === 0 && !alwaysShown) return null;

            // Groups of cards within a section: Ongoing Learning & Practice
            // shows its drop-ins first, then the silent meditation sits under
            // their own subheading and line, then courses and classes.
            type Group = { key: string; heading?: string; line?: string; programs: typeof inThis };
            let groups: Group[];
            if (code === "ONGOING_LEARNING_PRACTICE") {
              groups = [
                { key: "drop-ins", programs: inThis.filter((p) => p.offering.format === "DROP_IN" && !p.offering.silentMeditation) },
                { key: "silent", heading: "Silent meditation", line: SILENT_MEDITATION_LINE, programs: inThis.filter((p) => p.offering.silentMeditation) },
                { key: "courses", heading: "Courses and classes", programs: inThis.filter((p) => p.offering.format !== "DROP_IN" && !p.offering.silentMeditation) },
              ].filter((g) => g.programs.length > 0);
            } else {
              groups = inThis.length > 0 ? [{ key: "all", programs: inThis }] : [];
            }

            return (
              // The id is the anchor other pages link to (Home's doors:
              // #ongoing-learning-and-practice, #immersion).
              <div key={code} id={info.anchor} className="pl-cat">
                <div className="pl-cat__header">
                  <h2 className="pl-cat__heading">{info.sectionTitle}</h2>
                  {info.intro && <p className="pl-cat__intro">{info.intro}</p>}
                </div>

                {code === "FOUNDATIONS" && inThis.length === 0 ? (
                  // Foundations is not a scheduled program yet: one static card.
                  <div className="pl-grid">
                    <Link href="/foundations" className="pl-card pl-card--catalog pl-card--solo">
                      <div className="pl-card__content">
                        <div className="pl-card__main">
                          <div className="pl-card__title-row">
                            <h3 className="pl-card__title">Foundations</h3>
                          </div>
                          <span className="pl-card__tagline">
                            Finding your footing in meditation and mindful living.
                          </span>
                        </div>
                        <span className="pl-card__action" aria-hidden="true">→</span>
                      </div>
                    </Link>
                  </div>
                ) : groups.length === 0 ? (
                  code === "IMMERSION" && <p className="pl-cat__note">Upcoming dates will be listed here.</p>
                ) : (
                  groups.map((group, i) => (
                    <div key={group.key}>
                      {group.heading && (
                        <>
                          <h3 className={i === 0 ? "pl-cat__subheading pl-cat__subheading--first" : "pl-cat__subheading"}>
                            {group.heading}
                          </h3>
                          {group.line && <p className="pl-cat__subline">{group.line}</p>}
                        </>
                      )}
                      {/* Cards under a subheading sit one level below it. */}
                      <div className="pl-grid">
                        {group.programs.map((p) => renderCard(p, group.heading ? "h4" : "h3"))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}

          <PracticeWithUs />
        </div>
      </section>
    </div>
  );
}
