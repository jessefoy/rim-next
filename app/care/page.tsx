import Link from "next/link";
import CareCircle from "@/components/CareCircle";

export const metadata = {
  title: "Taking Care — Rooted In Mindfulness",
  description:
    "How we practice at Rooted in Mindfulness: taking care of ourselves, the people we love, the world, and this moment, described in eight plain words. Meditation and contemplative practice in Brookfield, Wisconsin.",
};

/**
 * /care — how we practice. The page is the general practice handout
 * ("Taking C.A.R.E.", the vault's 2 Community/04-community-handout-general.md)
 * adapted for the web and nothing more (Jesse, 2026-09-26: "the handout and
 * this page are probably the same"). It is a first introduction; the teachings
 * deepen through the community introduction, Foundations, ongoing learning,
 * and practice.
 *
 * Changes from the handout's text: the first sentence (a page, not a handout
 * in hand); silent illumination is named once, in the introduction, and inside
 * the words its two halves are said as clarity (Aware) and presence (Attitude),
 * Jesse's wording; one added sentence on "great", in Jesse's words; the
 * handout's paragraph on how the words are taught moves to the close; "Buddha
 * nature" is glossed where it appears, in the site's own center words.
 *
 * The eight words are eight headings, never four pairs: the pairs are the
 * teacher-side framework's architecture, and the register line keeps the frame
 * off public pages. The pond (Calm) and the sun (Aware, Attitude) are the
 * handout's own images, kept together (Jesse: related images are fine).
 *
 * Each word's heading carries an anchor; the home page's four circle-quarter
 * cards deep-link to the first word of their quarter. Source of truth for
 * the words: the vault's 04-community-website-copy-2026-09-25.md.
 * Provisional until Jesse's read-aloud.
 */
export default function CarePage() {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
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
              This is an introduction to how we practice at Rooted in Mindfulness. It is meant to be
              practiced rather than thought about, so that we see for ourselves what each word is
              and what we find there.
            </p>
            <p>
              Our practice is taking care: of ourselves, of those we love, of the world, and of this
              moment. It is rooted in silent illumination, an open and settled awareness that meets
              whatever arrives with care. The eight words describe that one practice from eight
              sides. They arise together. Sometimes one takes center stage, but they support one
              another, and the boundaries between them are somewhat artificial: each word calls out
              one aspect of the moment of our practice. Sometimes we will focus on one or two words,
              sometimes on the whole. Sometimes one word will be our anchor, and later another. It
              is a living practice, and it shows up when we embody it.
            </p>

            <figure className="care-figure">
              <CareCircle />
              <figcaption className="care-figure__caption">
                The three rings of the circle show that each word can be contemplated in three ways:
                within ourselves, in relation to others, and within the vast web of causes and
                conditions we are part of, which the circle calls interbeing.
              </figcaption>
            </figure>

            <h2 id="calm">Calm</h2>
            <p>
              Calm is an invitation: ease in the body, and from there openness in the heart and a
              letting go of constriction in the mind. Nothing is forced, and nothing has to be
              perfect. What cannot be calmed, we calm around, inviting a little more ease. Calm
              stops the stirring of the pond. It does not wait for the right conditions; it can be
              invited anywhere, and that is what makes it foundational. We want to meet everything,
              in all circumstances.
            </p>

            <h2 id="connect">Connect</h2>
            <p>
              Connect is this moment as it is, our life at the six senses: the world around us, the
              body, and the heart and mind with their memories, thoughts, and feelings. This is
              where to pay attention. It is easy to be lost in a thought and believe we are present;
              met in contact, the thought is part of this moment. Contact is the anchor; the breath
              is one way to it. Here we know life and our relationship to it, and here we have
              choice. Connect is showing up to life as it is, at the only place we can.
            </p>

            <h2 id="aware">Aware</h2>
            <p>
              Aware is clarity, the illumination at the heart of our practice. This luminous
              awareness is always available to us, always illuminating, like the sun shining on the
              turning Earth: it shines on everything. It becomes obscured when we get caught up in
              what covers it, attached to the content of our thoughts and feelings. We do not
              construct this awareness. We show up to it. Everything we know arises within it, and
              because of it we can recognize what is here. The luminous mind reveals. Together with
              Attitude, clarity and presence are the heart of our practice.
            </p>

            <h2 id="attitude">Attitude</h2>
            <p>
              Attitude is how we meet our experience. If Aware is the light of the sun, Attitude is
              its warmth. We let what is here be as it is, not wanting it to be better, not pushing
              away what we don&rsquo;t want, and we meet it kindly, with curiosity, because we want
              to know ourselves, others, and this life, and to remove what obscures our wakeful
              nature. This is presence: everything extra quiets, and what is here can be known
              without our being of it. That is equanimity. It doesn&rsquo;t mean agreeing with
              everything or never responding. It is the place we see from, clearly and whole, and
              even when we are caught in reactivity, that clear knowing can see the reactivity.
            </p>

            <h2 id="recognize">Recognize</h2>
            <p>
              Recognize is knowing what is here and seeing it honestly: peace as peace, joy as joy,
              anger as anger, worry as worry, whatever is alive at our senses, within us and around
              us. Awareness makes this possible, and the attitude of not clinging, not pushing away,
              and staying curious protects it. Sometimes a simple name helps: this is here, this is
              happening now. Recognizing does not always release what we see; some states are
              long-standing, arising whenever their conditions come together. But seen honestly, a
              state shows more of itself: not me, not permanent, arising within a whole web of
              conditions. Recognizing gently, with bare knowing, we see the greater context, and
              come to know our experience more clearly.
            </p>

            <h2 id="remember">Remember</h2>
            <p>
              Remember is our reconnection with our greater nature. Caught in the ordinary mind, the
              noise, we forget our wakeful nature; remembering finds it again.
            </p>
            <p>
              We also remember what
              is important: our deeper intentions, our values, the wish to live without causing harm
              to ourselves, others, or the world, to bring benefit and well-being, and to help
              create the conditions for everyone to realize their own greater nature. We remember
              the teachings we have met, however many or few, all of them aimed at unclouding. We
              remember to come back and abide in the conditions of this moment, and to let our
              greater intentions meet the intentions of this moment. We reflect on what we recognize
              and weigh it against what matters; this is how we can choose to grow and protect what
              is wholesome, and to see through and guard against what is not. This remembering is
              the other half of mindfulness.
            </p>

            <h2 id="embody">Embody</h2>
            <p>
              Embody is making the practice part of who we are. We embody what we care about, what
              we are cultivating, and what we see through our practice; the practice itself is a
              form of embodiment, and so is the way we act. We do not only think about these things.
              Over time, repeating them in heart, mind, and body, in action, they become more of who
              we are, and the old conditioning that keeps us from seeing is slowly replaced by a way
              of abiding that cultivates the ground for wakefulness, great wisdom, and great
              compassion. Great here means not caught in our limited perspective. Any day can be
              lived with intention, and then the whole day is practice. When we lose the
              embodiment, we lose the practice.
            </p>

            <h2 id="engage">Engage</h2>
            <p>
              Engage is living as best we can with the conditions of our life, including the habits
              of our ordinary mind. It is caring for ourselves, for those we love, and for the
              world: understanding, caring, and acting from that place. It lets us meet healthy
              moments with joy, peace, love, and appreciation, and meet what challenges us in a way
              that leaves us more awake and freer of harmful patterns.
            </p>
            <p>
              It is arranging the causes
              and conditions, inside and out, through our speech, our actions, our lifestyle, and
              our relationships, so that this present-moment life improves and we can meet it
              fully. This is great action, great because it arises from the wakeful, liberated mind
              rather than the reactive one. In time it becomes a natural way of being: less
              contrived, more authentic and true, awake, free of the ordinary mind&rsquo;s hold, and
              unified with our Buddha nature, the wakeful and caring nature already within each
              of us. And when the action is complete, it returns to stillness, and we begin again
              from calm.
            </p>

            <h2>Learning over time</h2>
            <p>
              The words are taught over time, in our sits, classes, practice discussions, and talks,
              sometimes one at a time, sometimes several, sometimes as one unified practice. They
              are not steps, and there is no order to learn them in. Wherever we begin, the others
              are already there.
            </p>
            <p>
              Insight here comes from lived experience, not from an understanding of the words. Most
              of the time the practice is our ordinary day: sitting, working, resting, being with
              people, and taking care as we go.
            </p>
            <p>
              This page is a first introduction. The teachings deepen from there: through our
              community introduction, <Link href="/our-roots">A Handful of Leaves</Link>; through
              Foundations; and through ongoing learning and practice together.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/new-to-rim" className="pp-btn">
              New to RIM
            </Link>
            <Link href="/our-roots" className="pp-btn pp-btn--ghost">
              Our roots
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
