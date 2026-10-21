import Link from "next/link";
import { START_HERE, TEAM_PATHS, findTutorial } from "@/components/tutorials";

/**
 * /tutorials (2026-10-21, Jesse: "this page should be organized in a
 * well-thought-out way, remembering that these people are not very
 * tech-savvy"). One path: Start here, for everyone, in order; then Find your
 * team, each team's own tutorials in order. Open to everyone and not
 * indexed; no menu, footer or sitemap link, since Jesse shares tutorials by
 * link. See components/tutorials.
 */
export const metadata = {
  title: "Tutorials - Rooted In Mindfulness",
  description: "Step-by-step help with the RIM website, one screen at a time.",
  robots: { index: false, follow: false },
};

export default function TutorialsPage() {
  const startHere = START_HERE.map((slug) => findTutorial(slug)).filter((t) => t !== undefined);
  return (
    <div className="pp-page pp-page--spine">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Help with the website</p>
          <h1 className="pp-hero__title">Tutorials</h1>
          <p className="pp-hero__body">
            Short guides with pictures, one step at a time. Everyone begins with Start here. Then find your team for the ones that are yours.
          </p>
        </div>
      </section>

      <section className="pp-section" aria-labelledby="start-here">
        <div className="rim-container tut-index">
          <div className="tut-index__head">
            <h2 id="start-here">Start here</h2>
            <p>For everyone, in this order.</p>
          </div>
          <ol className="tut-path">
            {startHere.map((t, i) => (
              <li key={t.slug}>
                <Link href={`/tutorials/${t.slug}`} className="tut-path__card">
                  <span className="tut-path__num" aria-hidden="true">{i + 1}</span>
                  <span className="tut-path__text">
                    <span className="tut-path__title">{t.title}</span>
                    <span className="tut-path__summary">{t.summary}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pp-section pp-section--white pp-section--last" aria-labelledby="find-your-team" id="find-your-team">
        <div className="rim-container tut-index">
          <div className="tut-index__head">
            <h2 id="find-your-team">Find your team</h2>
            <p>After Start here, choose the team you&rsquo;re on. Its tutorials are listed in order.</p>
          </div>
          <div className="tut-teams">
            {TEAM_PATHS.map((team) => (
              <section key={team.slug} id={`team-${team.slug}`} className="tut-team" aria-labelledby={`team-${team.slug}-name`}>
                <h3 id={`team-${team.slug}-name`}>{team.name}</h3>
                <p className="tut-team__line">{team.line}</p>
                <ol className="tut-team__list">
                  {team.tutorials.map((slug) => {
                    const t = findTutorial(slug);
                    if (!t) return null;
                    return (
                      <li key={slug}>
                        <Link href={`/tutorials/${slug}`}>{t.title} →</Link>
                      </li>
                    );
                  })}
                </ol>
                {team.leads.length > 0 && (
                  <>
                    <p className="tut-team__leads">If you lead this team</p>
                    <ul className="tut-team__list tut-team__list--leads">
                      {team.leads.map((slug) => {
                        const t = findTutorial(slug);
                        if (!t) return null;
                        return (
                          <li key={slug}>
                            <Link href={`/tutorials/${slug}`}>{t.title} →</Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
