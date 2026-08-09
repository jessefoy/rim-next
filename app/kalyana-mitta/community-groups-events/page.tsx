import Link from "next/link";
import { db } from "@/lib/db";
import { buildSubtitle, fmtLabel, hasConcludedOneTime } from "@/lib/programUtils";

export const metadata = {
  title: "Community Groups and Activities — Rooted In Mindfulness",
  description:
    "Kalyana Mitta groups at RIM — connect with others to deepen your practice, share interests, and grow spiritual friendships.",
};

export const dynamic = "force-dynamic";

export default async function KalyanaGroupsPage() {
  // The live site lists its current KM groups by hand. These are real Programs
  // in the Community Groups category, so read them rather than hardcode a list
  // that drifts the moment a group starts or ends.
  const allGroups = await db.program.findMany({
    where: {
      archivedAt: null,
      hideFromProgramPageList: false,
      category: { name: "Community Groups" },
    },
    include: { category: true },
    orderBy: { sortOrder: "asc" },
  });

  // Same rule as /community-programs: a concluded one-time event leaves the
  // public listings unless the editor opted out (hideWhenPast, default true).
  const groups = allGroups.filter((g) => !(g.hideWhenPast && hasConcludedOneTime(g)));

  return (
    <div className="pp-page">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section
        className="pp-hero"
        style={{
          ["--pp-hero-image" as string]: "url('/images/Community-Hands-on-Tree.jpg')",
          ["--pp-hero-position" as string]: "center 45%",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Kalyana Mitta</p>
          <h1 className="pp-hero__title">Community Groups and Activities</h1>
          <p className="pp-hero__body">
            Connect with others to deepen your learning, practice, shared interests, affinity
            connections, and engaged mindfulness — and to grow <em>spiritual friendships</em>.
            Following tradition, these community-led activities are called <em>Kalyana Mitta</em>.
          </p>
          <div className="pp-hero__actions">
            <a href="#current-groups" className="pp-btn pp-btn--onblue">
              Find a group
            </a>
            <Link
              href="/kalyana-mitta/kalyana-mitta-group-application"
              className="pp-hero__link"
            >
              Start a group or event <span aria-hidden="true">→</span>
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
            <div className="pp-cards">
              {groups.map((group) => {
                const fullSubtitle = buildSubtitle(group);
                const format = fmtLabel(group.programFormat);
                const schedule = fullSubtitle?.endsWith(` | ${format}`)
                  ? fullSubtitle.slice(0, -(` | ${format}`).length)
                  : fullSubtitle;

                return (
                  <Link
                    key={group.id}
                    href={`/programs/${group.slug}`}
                    className="pp-card pp-card--row"
                  >
                    <div className="pp-card__row">
                      <div className="pp-card__main">
                        <h3 className="pp-card__title">{group.name}</h3>
                        {group.tagline && (
                          <p className="pp-card__body">{group.tagline}</p>
                        )}
                        <div className="pp-card__meta">
                          {schedule && <span className="pp-card__schedule">{schedule}</span>}
                          <span className="pp-card__format">{format}</span>
                        </div>
                      </div>
                      <span className="pp-card__action" aria-hidden="true">
                        →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
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

      {/* ── Start one ─────────────────────────────────────── */}
      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-closing">
            <div>
              <p className="pp-closing__eyebrow">Start something</p>
              <h2 className="pp-closing__title">
                Don&rsquo;t see a group that fits?
              </h2>
              <p className="pp-closing__body">
                Any member of RIM can start a Kalyana Mitta group or community activity. Read the
                guidelines, then tell us about your idea — we&rsquo;ll help you get it going.
              </p>
            </div>
            <Link
              href="/kalyana-mitta/kalyana-mitta-group-application"
              className="pp-btn pp-closing__link"
            >
              Start a group
            </Link>
          </div>

          <div className="pp-actions pp-actions--center">
            <Link
              href="/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group"
              className="pp-link"
            >
              Read the group guidelines <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
