import { publicPageMetadata } from "@/lib/publicMetadata";
import Link from "next/link";

export const metadata = publicPageMetadata("Outreach — Rooted In Mindfulness", "Taking CARE for organizations: guided meditation and mindful living for the people you serve and those who carry your work. Explore a partnership with RIM.", "/outreach");

/**
 * /outreach — partnership with organizations working for the well-being of
 * individuals, communities, and our shared world, supporting both the people
 * they serve and the people within them who carry the work (2026-09-25;
 * rewritten into headed sections 2026-09-26 from the site revision brief).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * Provisional until Jesse's read-aloud.
 *
 * Jesse's direction (2026-09-25): the page names no populations or
 * conditions; it says what the partnership is. This is the other face of the
 * "two faces, one truth" ruling (master reference, Section 29): RIM's own
 * pages say plainly that RIM is a dharma community; here Taking CARE is
 * presented as secular in the Dalai Lama's sense and rooted in tradition,
 * bringing practice, not religion, into a host organization.
 *
 * Inquiries go to support@ by Jesse's instruction. Cost (Jesse, 2026-09-26):
 * organizations give by donation, as everyone at RIM does, and the outreach
 * fund supports each program. RIM has offered programs with organizations
 * before, so the page does not call the work new.
 */
export default function OutreachPage() {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">For organizations</p>
          <h1 className="pp-hero__title">Outreach</h1>
          <p className="pp-hero__body">Taking CARE for organizations that care for others.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <p>
              We partner with nonprofits and community organizations whose work supports the
              well-being of individuals, communities, and our shared world. Taking CARE, our program
              of meditation and mindful living, shares the same CARE approach we practice in our
              community. It can support the people these organizations serve,
              and the people within them who carry that work every day. RIM has offered programs
              with organizations before, and Taking CARE now carries that work forward.
            </p>

            <h2>Who we partner with</h2>
            <p>
              Organizations working for well-being, in whatever form their work takes. If your
              mission is to help people, communities, or the world we share to be healthier and more
              whole, we would be glad to talk.
            </p>

            <h2>Who it supports</h2>
            <p>
              The people your organization serves, and your own people: the staff, volunteers, and
              leaders who carry your mission. Caring for others is demanding work. The practice helps
              people meet it with clarity and steadiness, and in a way that can last.
            </p>

            <h2>What participants practice</h2>
            <p>
              Taking CARE teaches a few simple, connected skills through guided practice and
              conversation, so they can be used in the middle of real life: settling the body and
              mind under pressure; noticing an old reaction while it is happening, with curiosity
              instead of blame; remembering what matters and responding with care; and looking after
              ourselves while we look after others.
            </p>

            <h2>How a partnership works</h2>
            <p>
              We begin with a conversation about your organization, your mission, and what you hope
              for. We shape the program with you: format, length, language, and examples adapt, and
              CARE remains the shared foundation: learning to meet experience with awareness and
              care, and to bring that understanding into how we act with others. Facilitators who live the practice as well as
              teach it lead the sessions, in person or online. Afterward we look back together at
              what served people, and plan what comes next.
            </p>

            <h2>Our commitments</h2>
            <p>
              <strong>Always voluntary.</strong> Each person chooses whether and how to take part.
            </p>
            <p>
              <strong>Open to everyone.</strong> Taking CARE is rooted in Buddhist meditation and
              taught through shared human experience. People of every faith and of none can take
              part without adopting religious beliefs.
            </p>
            <p>
              <strong>Held with care.</strong> Practice is offered at a workable pace, with a choice
              in every invitation, and with trauma-sensitive adaptations we develop with each
              partner.
            </p>
            <p>
              <strong>Alongside, never instead of.</strong> The program supports people through hard
              seasons and works alongside medical and mental health care, never in place of it.
            </p>

            <h2>Training in Taking CARE</h2>
            <p>
              If you are interested in learning to share Taking CARE in your organization or
              alongside RIM, contact us to discuss current possibilities at{" "}
              <a href="mailto:support@rootedinmindfulness.org?subject=Taking%20CARE%20training">
                support@rootedinmindfulness.org
              </a>
              .
            </p>

            <h2>Cost</h2>
            <p>
              We ask partner organizations to give by donation, in the same way everyone at RIM
              does, and our outreach fund supports each program as well. Include your budget and
              any financial constraints in the first conversation so we can discuss what is possible.
            </p>

            <h2>Start a conversation</h2>
            <p>
              If your organization might be a fit, we would be glad to hear from you. Tell us a
              little about your organization, your mission, and the people you hope this could
              support. If you have a timeframe or a preference for meeting in person or online,
              include that too. We can discuss the teaching, practical arrangements, and donation
              together before a program is agreed.
            </p>
          </div>

          <div className="pp-actions">
            <a href="mailto:support@rootedinmindfulness.org?subject=Outreach" className="pp-btn">
              Email us about outreach
            </a>
            <Link href="/why-we-practice" className="pp-btn pp-btn--ghost">
              Why we practice
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
