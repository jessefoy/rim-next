import Link from "next/link";
import type { ReactNode } from "react";
import {
  OFFERING_CATEGORIES,
  PUBLIC_CATEGORY_ORDER,
  HOSTED_BY_VOLUNTEERS_LABEL,
  SILENT_MEDITATION_LINE,
  FOUNDATIONS_FORMATS_LINE,
  FOUNDATIONS_PROGRAM_NAME,
  formatLabel,
  type OfferingCategoryCode,
} from "@/lib/programOffering";
import { loadPublicPrograms, programsInCategory, type PublicProgram } from "@/lib/publicPrograms";
import HashTargetScroller from "@/components/HashTargetScroller";
import ProgramRow, { dropCt } from "@/components/ProgramRow";
import PracticeWithUs from "@/components/PracticeWithUs";
import { buildSubtitle, fmtLabel, computeDateText, computeTimeText, hasConcludedOneTime } from "@/lib/programUtils";
import { activeAnnouncement } from "@/lib/scheduleUtils";

export const metadata = {
  title: "Programs and Events - Rooted In Mindfulness",
  description:
    "Weekly meditation and dharma gatherings, Foundations, workshops and retreats, and community groups at Rooted in Mindfulness in Brookfield, Wisconsin, in person and on Zoom.",
};

export const dynamic = "force-dynamic";

/**
 * Programs & Events (2026-10-14, Jesse's approved mockup,
 * mockups/programs-2026-10-14b/). The three ways and the community offerings
 * are the page's sections, said once: each section is its own room on
 * alternating white and Pampas grounds (as on home), its programs one list in
 * the opposite ground, one plain row per program (name; day, time and where;
 * its line; View). The category doors, the "Taking CARE program category"
 * labels, the boxed sections and their counts, the per-row Drop-in labels,
 * the delivery pills and the arrow circles are gone; "All times are Central"
 * is said once, in the hero. Every section still fills itself from the
 * Program Manager (each program's Category). See RIM_Public_Pages.md,
 * "Programs & Events: the three ways, said once".
 */

const TZ = "America/Chicago";

/** "Saturday, December 5", with the year only when it isn't this year. */
function longDate(d: Date, currentYear: number): string {
  const year = Number(d.toLocaleDateString("en-US", { timeZone: TZ, year: "numeric" }));
  return d.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(year !== currentYear ? { year: "numeric" } : {}),
  });
}

/** The CT calendar day of a date, as YYYY-MM-DD. */
const ctDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });


export default async function CommunityProgramsPage() {
  // The listing rule (what is listed, with each program's Category, Format and
  // checkboxes resolved) lives in lib/publicPrograms.ts.
  const programs = await loadPublicPrograms();

  const currentYear = Number(new Date().toLocaleDateString("en-CA", { timeZone: TZ }).split("-")[0]);
  const isOneTime = (p: PublicProgram) => !p.recurrenceFreq && !!p.startDatetime;
  const inCategory = (code: OfferingCategoryCode) => programsInCategory(programs, code);

  /** One program as a row: its name, one line of when and where, its line. */
  const renderRow = (program: PublicProgram, TitleTag: "h3" | "h4", code: OfferingCategoryCode): ReactNode => {
    const where = fmtLabel(program.programFormat, program.outsideMeetingUrl);
    const offering = program.offering;

    let when: string | null;
    if (isOneTime(program) && !hasConcludedOneTime(program)) {
      // A dated offering leads with its date. A past-but-kept-listed program
      // falls through to its schedule label; a stale date isn't showcased.
      // dateText is the cached computed label unless a coordinator wrote their
      // own, and their own wins; otherwise the date in full, a range across
      // days for a multi-day event.
      const start = program.startDatetime!;
      const cached = computeDateText(start, null, null, null, program.endDatetime);
      const end = program.endDatetime;
      const multiDay = !!end && ctDay(end) !== ctDay(start);
      const date =
        program.dateText && program.dateText !== cached
          ? program.dateText
          : multiDay
            ? `${longDate(start, currentYear)} to ${longDate(end!, currentYear)}`
            : longDate(start, currentYear);
      const time = program.timeText || computeTimeText(start, end);
      when = [date, dropCt(time)].filter(Boolean).join(" · ");
    } else {
      const full = buildSubtitle(program);
      when = dropCt(full?.endsWith(` | ${where}`) ? full.slice(0, -(` | ${where}`).length) : full) ?? null;
      // With no schedule at all, buildSubtitle returns just the place.
      if (when === where) when = null;
    }

    // The section says what kind of offering most rows are, so a row names
    // its Format only where the kinds vary (Workshop, Retreat, Course), and
    // "Hosted by volunteers" where the silent meditation line doesn't say it.
    const kind =
      code !== "ONGOING_LEARNING_PRACTICE" && code !== "COMMUNITY_GROUP" && offering.format !== "DROP_IN"
        ? formatLabel(offering.format)
        : null;
    const hosted = offering.hostedByVolunteers && !offering.silentMeditation ? HOSTED_BY_VOLUNTEERS_LABEL : null;
    const line = [kind, when, where, hosted].filter(Boolean).join(" · ");

    return (
      <ProgramRow
        key={program.id}
        href={`/programs/${program.slug}`}
        title={program.name}
        line={line}
        tagline={program.tagline}
        announcement={activeAnnouncement(program)}
        titleTag={TitleTag}
      />
    );
  };

  // The sections that render, in order: the three ways always (each has a
  // standing state when it is empty), the community offerings when they have
  // programs.
  const sections = PUBLIC_CATEGORY_ORDER.filter((code) => {
    const alwaysShown = code === "FOUNDATIONS" || code === "ONGOING_LEARNING_PRACTICE" || code === "IMMERSION";
    return alwaysShown || inCategory(code).length > 0;
  });

  return (
    <div className="pl-page">
      <HashTargetScroller />
      {/* ── Hero: quiet, on the ground (the 2026-10-09 refresh), with the
             sections named once as links. ── */}
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Practice in community</p>
          <h1 className="pp-hero__title">Programs and Events</h1>
          <p className="pp-hero__body">
            Sit together, study the teachings, and bring what you find into the rest of your life.
            Join us at the center or online, whether you are beginning or have practiced for years.
          </p>
          <div className="pp-hero__actions">
            <Link href="/this-week" className="pp-btn">
              This week&rsquo;s schedule <span aria-hidden="true">→</span>
            </Link>
          </div>
          <nav className="pl-jump" aria-label="On this page">
            {sections.map((code) => {
              const info = OFFERING_CATEGORIES.find((c) => c.code === code)!;
              return (
                <a key={code} href={`#${info.anchor}`}>
                  {info.sectionTitle}
                </a>
              );
            })}
            <span>All times are Central.</span>
          </nav>
        </div>
      </section>

      {sections.map((code, index) => {
        const info = OFFERING_CATEGORIES.find((c) => c.code === code)!;
        const inThis = inCategory(code);

        // Ongoing Learning & Practice shows its drop-ins first, then the
        // silent meditation under its own subheading and line, then any
        // classes. Courses belong to Immersion (Jesse, 2026-10-08), so a
        // course placed here shows under "Classes" until its Category is
        // corrected.
        type Group = { key: string; heading?: string; line?: string; programs: typeof inThis };
        let groups: Group[];
        if (code === "ONGOING_LEARNING_PRACTICE") {
          groups = [
            { key: "drop-ins", programs: inThis.filter((p) => p.offering.format === "DROP_IN" && !p.offering.silentMeditation) },
            { key: "silent", heading: "Silent meditation", line: SILENT_MEDITATION_LINE, programs: inThis.filter((p) => p.offering.silentMeditation) },
            { key: "classes", heading: "Classes", programs: inThis.filter((p) => p.offering.format !== "DROP_IN" && !p.offering.silentMeditation) },
          ].filter((g) => g.programs.length > 0);
        } else {
          groups = inThis.length > 0 ? [{ key: "all", programs: inThis }] : [];
        }

        const headingId = `${info.anchor}-title`;
        return (
          // The id is the anchor other pages link to (Home's cards:
          // #foundations, #ongoing-learning-and-practice, #immersion).
          <section
            key={code}
            id={info.anchor}
            className={index % 2 === 0 ? "pl-band pl-band--white" : "pl-band"}
            aria-labelledby={headingId}
          >
            <div className="rim-container">
              <div className="pl-head">
                <h2 id={headingId}>{info.sectionTitle}</h2>
                {info.intro && <p>{info.intro}</p>}
              </div>

              {code === "FOUNDATIONS" && inThis.length === 0 ? (
                // No Foundations program is listed yet (Taking CARE
                // Foundations is hidden until it is dated): one standing row
                // carrying the program's name, to the Foundations page.
                <ul className="pl-list">
                  <ProgramRow
                    href="/foundations"
                    title={FOUNDATIONS_PROGRAM_NAME}
                    line="Dates to come"
                    tagline={FOUNDATIONS_FORMATS_LINE}
                  />
                </ul>
              ) : groups.length === 0 ? (
                // Only Immersion promises dates; another empty section shows
                // its heading alone (as before).
                code === "IMMERSION" && (
                <ul className="pl-list">
                  <li>
                    <p className="pl-empty">Upcoming dates will be listed here.</p>
                  </li>
                </ul>
                )
              ) : (
                groups.map((group) => (
                  <div key={group.key}>
                    {group.heading && (
                      <div className="pl-sub">
                        <h3>{group.heading}</h3>
                        {group.line && <p>{group.line}</p>}
                      </div>
                    )}
                    {/* Rows under a subheading sit one level below it. */}
                    <ul className="pl-list">
                      {group.programs.map((p) => renderRow(p, group.heading ? "h4" : "h3", code))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </section>
        );
      })}

      {/* ── The closing, its own room on the next ground. ── */}
      <section className={sections.length % 2 === 0 ? "pl-band pl-band--white" : "pl-band"}>
        <div className="rim-container">
          <PracticeWithUs />
        </div>
      </section>
    </div>
  );
}
