import Link from "next/link";

export const metadata = {
  title: "Outreach — Rooted In Mindfulness",
  description:
    "Taking CARE for organizations: Rooted in Mindfulness brings its program of meditation and mindful living to nonprofits and community organizations that serve people in need. Secular in the Dalai Lama's sense, voluntary, and trauma-sensitive.",
};

/**
 * /outreach — the practice at the third ring: organizations that serve people
 * in need, and the people who care for them (2026-09-25).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * Provisional until Jesse's read-aloud.
 *
 * This is the other face of the "two faces, one truth" ruling (master
 * reference, Section 29): RIM's own pages say plainly that RIM is a dharma
 * community; here Taking CARE is presented as a mindfulness-based program,
 * secular in the Dalai Lama's sense and rooted in tradition, bringing no
 * religion into a host organization. The reader is an organization's
 * director, whose worry is exactly that, so it is answered in the second
 * paragraph. Principles from the master reference, Section 27: voluntary,
 * partnership not delivery, trauma-sensitive, honest about scope.
 *
 * Inquiries go to support@ by Jesse's instruction. [Verify] "RIM's outreach
 * fund": confirm it exists before the read-aloud ratifies this page.
 */
export default function OutreachPage() {
  return (
    <div className="pp-page pp-page--spine">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">For organizations</p>
          <h1 className="pp-hero__title">Outreach</h1>
          <p className="pp-hero__body">
            Bringing our practice to organizations that care for people in need.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <p>
              Care that stops at our own door is not finished. We are beginning to offer Taking
              CARE, our program of meditation and mindful living, to nonprofits and community
              organizations that serve people in need: people in recovery, people facing illness,
              grief, poverty, or isolation, young people, and the staff and volunteers who care for
              them.
            </p>
            <p>
              Taking CARE is a mindfulness-based program, secular in the sense the Dalai Lama gives
              the word: respectful of every religious tradition and of those with no faith, and
              grounded in common human experience. It is also rooted in tradition. Its practices
              come from Buddhist meditation, above all silent illumination, and the program grew
              from years of teaching Mindfulness-Based Stress Reduction. It asks no belief, and it
              brings no religion into a host organization.
            </p>
            <p>
              We work in partnership. Your organization knows its people, so the program is shaped
              with you rather than delivered to you. Format, length, language, and examples adapt,
              and the heart of the practice stays whole. Participation is always voluntary. The
              practice is trauma-sensitive, offered at a workable pace with a choice in every
              invitation, and it supports people through hard seasons without replacing medical or
              mental health care.
            </p>
            <p>
              The people who care for others matter here as much as the people they serve. Caring
              for others in a way that can last is part of what the practice teaches.
            </p>
            <p>
              This work is new for us. It grows as we train facilitators who live the practice as
              well as teach it, and each program is funded by the host organization or through
              RIM&rsquo;s outreach fund.
            </p>
            <p>
              If your organization might be a fit, we would be glad to hear from you at{" "}
              <a href="mailto:support@rootedinmindfulness.org?subject=Outreach">
                support@rootedinmindfulness.org
              </a>
              .
            </p>
          </div>

          <div className="pp-actions">
            <a href="mailto:support@rootedinmindfulness.org?subject=Outreach" className="pp-btn">
              Outreach inquiries
            </a>
            <Link href="/why-we-practice" className="pp-link">
              Why we practice <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
