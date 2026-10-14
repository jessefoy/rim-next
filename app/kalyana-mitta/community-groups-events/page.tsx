import Link from "next/link";
import { db } from "@/lib/db";
import { buildSubtitle, fmtLabel, hasConcludedOneTime } from "@/lib/programUtils";
import { whereOfferingCategory } from "@/lib/programOffering";
import { activeAnnouncement } from "@/lib/scheduleUtils";
import ProgramRow from "@/components/ProgramRow";

export const metadata = {
  title: "Community Groups and Activities - Rooted In Mindfulness",
  description:
    "Kalyana Mitta groups at RIM — connect with others to deepen your practice, share interests, and grow spiritual friendships.",
};

export const dynamic = "force-dynamic";

export default async function KalyanaGroupsPage() {
  // The live site lists its current KM groups by hand. These are real Programs
  // whose Category is Community Group, so read them rather than hardcode a list
  // that drifts the moment a group starts or ends.
  const allGroups = await db.program.findMany({
    where: {
      archivedAt: null,
      hideFromProgramPageList: false,
      // Category = Community Group (the program's own field; its old category
      // stands in while that is empty). It matched the old category by NAME.
      ...whereOfferingCategory("COMMUNITY_GROUP"),
    },
    include: { category: true },
    orderBy: { sortOrder: "asc" },
  });

  // Same rule as /community-programs: a concluded one-time event leaves the
  // public listings unless the editor opted out (hideWhenPast, default true).
  const groups = allGroups.filter((g) => !(g.hideWhenPast && hasConcludedOneTime(g)));

  return (
    <div className="pp-page pp-page--spine">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Kalyana Mitta</p>
          <h1 className="pp-hero__title">Community Groups and Activities</h1>
          <p className="pp-hero__body">
            Connect with others to deepen your learning, practice, shared interests, affinity
            connections, and engaged mindfulness, and to grow <em>spiritual friendships</em>.
            Following tradition, these community-led activities are called <em>Kalyana Mitta</em>.
          </p>
          <div className="pp-hero__actions">
            <a href="#current-groups" className="pp-btn">
              Current groups
            </a>
            <Link
              href="/kalyana-mitta/kalyana-mitta-group-application"
              className="pp-btn pp-btn--ghost"
            >
              Start a group or event
            </Link>
          </div>
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────── */}
      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-intro">
            <p className="pp-intro__eyebrow">What they are</p>
            <h2 className="pp-intro__title">
              About Kalyana Mitta groups and activities
            </h2>
          </div>
          <div className="pp-prose">
            <p>
              <strong>Kalyana Mitta (KM)</strong> is a Pali term that loosely means &ldquo;supportive
              friend.&rdquo; It refers to fellow travelers on the Dharma path who come together to
              support each other&rsquo;s learning, meditation, and mindful living practice.
            </p>
            <p>
              KM groups and events connect us. They provide opportunities to study the Dharma, share
              mindfulness and meditation experiences, and build meaningful friendships rooted in
              shared interests and common intentions.
            </p>
          </div>
        </div>
      </section>

      {/* ── Current groups ────────────────────────────────── */}
      <section id="current-groups" className="pp-section">
        <div className="rim-container">
          <div className="pp-intro">
            <p className="pp-intro__eyebrow">Join one</p>
            <h2 className="pp-intro__title">Looking for a community group or event?</h2>
            <p className="pp-intro__body">
              Explore the groups meeting at RIM right now. Each one is led by members of the
              community.
            </p>
          </div>

          {groups.length > 0 ? (
            // The same list and rows as Programs & Events (2026-10-14), so a
            // group reads the same wherever it is listed.
            <ul className="pl-list">
              {groups.map((group) => {
                const fullSubtitle = buildSubtitle(group);
                const where = fmtLabel(group.programFormat, group.outsideMeetingUrl);
                const schedule = fullSubtitle?.endsWith(` | ${where}`)
                  ? fullSubtitle.slice(0, -(` | ${where}`).length)
                  : fullSubtitle;
                const line = [schedule !== where ? schedule : null, where].filter(Boolean).join(" · ");
                return (
                  <ProgramRow
                    key={group.id}
                    href={`/programs/${group.slug}`}
                    title={group.name}
                    line={line}
                    tagline={group.tagline}
                    announcement={activeAnnouncement(group)}
                  />
                );
              })}
            </ul>
          ) : (
            <div className="pp-panel">
              <p className="pp-panel__body">
                There are no community groups listed at the moment. If you have an idea for one,
                we&rsquo;d love to hear it.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Start one: its own room on white, after the groups on Pampas. ── */}
      <section className="pp-section pp-section--white pp-section--last">
        <div className="rim-container">
          {/* Start a group and its guidelines belong together in the panel
              (the refresh), not as a lone centred link beneath it. */}
          <div className="pp-closing pp-closing--stack">
            <div>
              <p className="pp-closing__eyebrow">Start something</p>
              <h2 className="pp-closing__title">
                Don&rsquo;t see a group that fits?
              </h2>
              <p className="pp-closing__body">
                Any member of RIM can start a Kalyana Mitta group or community activity. Read the
                guidelines, then tell us about your idea. We&rsquo;ll help you get it going.
              </p>
            </div>
            <div className="pp-actions">
              <Link href="/kalyana-mitta/kalyana-mitta-group-application" className="pp-btn">
                Start a group
              </Link>
              <Link
                href="/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group"
                className="pp-btn pp-btn--ghost"
              >
                The group guidelines
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
