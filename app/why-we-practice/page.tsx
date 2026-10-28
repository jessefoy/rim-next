import Link from "next/link";
import ReadingToc from "@/components/ReadingToc";

export const metadata = {
  title: "Why We Practice - Rooted In Mindfulness",
  description:
    "What the practice at Rooted in Mindfulness is for: becoming more awake and present in our lives and freer of what binds us, so that we understand with greater wisdom, care with kindness and compassion, and act from both.",
};

/**
 * /why-we-practice — RIM's center at full length (2026-09-25; shortened
 * 2026-10-22).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/08-promotion-site-brief-condensation-2026-10-22.md
 * (Part B §2, Jesse's approved condensation; it supersedes Revision 8 of
 * 04-community-website-copy-2026-09-25.md). Change the words there first,
 * then here. Provisional until Jesse's read-aloud.
 *
 * Order, why-first: why people come, the ground (something already here),
 * what gets in the way, the moment of choice, how practice benefits the three
 * circles (ourselves, those we care about, our shared world) and a deeper
 * freedom, what we practice for, and the circulation between life and
 * community. "A whole-life practice" and "Beyond ourselves" were folded in on
 * 2026-10-22. Home links to #how-practice-benefits; keep that id.
 *
 * The three circles are three panels stacked in the reading column: at the
 * column's 680px, three side by side would leave lines of about 18
 * characters (measured 2026-10-22).
 *
 * Image discipline: one image, the garden, carrying the efforts. The close is
 * Jesse's line of intention, set apart in its four lines.
 */

/** One list feeds both the "On this page" nav and the h2 ids, so they cannot drift. */
const SECTIONS = [
  { id: "why-people-come", title: "Why people come" },
  { id: "something-already-here", title: "Something already here" },
  { id: "what-gets-in-the-way", title: "What gets in the way" },
  { id: "the-moment-of-choice", title: "The moment of choice" },
  {
    id: "how-practice-benefits",
    title: "How practice benefits ourselves, those we care about, and our shared world",
  },
  { id: "what-we-practice-for", title: "What we practice for" },
  { id: "together-and-in-our-lives", title: "Together, and in our lives" },
] as const;

function SectionHeading({ id }: { id: (typeof SECTIONS)[number]["id"] }) {
  const section = SECTIONS.find((s) => s.id === id)!;
  return <h2 id={section.id}>{section.title}</h2>;
}

export default function WhyWePracticePage() {
  return (
    <div className="pp-page pp-page--spine pp-page--reading">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">What we are here for</p>
          <h1 className="pp-hero__title">Why We Practice</h1>
          <p className="pp-hero__body">What this practice is for, and what it asks of us.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container pp-reading">
          <ReadingToc sections={SECTIONS} />
          <div className="pp-reading__article">
          <div className="pp-prose pp-prose--sections">
            <SectionHeading id="why-people-come" />
            <p>
              Life holds joy and difficulty, and all of it matters. A friendship, a meal, a child
              laughing in the next room. A diagnosis, a loss, a job that asks too much.
            </p>
            <p>
              People come to practice for all of it. Some come because something hurts, and some
              come well, wanting more of the life they already have. Some want a practice that
              finally lasts, or to be there better for the people they love. Some come because the
              state of the world has left them shaken, and some are looking for a path that goes
              all the way. Many come for more than one of these at once, and the reasons tend to
              widen the longer we stay.
            </p>
            <p>
              If this is a dark time, this practice has room for it, and so do we. Nobody needs to
              feel better before they come.
            </p>

            <SectionHeading id="something-already-here" />
            <p>
              Something clear and caring is already here in each of us. We can find it in an
              ordinary moment. The mind drifts into a plan or a worry, and then something knows that
              it drifted. Nobody built that knowing. It arrived on its own, and it saw the drift
              without having to fight it.
            </p>
            <p>
              We call this wakefulness. It is not on a mountaintop, and it is not reserved for
              special people. It is here in the middle of an ordinary day, and so is our shared
              human goodness, even when long stretches of stress or loss have covered it. Our
              practice is learning to live from this more often. That takes patience and effort,
              and every day offers new chances to begin again.
            </p>

            <SectionHeading id="what-gets-in-the-way" />
            <p>
              We care about our lives, the people around us, and what happens in the world. And our
              ways of seeking happiness, protecting ourselves, and reacting to difficulty often
              undermine the very things we care about. The parent who loves a child and still
              snaps. The person who wants rest and reaches for the phone. The friend who wants
              closeness and defends instead of listening.
            </p>
            <p>
              These habits have familiar shapes: grasping at what we want, pushing away what we do
              not, and holding on to old stories about ourselves and others. There is the pain that
              comes with being alive, and there is the suffering we add in reaction to it, the
              replaying and bracing and blaming. Practice cannot always remove the first. We can
              learn to add less of the second.
            </p>

            <SectionHeading id="the-moment-of-choice" />
            <p>
              Every moment of our life is a meeting: with the world around us, with other people,
              and with our own body, thoughts, and feelings. This meeting is where we are actually
              alive, and it is where we have a choice. Here we can see how the mind is meeting this
              moment: reaching, pushing away, telling an old story, or meeting it clearly and with
              care.
            </p>
            <p>
              In that seeing there is room: to let an old reaction pass without obeying it, to
              remember what matters, and to respond with understanding. Sometimes that means
              listening more closely, sometimes speaking firmly, asking for help, or making a
              change. What we choose there, again and again, becomes who we are. At first we may
              recognize a pattern only afterward, and over time recognition comes sooner. Taking
              CARE is how we train this moment.
            </p>

            <SectionHeading id="how-practice-benefits" />
            <p>
              None of this asks for a different life. It asks for this one, met from wakefulness
              more often, and what it gives reaches three ways at once.
            </p>
            {/* The three circles of benefit, one panel each (2026-10-22). */}
            <div className="pp-benefits">
              <div className="pp-benefit">
                <h3>For ourselves</h3>
                <p>
                  The first benefit is often steadiness. The difficulties may stay, and we add less
                  to them. Rest comes more easily, and a hard day becomes workable. Many people come
                  for this, and it is already the path.
                </p>
                <p>
                  Life also becomes more available. We taste more of what we are already living, and
                  we can delight in something without needing to hold on to it. Over time our
                  relationship with our own patterns changes: a reaction seen early is one we do not
                  have to obey, and more of our days line up with what matters to us. This is health
                  in the larger sense of the word, closer to wholeness than to cure: a well-being
                  that grows from the conditions we tend, inside and out, and has room for
                  difficulty.
                </p>
              </div>
              <div className="pp-benefit">
                <h3>For those we care about</h3>
                <p>
                  With the people we care about, that steadiness gives us more to offer. We listen
                  more fully, stay present when someone is struggling, and speak clearly when
                  something needs to change. We come to understand our part in a difficulty, and to
                  recognize when to repair and when a boundary is needed.
                </p>
                <p>
                  Those of us who care for others, at home or at work, learn to keep caring in a way
                  that can last. When one person comes back to clarity and care, the people around
                  them feel it: a calmer voice at the dinner table, a kinder word at work. Health in
                  one life supports health in the lives around it.
                </p>
              </div>
              <div className="pp-benefit">
                <h3>For our shared world</h3>
                <p>
                  Care that takes root widens, toward people we used to overlook and toward the
                  conditions that shape all our lives. Hard news can leave us stirred up or numb,
                  and helplessness is often part of what we add. Seen clearly, there is nearly
                  always something that is ours to do: a steadier response, a kinder word, one act
                  of care taken up with others.
                </p>
                <p>
                  Some suffering comes from illness, poverty, isolation, or harm, and it needs
                  practical care and changes in the conditions that sustain it. Small actions,
                  repeated, change conditions, and none of us has to carry all of it alone. The
                  tradition we practice in has a name for this way of living: the bodhisattva, who
                  walks the path of awakening for the benefit of all beings, themselves included.
                </p>
              </div>
            </div>

            <h3 id="a-deeper-freedom">A deeper freedom</h3>
            <p>
              For some, practice opens onto a deeper freedom: the discovery that the clarity and
              warmth we keep returning to were here all along. They can be clouded over, and with
              practice we find them more often, even in the hardest moments. We speak of their
              fullness as great wisdom, great compassion, and great action, great because they are
              no longer confined to our limited view of things. Nobody here is keeping score.
            </p>
            <p>
              How we teach is informed by mindfulness-based programs, and we keep the practice in
              its whole setting: with intention, with ethics, with community, and with the
              understanding that clarity is already within us. Research on mindfulness programs
              supports much of this, and no practice helps everyone. What matters here is what you
              can check for yourself.
            </p>

            <SectionHeading id="what-we-practice-for" />
            <div className="pp-quote pp-quote--set">
              <p className="pp-quote__text">
                Our practice has a direction: to be more awake and present in our lives, and freer
                of what binds us, so that we understand with greater wisdom, care with kindness and
                compassion, and act from both.
              </p>
            </div>
            <p>
              The work itself is simple to name: coming to know ourselves, cultivating what is
              healthy and wholesome, and releasing the patterns that bind us. A garden makes it
              plain. What we water grows. So we stop watering what harms. We tend what already
              hurts, patiently, until it loosens its hold. And we water what is healthy so it can
              take root and last.
            </p>
            <p>
              The old word for this is wholesome, and it shares a root with heal, health, and whole.
              If the trying itself turns tight or harsh, we have found one more thing to tend, and
              we meet it with compassion, including for ourselves.
            </p>

            <SectionHeading id="together-and-in-our-lives" />
            <p>
              Most of this happens away from the meditation hall: at home, at work, in our
              relationships, and in the world. We practice together to support those lives, and
              being together shows us habits we might not see on our own. We bring the practice
              into our days, and our days back to the community, the difficulties and the successes
              alike. Then we go home and practice again.
            </p>
            <p>
              It is the same movement as meditation itself: the mind wanders, we come back, and each
              return makes the next one a little easier.
            </p>
            <p>
              Each of us takes part in our own way and at our own pace, held by the intentions we
              share in our <Link href="/community-care-agreements">Community Care Agreements</Link>.
              RIM is sustained by the generosity, time, and care of the people who practice here,
              and what it offers in return is support for each person&rsquo;s practice.
            </p>
            <p>
              All of this matters. The time we have is finite. Many of us can sense when we are
              living in line with what we care about and when we are not, and practice can begin
              right there.
            </p>

            <p className="pp-distillation">
              And so we practice together,&amp;nbsp;
              <br />
              to bring this wakefulness to as many moments as we can,&amp;nbsp;
              <br />
              and to heal, promote, and protect well-being
              <br />
              for ourselves, those we care about, and our shared world.
            </p>
          </div>

          {/* Where to go from here (the refresh): the practice, and a first visit. */}
          <section className="pp-reading__next" aria-labelledby="why-next-title">
            <p className="pp-intro__eyebrow">How we practice</p>
            <h2 id="why-next-title">Learning to take CARE.</h2>
            <p>
              Taking CARE is our way of practice, a mindfulness-based framework for meditation and
              mindful living, and a program through which we learn and practice together.
            </p>
            <div className="pp-actions">
              <Link href="/care" className="pp-btn">
                Taking CARE: the eight words
              </Link>
              <Link href="/new-to-rim" className="pp-btn pp-btn--ghost">
                Plan your first visit
              </Link>
            </div>
          </section>
          </div>
        </div>
      </section>
    </div>
  );
}
