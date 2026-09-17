import Link from "next/link";

export const metadata = {
  title: "Taking Care — Rooted In Mindfulness",
  description:
    "How we practice at Rooted in Mindfulness: taking care of ourselves, the people we love, the world, and this moment, described in eight plain words. Meditation and contemplative practice in Brookfield, Wisconsin.",
};

/**
 * /care — how we practice, for a visitor who has not walked in.
 *
 * CARE is the practice-scale face of A Handful of Leaves: eight words in four
 * pairs (Calm, Connect · Aware, Attitude · Recognize, Remember · Embody,
 * Engage), eight faces of one moment, not eight steps. Authority is the
 * teacher-side framework (care-core-framework.md) and the ratified community
 * handout (Taking C.A.R.E.). This page sits on the community side of the
 * framework's register line and one register lighter than the handout: a
 * visitor has never met "silent illumination", "luminous", or "Buddha nature",
 * so the words are met experientially and the tradition is named once, at the
 * close, as a door. Every sentence about a word descends from the handout's
 * "in our words" paragraph for that word; nothing new is claimed.
 *
 * Image discipline: one image, the pond, recurring — the stirring is Calm's,
 * the clearness is Aware's, what shows in clear water is Recognize's, and the
 * settling again is the wrap-around from Engage back to Calm. The handout's
 * sun (light for Aware, warmth for Attitude) is deliberately not carried here.
 *
 * Each pair's heading carries an anchor the home page's cards deep-link to.
 * Copy is provisional until Jesse's read-aloud.
 */
export default function CarePage() {
  return (
    <div className="pp-page pp-page--spine">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">How we practice</p>
          <h1 className="pp-hero__title">Taking Care</h1>
          <p className="pp-hero__body">Our practice, in one ordinary word and eight plain ones.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <p>
              Someone we love is having a hard week, and we want to help without making it worse.
              We slow down before we speak. We take in their face, the room, the tightness in our
              own chest. We let the tightness be there. We see it for what it is, worry, and we
              remember what we want for this person. Then we say the thing, in a tone years of
              caring have taught us, and we stay.
            </p>
            <p>That is our practice. Nothing was added to the moment. Everything in it was care.</p>
            <p>
              Our practice is taking care: of ourselves, of the people we love, of the world, and of
              this moment. We describe it with eight words, in four pairs. They are not steps, and
              there is no order to learn them in. In any real moment all eight are there, and any
              one of them is a door into the rest.
            </p>

            <h2 id="calm-and-connect">Calm and Connect</h2>
            <p>
              Calm is an invitation, not a demand. Ease in the body first, and from there some
              openness in the heart and a little less grip in the mind. Nothing is forced. What
              cannot be calmed, we calm around. Think of a pond stirred up with mud. You cannot
              clear it by reaching in; every grab stirs it more. Left alone, the water settles by
              itself. Calm is learning to stop stirring, and it can be invited anywhere, in a
              meeting or a waiting room, not only on a cushion.
            </p>
            <p>
              Connect is showing up to life as it is, at the only place we can: this body, these
              sounds, this room, and the thoughts and feelings moving through, met as part of the
              moment rather than lived inside. It is easy to be lost in a thought and believe we
              are present. The breath is one way back. Here is where we know our life, and here is
              where we have a choice.
            </p>

            <h2 id="aware-and-attitude">Aware and Attitude</h2>
            <p>
              Aware is the clarity that was already there. Nobody builds it. When the mind wanders
              and something knows it has wandered, that knowing arrived on its own. It is the same
              clearness the settled pond shows, and it was the water&rsquo;s all along. We do not
              manufacture this awareness. We show up to it, and because of it we can see what is
              here.
            </p>
            <p>
              Attitude is how we meet what we see. We let what is here be as it is, not wanting it
              to be better, not pushing away what we do not want, and we meet it kindly, with
              curiosity, because we want to know ourselves and this life. That does not mean
              agreeing with everything or never responding. It is the place we see from. Even when
              we are caught in reactivity, something clear can see the reactivity, and that
              difference is the whole teaching.
            </p>

            <h2 id="recognize-and-remember">Recognize and Remember</h2>
            <p>
              Recognize is knowing what is here and seeing it honestly. Peace as peace, joy as joy,
              anger as anger, worry as worry. Sometimes a plain name helps: this is here, this is
              happening now. Seeing a state does not always release it; some have been arriving for
              years and will come again when their conditions line up. But seen in clear water, a
              state shows more of itself: not me, not permanent, arising out of a whole web of
              conditions.
            </p>
            <p>
              Remember is the other half of mindfulness, the half the modern word dropped. We
              remember what matters: the people we care about, the intentions we want to live by,
              the wish not to add harm to ourselves, to others, or to the world. We remember the
              teachings we have met, however few. We remember to come back. And we weigh what we
              have recognized against what we care about. That weighing is how a person chooses
              what to grow and what to let go.
            </p>

            <h2 id="embody-and-engage">Embody and Engage</h2>
            <p>
              Embody is the practice becoming part of who we are. Repeated in body, heart, and
              action, what we care about slowly becomes character, and the old conditioning that
              keeps us from seeing is replaced, a little at a time, with a steadier way of being.
              Any day can be lived with intention. Then the whole day is practice.
            </p>
            <p>
              Engage is living as well as we can with the conditions of our life, including the
              habits of our own minds. It is caring for ourselves, for those we love, and for the
              world: understanding, caring, and acting from that place. It is the door held, the
              hard email answered kindly, the salt passed, a child listened to. And when the action
              is done, it returns to stillness. The water settles, and we begin again from calm.
            </p>

            <h2>Not a sequence</h2>
            <p>
              The letters spell a word, and words need an order. Moments do not. Sometimes what a
              day needs is calm. Sometimes it needs remembering. Sometimes the practice is to act.
              Often all eight are present at once, in a ninety-second exchange at the kitchen sink.
              Each of them can be practiced within ourselves, between us, and in the wider web of
              life we are part of. Insight here comes from living it, not from understanding the
              words, and most of the time the practice is an ordinary day: sitting, working,
              resting, being with people, and taking care as we go.
            </p>

            <h2>Where it comes from</h2>
            <p>
              Behind these eight words is an old way of practice. It comes down through the
              Buddhist meditation traditions, and one Chinese teacher, nine centuries ago, gave it
              two words: silent illumination. An open, settled awareness that meets whatever
              arrives. Around here it is the ground everything else stands on. You do not need to
              know any of this to practice; the words above are enough for years. The depth is
              there for anyone who wants it, and everyone who practices with us receives the full
              handout and, in time, the fuller map behind it,{" "}
              <Link href="/what-we-practice">A Handful of Leaves</Link>.
            </p>
            <p>
              Practice begins in care, and it opens into care. CARE is the language we share for
              all of this. Behind it is a deep tradition. In front of it is the life we are living
              now, and the people in it.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/your-first-visit" className="pp-btn">
              Plan your first visit
            </Link>
            <Link href="/what-we-practice" className="pp-link">
              A Handful of Leaves <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
