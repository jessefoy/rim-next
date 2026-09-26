import GuidedPractice from "@/components/GuidedPractice";
import Link from "next/link";
import { RIM_ADDRESS, RIM_MAPS_URL } from "@/lib/locations";

export const metadata = {
  title: "New to RIM — Rooted In Mindfulness",
  description:
    "New to Rooted in Mindfulness in Brookfield, Wisconsin? Where to begin, what to expect in person and online, how signing up works, and answers to common questions. No experience needed. Come as you are.",
};

/**
 * /new-to-rim — the newcomer's front door (2026-09-25, revision 2), the way
 * most practice centers do it: one "New here?" page, linked first in the
 * navigation and from the home hero. It absorbs the former /your-first-visit
 * (which redirects here) and the questions from the retired /foundations page.
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * The in-person details are Jesse's own (top floor, the two rooms, tea and the
 * library, shoes on the rack, the donation bowl under the Bodhi tree carving,
 * volunteers who help and respect privacy). Parking and which door to use are
 * not yet written; they are left out rather than guessed. Provisional until
 * Jesse's read-aloud.
 *
 * Community is named directly here, at Jesse's direction: people want
 * community and fear it at the same time, so the page says what kind this is
 * before anything is asked. The one ask is the care agreements.
 *
 * Accuracy checks: online entry opens 10 minutes before start for members
 * (lib/sessionWindowConstants.ts MEMBER_JOIN_MIN) and lives on My Home;
 * registration-required online programs admit registrants only (RIM_Zoom.md).
 */
const QUESTIONS = [
  {
    q: "Do I need meditation experience?",
    a: "No experience is needed for our guided drop-in gatherings. Other offerings may involve longer periods of silence or a course of study; their program pages describe what to expect.",
  },
  {
    q: "Is this religious?",
    a: "Our practice comes from Buddhist meditation and is open to people of every faith and of none. It asks no belief. Its teachings are offered to be explored and tested in experience.",
  },
  {
    q: "Is this therapy?",
    a: "It is a practice of meditation and mindful living. It can support people through hard seasons, and it does not replace medical or mental health care.",
  },
  {
    q: "What if difficult feelings come up?",
    a: "You can pause, open your eyes, or step out when you need to. Contact us before a gathering if you would like to discuss support. Meditation is not a substitute for medical or mental health care.",
  },
  {
    q: "What does it cost?",
    a: "Membership has no dues. Our teachings are supported through dana, the practice of generosity. Program pages distinguish voluntary donations from any required amount. If a required amount is a barrier, contact us before registering to discuss what may be possible.",
  },
] as const;

export default function NewToRimPage() {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section
        className="pp-hero"
        style={{
          ["--pp-hero-image" as string]: "url('/images/Community-Hands-on-Tree.jpg')",
          ["--pp-hero-position" as string]: "center 42%",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Welcome</p>
          <h1 className="pp-hero__title">New to RIM</h1>
          <p className="pp-hero__body">
            Where to begin, what to expect, and how to take part, in person or online.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <p>
              You do not need to know how to meditate, or anything about Buddhism, to begin here.
              People come for many reasons and at every stage of life, and all of them are welcome.
              If what brings you is a hard season, you are in good company; many of us arrived the
              same way. No explanation is owed, and none will be asked for.
            </p>

            <h2 id="where-to-begin">Where to begin</h2>
            <p>
              We recommend Meditation and Dharma Talk for your first visit. It combines guided
              practice with a teaching, in person or on Zoom. You can try one gathering without
              committing to a series.
            </p>
            <GuidedPractice />
            <p>
              Foundations is a planned introduction to CARE through guided meditation, teaching,
              reflection, and conversation. Dates and registration will appear in our{" "}
              <Link href="/community-programs">programs</Link> when scheduled. You can begin with
              a weekly gathering now.
            </p>

            <h2 id="community">Practicing together</h2>
            <p>
              RIM is a community for learning and practice. Membership is freely offered, and nobody
              keeps track of how often you come. You are welcome to practice in whatever way feels
              comfortable: listening in the peace and safety of a supportive space, and taking a
              more active part whenever it feels right. Some of us are more reserved and some share
              more readily. Both help create a healthy container for learning and practice, and
              everyone who comes with a sincere wish to practice, for their own benefit and for one
              another&rsquo;s, is contributing to it. That is what community means here: learning
              and practicing with like-minded people, each in our own way.
            </p>
            <p>
              We ask one thing of everyone while they are with us: to hold our{" "}
              <Link href="/community-care-agreements">Community Care Agreements</Link>, a short
              shared vision and three agreements about caring for ourselves, one another, and RIM.
              They are directions to hold, not requirements to be graded on.
            </p>

            <h2 id="signing-up">Signing up</h2>
            <p>
              <strong>For an in-person drop-in, you can arrive without registering.</strong>{" "}
              Creating a <Link href="/join">member account</Link> is encouraged. There are no dues
              or attendance requirements, and you do not need to identify as Buddhist.
            </p>
            <p>
              <strong>For Zoom, create an account and sign in.</strong> Your My Home page holds the
              session links. An account is separate from program registration: when a program
              requires registration, use its Register link as well.
            </p>

            <h2 id="in-person">Coming in person</h2>
            <p>
              We are on the top floor of the building at{" "}
              <a href={RIM_MAPS_URL} target="_blank" rel="noopener noreferrer">
                {RIM_ADDRESS}
              </a>
              . Upstairs there is a meditation room and a community room. You are welcome to sit in
              the community room with a cup of tea and browse our library, and if you arrive early,
              to find a cushion or a chair in the meditation room. Sit however your body is
              comfortable.
            </p>
            <p>
              We ask everyone to take off their shoes and leave them on or under the shoe rack. If
              you would like to offer a donation, there is a bowl beneath the Bodhi tree wood
              carving.
            </p>
            <p>
              Volunteers can help you find the rooms and answer questions. Arriving a little early
              leaves time to settle in. Check the program page for arrival instructions and any
              conversation or sharing that is part of the gathering.
            </p>

            <p>
              The main entrance is on the south side of the building. You may park in any of the
              parking lots around it. The center is reached by stairs; there is no elevator.
              Restrooms are in our main hall and elsewhere in the building.
            </p>
            <p>
              To discuss access needs before visiting, email{" "}
              <a href="mailto:support@rootedinmindfulness.org?subject=Planning%20a%20visit">support@rootedinmindfulness.org</a>{" "}
              or call <a href="tel:4148828932">(414) 882-8932</a>. The phone takes messages;
              volunteers return calls. You can also take part in our online gatherings.
            </p>

            <h2 id="online">Joining online</h2>
            <p>
              Online gatherings meet on Zoom. Once you are signed in, the link appears on your My
              Home page. The room opens ten minutes before the start, and you are welcome to come in
              any time after that. Some online programs ask you to register first, and the
              program&rsquo;s page will say so. Cameras are welcome and never required.
            </p>

            <h2 id="questions">Questions</h2>
            {QUESTIONS.map((item) => (
              <details key={item.q} className="pp-details">
                <summary className="pp-details__summary">{item.q}</summary>
                <div className="pp-details__body">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}

            <h2 id="contact">Still wondering about something?</h2>
            <p>
              You are always welcome to ask anyone at the center. You can also email us at{" "}
              <a href="mailto:support@rootedinmindfulness.org?subject=New%20to%20RIM">
                support@rootedinmindfulness.org
              </a>{" "}
              or call <a href="tel:4148828932">(414) 882-8932</a>.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/this-week" className="pp-btn">
              This week&rsquo;s schedule
            </Link>
            <Link href="/join" className="pp-btn pp-btn--ghost">
              Become a member
            </Link>
            <Link href="/community-programs" className="pp-btn pp-btn--ghost">
              Programs &amp; events
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
