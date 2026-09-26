import { publicPageMetadata } from "@/lib/publicMetadata";
import { db } from "@/lib/db";
import Link from "next/link";
import HashTargetScroller from "@/components/HashTargetScroller";
import ProgramCardNotices from "@/components/ProgramCardNotices";
import PracticeWithUs from "@/components/PracticeWithUs";
import {
  buildSubtitle,
  participationLabel,
  programLocationLabel,
  fmtLabel,
  computeDateText,
  computeTimeText,
  hasConcludedOneTime,
  categoryDisplayName,
} from "@/lib/programUtils";

export const metadata = publicPageMetadata("Programs and Events \u2014 Rooted In Mindfulness", "Meditation gatherings, classes, community groups, and retreats in Brookfield and on Zoom. Find current dates, locations, and registration details.", "/community-programs");

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

export default async function CommunityProgramsPage() {
  const [allPrograms, categories] = await Promise.all([
    db.program.findMany({
      where: {
        hideFromProgramPageList: false,
        archivedAt: null,
      },
      include: { category: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.programCategory.findMany({
      where: { hideFromProgramsPage: false },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // A concluded one-time program leaves the listing on its own the day after
  // its date, unless the editor opted out (hideWhenPast, default true).
  const todayYmd = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const isOneTime = (p: (typeof allPrograms)[number]) => !p.recurrenceFreq && !!p.startDatetime;
  const programs = allPrograms.filter((p) => !(p.hideWhenPast && hasConcludedOneTime(p)));

  return (
    <div className="pl-page">
      <HashTargetScroller />
      {/* ── Hero ─────────────────────────────────────────── */}
      <section
        className="pp-hero"
        style={{
          ["--pp-hero-image" as string]: "url('/images/Looking-Up-Pine-Trees-unsplash.jpg')",
          ["--pp-hero-position" as string]: "center 48%",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Practice in community</p>
          <h1 className="pp-hero__title">Programs and Events</h1>
          <p className="pp-hero__body">
            Sit together, study the teachings, and bring what you find into the rest of your life.
            Join us at the center or online, whether you are beginning or have practiced for years.
          </p>
          <p className="pp-hero__body">For a first visit, we recommend <Link href="/programs/meditation-and-dharma-talk">Meditation and Dharma Talk</Link>. See <Link href="/new-to-rim">New to RIM</Link> for arrival and access details.</p>
          <div className="pp-hero__actions">
            <Link href="/this-week" className="pp-hero__link pp-hero__link--utility">
              See what&rsquo;s happening this week <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Program Listings ─────────────────────────────── */}
      <section className="pl-catalog">
        <div className="rim-container">
          <div className="pp-prose">
            <h2>Choosing a gathering</h2>
            <p>Our gatherings explore CARE through meditation, study, and shared activity. You can begin with one gathering and find a rhythm that fits your life.</p>
            <ul>
              <li><strong>Guided practice:</strong> <Link href="/programs/meditation-and-dharma-talk">Meditation and Dharma Talk</Link> is our first-visit recommendation. The Art of Meditation offers instruction and questions; heart practices explore kindness and compassion.</li>
              <li><strong>Silent practice:</strong> Morning and evening sits offer brief opening guidance followed by unguided meditation.</li>
              <li><strong>Study:</strong> Essential Dharma Study explores Buddhist teachings through discussion and practice.</li>
              <li><strong>Community groups:</strong> Practice around a shared interest, such as nature, movement, or recovery. Each group describes its approach and expectations.</li>
              <li><strong>Retreats and events:</strong> Set aside more time for practice or gather for a community occasion. Check each offering’s location and registration details.</li>
            </ul>
            <p>Foundations of Mindful Living is a planned introduction to CARE. Dates and details will be listed here when scheduled; the gatherings below are available in the meantime.</p>
          </div>
          {categories.map((category) => {
            const categoryPrograms = programs.filter(
              (p) => p.category?.name === category.name
            );
            if (categoryPrograms.length === 0) return null;
            const categoryHeading = categoryDisplayName(category.name);

            return (
              // The id is the anchor the home page's category doors deep-link
              // to (/community-programs#<slug>).
              <div key={category.id} id={category.slug} className="pl-cat">
                <div className="pl-cat__header">
                  <h2 className="pl-cat__heading">{categoryHeading}</h2>
                </div>
                <div className="pl-grid">
                  {categoryPrograms.map((program) => {
                    const format = fmtLabel(program.programFormat);
                    const participation = participationLabel(program);

                    // One-time upcoming: keep the date prominent with the
                    // scheduling facts, but keep every program title on the
                    // same leading edge. A past-but-kept-listed program falls
                    // through to the plain card; a stale date isn't showcased.
                    if (isOneTime(program) && !hasConcludedOneTime(program)) {
                      const { lead, year } = datedEventLead(
                        program.startDatetime!,
                        program.endDatetime
                      );
                      const currentYear = Number(todayYmd.split("-")[0]);
                      // Prefer the coordinator's dateText (the same override
                      // order buildSubtitle uses); it's the cached computed
                      // label in practice, but an override must win here too.
                      const fullDate =
                        program.dateText ||
                        computeDateText(
                          program.startDatetime, null, null, null, program.endDatetime
                        );
                      const time =
                        program.timeText ||
                        computeTimeText(program.startDatetime, program.endDatetime);

                      return (
                        <Link
                          key={program.id}
                          href={`/programs/${program.slug}`}
                          className="pl-card pl-card--catalog pl-card--date"
                        >
                          <div className="pl-card__content">
                            <div className="pl-card__main">
                              <div className="pl-card__title-row">
                                <h3 className="pl-card__title">{program.name}</h3>
                              </div>
                              {program.tagline && (
                                <span className="pl-card__tagline">{program.tagline}</span>
                              )}
                              <ProgramCardNotices
                                announcement={program.specialAnnouncement}
                              />
                            </div>
                            <div className="pl-card__when">
                              <time
                                className="pl-card__date"
                                dateTime={program.startDatetime!.toISOString()}
                                aria-label={fullDate}
                              >
                                {lead}
                                {year !== currentYear && (
                                  <span className="pl-card__date-year">{year}</span>
                                )}
                              </time>
                              {time && <span className="pl-card__schedule">{time}</span>}
                              <span className="pl-card__format">{programLocationLabel(program)}</span>
                              <span className="pl-card__format">{participation}</span>
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
                              <h3 className="pl-card__title">{program.name}</h3>
                            </div>
                            {program.tagline && (
                              <span className="pl-card__tagline">{program.tagline}</span>
                            )}
                            <ProgramCardNotices
                              announcement={program.specialAnnouncement}
                            />
                          </div>
                          {/* What it is on the left, when and how on the right.
                              The card is 900px wide and the copy ran out around
                              560, leaving the arrow floating alone. */}
                          <div className="pl-card__when">
                            {schedule && <span className="pl-card__schedule">{schedule}</span>}
                            <span className="pl-card__format">{programLocationLabel(program)}</span>
                              <span className="pl-card__format">{participation}</span>
                          </div>
                          <span className="pl-card__action" aria-hidden="true">→</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <PracticeWithUs />
        </div>
      </section>
    </div>
  );
}
