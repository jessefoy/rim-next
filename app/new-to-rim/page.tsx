import Link from "next/link";
import type { ReactNode } from "react";
import {
  RIM_ADDRESS,
  RIM_MAPS_URL,
  RIM_PHONE_DISPLAY,
  RIM_PHONE_TEL,
  RIM_SUPPORT_EMAIL,
} from "@/lib/locations";

export const metadata = {
  title: "New to RIM - Rooted In Mindfulness",
  description:
    "New to Rooted in Mindfulness in Brookfield, Wisconsin? Where to begin, what to expect in person and online, how signing up works, and answers to common questions. No experience needed. Come as you are.",
};

/**
 * /new-to-rim — the newcomer's front door (2026-09-25, revision 2), the way
 * most practice centers do it: one "New here?" page, linked first in the
 * navigation and from the home hero.
 *
 * Rebuilt on the reviewed design (the 2026-10-09 refresh, newcomer.css and
 * newcomer-main.html in the handoff): a compact photo hero, a welcome, two
 * entry choices (a drop-in or Foundations), the membership step, in-person
 * and online facts side by side, the community welcome, the six questions
 * and contact. The words are Jesse's wherever he had written them (the
 * three asks, the stairs, the volunteers' respect for privacy, the rooms
 * upstairs), inside the reference's structure; the reference's shorter lines
 * fill the rest. Provisional until his read-aloud. Parking and which door to
 * use are still unwritten (backlog 2026-08-10-002).
 *
 * Accuracy checks: online entry opens 10 minutes before start for members
 * (lib/sessionWindowConstants.ts MEMBER_JOIN_MIN) and lives on My Home;
 * registration-required online programs admit registrants only (RIM_Zoom.md).
 */
const QUESTIONS: { q: string; a: ReactNode }[] = [
  {
    q: "Do I need meditation experience?",
    a: "No. Every gathering is open to beginners, and the practice keeps deepening for people who have practiced for many years.",
  },
  {
    q: "What does it cost?",
    a: "Our teachings are offered freely, through dana, the practice of generosity. Programs list a suggested amount so you can see what an offering takes to sustain, and for most programs, no one is turned away for being unable to pay. A few offerings, such as overnight retreats, carry a minimum.",
  },
  {
    q: "Is this religious?",
    a: "Our practice comes from Buddhist meditation and is open to people of every faith and of none. It asks no belief. Its teachings are offered to be explored and tested in experience.",
  },
  {
    q: "What if difficult feelings come up?",
    a: "Meditation can bring up difficult feelings and memories. They are part of human experience, and they are met with care, at a workable pace, with a teacher available to talk with. Anyone receiving mental health care is encouraged to speak with their provider before beginning.",
  },
  {
    q: "Is this therapy?",
    a: "It is a practice of meditation and mindful living. It can support people through hard seasons, and it does not replace medical or mental health care.",
  },
  {
    q: "What can practice help with?",
    a: (
      <>
        People come for many reasons: to meet stress, pain, a hard season, or the weight of what
        is happening in the world; to enjoy life more; to be there for the people they love; to
        live by what matters; and, for some, to walk a path of awakening. There is room for all of these here, and{" "}
        <Link href="/why-we-practice">Why We Practice</Link> describes how practice helps.
      </>
    ),
  },
];

export default function NewToRimPage() {
  return (
    <div className="pp-page pp-page--spine nt-page">
      {/* The one photograph on the page, under a compact gradient. */}
      <section
        className="pp-hero nt-hero"
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

      {/* ── A place for you, and where to begin ── */}
      <section className="nt-section nt-start" aria-labelledby="welcome-title">
        <div className="rim-container">
          <div className="nt-split">
            <div>
              <p className="nt-eyebrow">A place for you</p>
              <h2 id="welcome-title">Come as you are.</h2>
            </div>
            <div className="nt-copy">
              <p>
                You do not need to know how to meditate, or anything about Buddhism, to begin here.
                People come for many reasons and at every stage of life, and all of them are
                welcome.
              </p>
            </div>
          </div>

          <div className="nt-start-heading">
            <h2 id="where-to-begin">Where to begin</h2>
            <p>Two welcoming ways to start, in person or online.</p>
          </div>
          <div className="nt-options">
            <div className="nt-option">
              <p className="nt-eyebrow">A first gathering</p>
              <h3>A drop-in gathering</h3>
              <p>
                A drop-in is a good place to start, in person or online. Each one is complete in
                itself, and no experience is needed. This week&rsquo;s schedule shows what is coming
                up.
              </p>
              <Link href="/this-week" className="pp-btn">
                This week&rsquo;s schedule <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="nt-option">
              <p className="nt-eyebrow">A fuller introduction</p>
              <h3>Foundations</h3>
              <p>
                For a fuller introduction, we encourage everyone to take Foundations, our
                introduction to Taking CARE, our way of practice, through guided meditation,
                teaching, reflection, and conversation. It is usually offered as a course or
                workshop, and our first offering begins in November.
              </p>
              <Link href="/foundations" className="nt-text-link">
                About Foundations <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <p className="nt-cost">
            <strong>A generosity-based community.</strong> Membership is freely offered. For most
            programs, no one is turned away for being unable to pay. Programs list suggested
            contributions to help sustain RIM.
          </p>
        </div>
      </section>

      {/* ── Signing up: the membership step, with the three asks (Jesse's) ── */}
      <section className="nt-section" aria-labelledby="signing-up">
        <div className="rim-container nt-ruled">
          <div className="nt-split">
            <div>
              <p className="nt-eyebrow">Before you join us</p>
              <h2 id="signing-up">
                A few minutes
                <br />
                to become a member.
              </h2>
            </div>
            <div className="nt-copy">
              <p>
                We ask everyone who practices with us to sign up as a member. Membership is freely
                offered, and it takes a few minutes. Signing up is where each of us agrees to our{" "}
                <Link href="/community-care-agreements">Community Care Agreements</Link>. For our
                online gatherings, signing up is required, for the safety and integrity of those
                gatherings, and we ask everyone who comes to the center to sign up as well.
              </p>
              <p>
                We ask the same of everyone who comes: to hold the agreements, a short shared
                vision and three agreements about caring for ourselves, one another, and RIM; to
                come with a sincere wish to practice; and to help keep RIM a safe place for
                everyone. The agreements are intentions we share, and holding them is a practice.
              </p>
              <Link href="/join" className="pp-btn pp-btn--ghost">
                Become a member <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Your first visit: in person and online, side by side ── */}
      <section className="nt-section" aria-labelledby="attending-title">
        <div className="rim-container nt-ruled">
          <div className="nt-section-heading">
            <p className="nt-eyebrow">Your first visit</p>
            <h2 id="attending-title">What to expect.</h2>
            <p>At the center or online, you are welcome to take part in your own way.</p>
          </div>
          <div className="nt-attendance">
            <article className="nt-visit" aria-labelledby="in-person">
              <h3 id="in-person">Coming in person</h3>
              <dl className="nt-facts">
                <div>
                  <dt>Find us</dt>
                  <dd>
                    <a href={RIM_MAPS_URL} target="_blank" rel="noopener noreferrer">
                      {RIM_ADDRESS} <span aria-hidden="true">↗</span>
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Building access</dt>
                  {/* Said plainly (Jesse, 2026-10-08): an older building, no
                      elevator; the welcome for those who cannot do stairs is
                      the note under these cards. */}
                  <dd>
                    Our rooms are on the top floor, reached by stairs. The building is an older
                    one and has no elevator.
                  </dd>
                </div>
                <div>
                  <dt>The rooms</dt>
                  <dd>
                    Upstairs there is a meditation room and a community room. Cushions and chairs
                    are available; sit however your body is comfortable.
                  </dd>
                </div>
                <div>
                  <dt>Arriving</dt>
                  <dd>
                    Volunteers will greet you, help with anything you need, and respect your
                    privacy. Nobody will ask you to speak or introduce yourself, and arriving late
                    is fine.
                  </dd>
                </div>
              </dl>
              <div className="nt-visit-note">
                <p>
                  You are welcome to come early, have a cup of tea in the community room, and
                  browse our library. We ask everyone to take off their shoes and leave them on or
                  under the shoe rack.
                </p>
                <p>
                  If you would like to offer a donation, there is a bowl beneath the Bodhi tree wood
                  carving.
                </p>
              </div>
            </article>

            <article className="nt-visit" aria-labelledby="online">
              <h3 id="online">Joining online</h3>
              <dl className="nt-facts">
                <div>
                  <dt>Where we meet</dt>
                  <dd>Zoom. Once you are signed in, your gathering&rsquo;s link appears on My Home.</dd>
                </div>
                <div>
                  <dt>Before joining</dt>
                  <dd>
                    Sign up as a member. Some programs also ask you to register first, and the
                    program&rsquo;s page will say so.
                  </dd>
                </div>
                <div>
                  <dt>When to arrive</dt>
                  <dd>
                    The room opens ten minutes before the start, and you are welcome to come in any
                    time after that.
                  </dd>
                </div>
                <div>
                  <dt>Your camera</dt>
                  <dd>Cameras are welcome and never required.</dd>
                </div>
              </dl>
              <Link href="/account/dashboard" className="nt-text-link nt-account-link">
                Open My Home <span aria-hidden="true">→</span>
              </Link>
              <p className="nt-link-note">Sign in to find your Zoom link.</p>
            </article>
          </div>
          <p className="nt-access-note">
            If stairs are not possible for you, you are warmly welcome at our online gatherings,
            which are a full way to practice with us. Some of our gatherings, including days of
            mindfulness and retreats, take place in other settings; the schedule and our newsletter
            say where.
          </p>
        </div>
      </section>

      {/* ── Practicing together ── */}
      <section className="nt-section" aria-labelledby="community">
        <div className="rim-container nt-ruled nt-split">
          <div>
            <p className="nt-eyebrow">Practicing together</p>
            <h2 id="community">
              There is room
              <br />
              for your way of being.
            </h2>
          </div>
          <div className="nt-copy">
            <p>
              RIM is a community for learning and practice, and each of us takes part in our own
              way. Some of us share readily and some prefer to sit and listen, and both help make
              the community a healthy place to learn and practice. People from every walk of life
              practice here, and our differences make us stronger.
            </p>
            <p>
              If what brings you is a hard season, you are in good company; many of us arrived the
              same way. No explanation is owed, and none will be asked for.
            </p>
            <Link href="/diversity" className="nt-text-link">
              Diverse Together <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Questions ── */}
      <section className="nt-section" aria-labelledby="questions">
        <div className="rim-container nt-ruled nt-split">
          <div>
            <p className="nt-eyebrow">A little more reassurance</p>
            <h2 id="questions">
              Questions
              <br />
              you might have.
            </h2>
          </div>
          <div className="nt-faq">
            {QUESTIONS.map((item) => (
              <details key={item.q} className="pp-details">
                <summary className="pp-details__summary">{item.q}</summary>
                <div className="pp-details__body">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section className="nt-section nt-contact" aria-labelledby="contact">
        <div className="rim-container nt-ruled nt-split">
          <div>
            <p className="nt-eyebrow">We are here to help</p>
            <h2 id="contact">
              Still wondering
              <br />
              about something?
            </h2>
          </div>
          <div className="nt-copy">
            <p>
              You are always welcome to ask anyone at the center. You can also get in touch before
              your visit.
            </p>
            <div className="nt-contact-links">
              <a href={`mailto:${RIM_SUPPORT_EMAIL}?subject=New%20to%20RIM`}>{RIM_SUPPORT_EMAIL}</a>
              <a href={`tel:${RIM_PHONE_TEL}`}>{RIM_PHONE_DISPLAY}</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
