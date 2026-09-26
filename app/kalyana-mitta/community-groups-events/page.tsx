import Link from "next/link";
import { db } from "@/lib/db";
import { buildSubtitle, fmtLabel, hasConcludedOneTime } from "@/lib/programUtils";

export const metadata = {
  title: "Community Groups and Activities — Rooted In Mindfulness",
  description:
    "Community groups at RIM: practice meditation, explore shared interests, and support one another. Find a current group or propose an idea.",
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
      category: { kind: "COMMUNITY_GROUP", hideFromProgramsPage: false },
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
      <section
        className="pp-hero"
        style={{
          ["--pp-hero-image" as string]: "url('/images/Community-Hands-on-Tree.jpg')",
          ["--pp-hero-position" as string]: "center 45%",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Practice with others</p>
          <h1 className="pp-hero__title">Community Groups and Activities</h1>
          <p className="pp-hero__body">
            Community groups bring people together around meditation, study, service, and shared
            interests. We support one another in practicing care in daily life. In the Buddhist
            tradition, this friendship is called <em>Kalyana Mitta</em>, or supportive friendship.
          </p>
          <div className="pp-hero__actions">
            <a href="#current-groups" className="pp-btn pp-btn--onblue">
              Find a group
            </a>
            <Link
              href="/kalyana-mitta/kalyana-mitta-group-application"
              className="pp-hero__link"
            >
              Propose a group or event <span aria-hidden="true">→</span>
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
              About community groups and activities
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
                Any member can propose a community group or activity. Read the guidelines, then
                share your idea. The community coordinator reviews proposals with you before
                further planning.
              </p>
            </div>
            <Link
              href="/kalyana-mitta/kalyana-mitta-group-application"
              className="pp-btn pp-closing__link"
            >
              Propose a group
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
