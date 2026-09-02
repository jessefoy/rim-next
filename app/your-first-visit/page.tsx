import Link from "next/link";
import { RIM_ADDRESS, RIM_MAPS_URL } from "@/lib/locations";

export const metadata = {
  title: "Your First Visit — Rooted In Mindfulness",
  description:
    "What to expect the first time you come to Rooted in Mindfulness in Brookfield, Wisconsin. Drop-in meditation sessions, no registration and no experience needed. Come as you are.",
};

/**
 * /your-first-visit — the page for the person who has decided to come and does
 * not know what walking in is like. Per RIM_Web_Design_Philosophy.md, this is
 * the page that serves someone arriving in a hard season, so it removes
 * surprises rather than selling anything.
 *
 * ── PROVISIONAL COPY ────────────────────────────────────────────────────────
 * Two passages below are placeholders awaiting Jesse's own words, marked
 * inline. They are written to assert nothing unverifiable about the building:
 * they point a visitor at a person to ask rather than invent a door, a lot, or
 * a shoe rule. Replace with the real logistics.
 * Tracked in UP_NEXT.md and backlog 2026-08-10-002.
 * ───────────────────────────────────────────────────────────────────────────
 */
export default function YourFirstVisitPage() {
  return (
    <div className="pp-page pp-page--spine">
      <section
        className="pp-hero"
        style={{
          ["--pp-hero-image" as string]: "url('/images/Community-Hands-on-Tree.jpg')",
          ["--pp-hero-position" as string]: "center 42%",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Coming for the first time</p>
          <h1 className="pp-hero__title">Your First Visit</h1>
          <p className="pp-hero__body">
            Everyone here remembers their own first time walking in. Here is what to expect, so
            nothing has to be a surprise.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <p>
              You can come to any session marked drop-in, this week, without registering and without
              any experience. Arrive a few minutes early if you can. Chairs and cushions are both
              available; sit however your body is comfortable. Nobody will ask you to speak, share,
              or introduce yourself, and sitting near the back and just listening is a complete way
              to attend. If you arrive late, come in anyway.
            </p>

            {/* PROVISIONAL — awaiting Jesse's parking and entrance details. */}
            <p>
              We are at{" "}
              <a href={RIM_MAPS_URL} target="_blank" rel="noopener noreferrer">
                {RIM_ADDRESS}
              </a>
              . If you are not sure where to go once you have parked, head for the main entrance and
              ask anyone you see. All of us were new here once, and someone will walk you in.
            </p>

            {/* PROVISIONAL — awaiting Jesse's practical details (shoes, tea, restrooms). */}
            <p>
              Wear whatever is comfortable. Small practical questions come up on a first visit,
              about shoes at the door or where to find the restrooms, and you can ask anyone when
              you arrive or{" "}
              <a href="mailto:support@rootedinmindfulness.org?subject=Coming%20for%20the%20first%20time">
                email us
              </a>{" "}
              before you come. If you are joining online, the link lives on the This Week page, and
              cameras are welcome but never required.
            </p>

            <p>
              And if what brings you here is a hard season, you are in good company; many of us
              arrived the same way. No explanation is owed, and none will be asked for. Come as you
              are, and let that be enough.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/this-week" className="pp-btn">
              See what&rsquo;s happening this week
            </Link>
            <Link href="/what-we-practice" className="pp-link">
              What we practice <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
