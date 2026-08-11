import Link from "next/link";

export const metadata = {
  title: "A Handful of Leaves — Rooted In Mindfulness",
  description:
    "What and how we practice at Rooted in Mindfulness. Buddhist wisdom gathered from across the traditions and ordered by function, so a community can practice it together. Insight meditation and mindfulness practice in Brookfield, Wisconsin.",
};

/**
 * /what-we-practice — the page that answers what RIM is.
 *
 * Title hierarchy mirrors the community introduction ("A Handful of Leaves: An
 * Introduction" / "What We Practice at Rooted In Mindfulness"), which is the
 * document every new participant receives. Nav label stays short ("Our
 * Practice") because the bar has ~156px of slack at 1024px.
 *
 * The load-bearing correction (session 174): the handful is an ORDERED
 * structure, organized by function into seven gatherings, and it exists as a
 * response to having every tradition available at once — not an eclectic
 * gathering from everywhere. "Why a handful" and "How it is ordered" carry
 * that; without them the page reads as picking and choosing, which is the one
 * thing RIM is not.
 *
 * Reader note: this page deliberately does NO shame-disarming. The
 * introduction's reader has already walked in and is looking at their own mind
 * under instruction; this reader has not, and reassuring the unafraid reads as
 * condescension.
 *
 * Image discipline: the introduction is rich with images (the pond and mud, the
 * sun and frost, the house and guests, the gardener and the rose, the medicine
 * cabinet). This page carries exactly one — the hall and the orchestra —
 * because it is the image that does the anti-eclecticism work.
 */
export default function WhatWePracticePage() {
  return (
    <div className="pp-page">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">What and how we practice</p>
          <h1 className="pp-hero__title">A Handful of Leaves</h1>
          <p className="pp-hero__body">
            What we practice, how it is ordered, and why it has that name.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose pp-prose--spine">
            <h2>The story of the name</h2>
            <p>
              One afternoon, some twenty-five centuries ago, the Buddha was walking with a group of
              his students through a grove of trees in northern India. He bent down, gathered a few
              fallen leaves into his hand, and asked them a question. Which are more numerous, the
              leaves in my hand, or the leaves in the forest above us?
            </p>
            <p>
              The answer was obvious, and so was the point. He told them: what I have come to
              understand is vast, like the forest. What I teach is like this handful. Only what
              helps. Only what leads onward: to peace, to clear seeing, to the easing of unnecessary
              suffering, and to lives of wisdom and compassion that benefit ourselves, the people we
              love, and the world we all share.
            </p>
            <p>
              Our way of practice takes its name from that afternoon, and its promise from it too.
              What we practice together is a handful, not a forest, and it was gathered with one
              question in mind: does this help a person suffer less, see more clearly, and love more
              capably? Everything in it is there because, for many people across many centuries, the
              answer has been yes.
            </p>

            <h2>Why a handful</h2>
            <p>
              Every teaching of every Buddhist tradition, and many traditions beyond, is available to
              us at once. A retreat in one lineage, a book from another, a podcast from a third, an
              app teaching something adapted from all of them. That is a real gift. It is also, much
              of the time, overwhelming. We can have all the information we could ever need and still
              not have what we need. Exposure everywhere, orientation nowhere.
            </p>
            <p>
              The traditions did nothing wrong. Each of the great lineages is complete in itself: a
              whole path, with real depth, able to carry a person all the way. But few of us can live
              inside a single tradition the way earlier generations did, with a lifetime of
              immersion. We meet the traditions broadly rather than deeply, a course here and a book
              there, and breadth without roots leaves even sincere practitioners scattered, holding
              valuable pieces with no way to put them together.
            </p>
            <p>
              A Handful of Leaves exists for this. It replaces nothing and ranks nothing.
            </p>

            <h2>How it is ordered</h2>
            <p>
              What makes this a practice and not a collection is the ordering. The elements are
              organized by function: not by school or country, but by what a teaching is for in a
              life of practice. There are seven gatherings, and they are best met not as a list but
              as the arc of such a life: why we begin, what holds us, what we meet in the mind, where
              we look, how we look, and what is finally seen.
            </p>
            <p>
              Every one of them is available in your first week. None of them is ever finished.
            </p>

            <h2>One practice, many doors</h2>
            <p>
              A fair question arises once you see how much the handful holds. Loving-kindness comes
              from one lineage, breath awareness from another, contemplation of change from a third.
              Have we gathered many practices, all competing for the same cushion?
            </p>
            <p>
              No, and the reason fits in one image. The open, settled, softly luminous awareness
              underneath everything we do is not an instrument in the orchestra. It is the hall the
              music is played in. Nothing in the handful competes with it. Nothing in the handful is
              on its level.
            </p>
            <p>
              So our sitting has two modes, and we live in both. There is the open sitting: settling
              into what is already here, adding nothing, leaving nothing out. And there are the
              particular practices, the many doors, taken up on purpose for a time. What makes any of
              them ours is a shape simple enough to remember for life, and small enough to fit inside
              ten minutes before the house wakes up. Settle first. Add the practice gently. Recognize
              that what it reveals was already yours. Let it all return to openness at the end.
            </p>

            <h2>For anyone</h2>
            <p>
              Buddhist, secular, spiritual, or undecided: the door is the same, and so is the depth.
              This is Buddhist wisdom, rooted in the early teachings and honoring the traditions that
              grew from them, offered without dogma. What we share is informed by modern science,
              lived experience, and the world&rsquo;s wisdom traditions, and it will feel familiar if
              you came to meditation through a mindfulness course, a class at work, or an app. Those
              doors are real doors; they led you here. Whatever true thing you carry from elsewhere
              keeps its honored place. Nothing here will ask you to believe anything. It will ask you
              to look.
            </p>
            <p>
              Everyone who joins us receives the full introduction to the handful and the map of its
              elements: the understanding underneath the practice, the seven gatherings and what is
              in each of them, and how to walk it. It is a map people return to for years.
            </p>
            <p>Come sit with us, and see.</p>
          </div>

          <div className="pp-actions">
            <Link href="/your-first-visit" className="pp-btn">
              Plan your first visit
            </Link>
            <Link href="/this-week" className="pp-link">
              See what&rsquo;s happening this week <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
