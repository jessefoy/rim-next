import Link from "next/link";

export const metadata = {
  title: "Why We Practice — Rooted In Mindfulness",
  description:
    "What the practice at Rooted in Mindfulness is for: becoming more awake and present in our lives and freer of what binds us, so that we understand with greater wisdom, care with kindness and compassion, and act from both.",
};

/**
 * /why-we-practice — RIM's center at full length (2026-09-25).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * Change the words there first, then here. Provisional until Jesse's
 * read-aloud. Teacher-side authority: 1 Model/01-framework-what-rim-is.md,
 * Parts One and Two, in the public register (no Pali, no framework named as
 * framework).
 *
 * Order: the ground first (something already here), then goodness and
 * difficulty, what gets in the way, where life happens (contact, in its
 * "greater meaning": our relationship with our life), what we practice for
 * (the four right efforts as heal / promote / protect / reduce harm), a fuller
 * life, the circulation between life and community, and the turn outward.
 *
 * Image discipline: one image, the garden, carrying the four efforts. The
 * second arrow is stated plainly, without its arrow. The close is a gathering
 * (the opening's "clear and warm" returns once) and a distillation: Jesse's
 * closing line of intention, set apart.
 */
export default function WhyWePracticePage() {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">What we are here for</p>
          <h1 className="pp-hero__title">Why We Practice</h1>
          <p className="pp-hero__body">What this practice is for, and what it asks of us.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <h2>Something already here</h2>
            <p>
              Something clear and warm is already here in each of us. We can find it in an ordinary
              moment. The mind drifts into a plan or a worry, and then something knows that it
              drifted. Nobody built that knowing. It arrived on its own, and it saw the drift
              without having to fight it.
            </p>
            <p>
              We call this wakefulness. It is not on a mountaintop, and it is not reserved for
              special people. It is here in the middle of an ordinary day, alongside all our usual
              thoughts and moods, and our practice is learning to live from it more often. That
              takes patience and effort, and every day offers new chances to begin again.
            </p>
            <p>
              The same is true of our goodness. We trust in the goodness and potential we share as
              human beings. It is part of who we are, and it is easy to lose touch with, for one
              person and for a whole society. Long stretches of stress, loss, or hurry can cover it
              until it seems gone. It is not gone. Practice is how we come back to it.
            </p>

            <h2>Goodness and difficulty</h2>
            <p>
              Life holds goodness and difficulty, and all of it matters. A friendship, a meal, the
              satisfaction of work done well, a child laughing in the next room. A diagnosis, a
              loss, a job that asks too much, an argument that keeps coming back.
            </p>
            <p>
              People come to practice for all of it. Some come because something hurts. Some come
              because they love someone and want to be there for them better. Some want a practice
              that finally lasts, and some have glimpsed a way of living that is freer and kinder
              than the one they know. Many come for more than one of these at once.
            </p>
            <p>
              If this is a dark time, this practice has room for it, and so do we. Many people have
              arrived here in the hardest season they had known. Nobody needs to feel better before
              they come. And for anyone who wants to deepen the light already in their life, there
              is always further to go.
            </p>

            <h2>What gets in the way</h2>
            <p>
              We care about our lives, the people around us, and what happens in the world. And our
              ways of seeking happiness, protecting ourselves, and reacting to difficulty often
              undermine the very things we care about. The parent who loves a child and still
              snaps. The person who wants rest and reaches for the phone. The friend who wants
              closeness and defends instead of listening. Good intentions alone do not give us the
              freedom to respond differently.
            </p>
            <p>
              These habits have familiar shapes: grasping at what we want, pushing away what we do
              not, and holding on to old stories about ourselves and others. There is the pain that
              comes with being alive, and there is the suffering we add in reaction to it, the
              replaying and bracing and blaming. Practice cannot always remove the first. It can
              learn to stop adding the second.
            </p>

            <h2>Where life happens</h2>
            <p>
              Every moment of our life is a meeting: with the world around us, with other people,
              and with our own body, thoughts, and feelings. This meeting is our relationship with
              our life. It is where we are actually alive. And it is where we have a choice. Here we
              can see how the mind is meeting this moment: reaching, pushing away, telling an old
              story, or meeting it clearly and with care.
            </p>
            <p>
              In that seeing there is room. There is room to let an old reaction pass without
              obeying it, to remember what matters, and to respond with understanding instead of
              repeating the pattern. What we choose there, again and again, becomes who we are.
            </p>

            <h2>What we practice for</h2>
            <p>
              Our practice has a direction: to be more awake and present in our lives, and freer of
              what binds us, so that we understand with greater wisdom, care with kindness and
              compassion, and act from both. Along the way we heal, promote, and protect
              well-being, in ourselves, in those we care about, and in our shared world, and we reduce
              harm.
            </p>
            <p>
              A garden makes the direction plain. What we water grows. So we stop watering what
              harms, and we stop planting more of it. We tend what already hurts, patiently, until
              what harms loosens its hold. We water what is healthy and good so it can take root.
              And we look after what is good once it is growing, so it can last.
            </p>
            <p>
              The old word for this is wholesome, and it shares a root with heal, health, and whole.
              What is wholesome is what makes us whole. If the trying itself turns tight or harsh,
              we have found one more thing to tend.
            </p>

            <h2>A fuller life</h2>
            <p>
              None of this asks for a different life. It asks for this one, met from wakefulness
              more often. A fuller life is one where we bring clarity and care to as many moments as
              we can: enjoying what there is to enjoy, responding to what needs us, and staying
              connected to all of it, the healthy and the hard.
            </p>
            <p>
              This is health in the larger sense of the word, closer to wholeness than to cure. It
              makes room for a realistic happiness, one that does not depend on everything going
              well and so can include difficulty.
            </p>
            <p>
              Along the way we find that we are more than who we have become. We respond where we
              used to react. We can stay with grief, and enjoy something good without needing to
              hold on to it. Our care reaches past its usual circle. These show what greater
              understanding and greater care look like in a life, and nobody here is keeping score.
            </p>

            <h2>Together, and in our lives</h2>
            <p>
              Most of this happens away from the meditation hall, at home, at work, in our
              relationships, and in the world. We practice together to support those lives. We
              bring the practice into our days, and we bring our days back to the community, the
              difficulties and the successes alike. Then we go home and practice again. It is the
              same movement as meditation itself: the mind wanders, we come back, and each return
              makes the next one a little easier.
            </p>
            <p>
              This is an intentional community. What we ask of one another is simple: to take part
              in the practice as it is offered, to practice in daily life as best we can, and to
              hold our <Link href="/community-care-agreements">care agreements</Link> as directions
              to hold, not requirements to be graded on. People practice at their own pace and
              depth, and the practice we share is the ground we stand on together.
            </p>

            <h2>Past our own edges</h2>
            <p>
              Care that takes root does not stop at our own door. It shows in how we treat a
              stranger, how we do our work, and what we make of the conditions around us. Some
              suffering comes from illness, poverty, isolation, or harm, and needs more than a
              changed mind. Needing support is part of the path, and so is offering it. We also
              help{" "}
              <Link href="/outreach">
                organizations bring this practice to the people they care for, and to their own
                caregivers
              </Link>
              .
            </p>
            <p>
              Families, communities, and whole societies can lose track of their goodness and their
              health. They can also remember it together. When one person comes back to clarity and
              care, the people around them feel it: a calmer voice at the dinner table, a kinder
              word at work. Showing up for ourselves, for the people we care about, and for the
              world makes a difference. Health in one life supports health in the lives around it.
            </p>
            <p>
              All of this matters. The time we have is finite, and at heart most of us know when we
              are living in line with what we care about and when we are not. That knowing is where
              practice begins, and it is already ours. Something clear and warm is already here in
              each of us, and our practice is learning to live from it.
            </p>

            <p className="pp-distillation">
              And so we practice together,
              <br />
              to bring this wakefulness to as many moments as we can,
              <br />
              and to heal, promote, and protect well-being
              <br />
              for ourselves, those we care about, and our shared world.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/care" className="pp-btn">
              Taking Care: how we practice
            </Link>
            <Link href="/new-to-rim" className="pp-btn pp-btn--ghost">
              New to RIM
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
