import Link from "next/link";

export const metadata = {
  title: "A Handful of Leaves - Rooted In Mindfulness",
  description:
    "A Handful of Leaves: the teachings behind Taking CARE, drawn from the Buddha's earliest teachings and the traditions that grew from them, and ordered as a practicing life.",
};

/**
 * /handful-of-leaves — A Handful of Leaves (new, 2026-10-01, the integration
 * brief, A10). It was /what-we-practice until 2026-09-25, which redirects here.
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/08-promotion-site-drafts-integration-2026-10-01.md
 * (Section 1), built from "A Handful of Leaves: An Introduction". Provisional
 * until Jesse's read-aloud.
 *
 * Two bracketed [Jesse] notes in the draft are left out of the page and listed
 * in the report: (1) confirm that new members receive the introduction and the
 * map, in "Walking it"; (2) name Essential Dharma Study where it is taught, in
 * the same section.
 *
 * Layout is Why We Practice's: a reading column, "On this page" over the six
 * sections (one array feeds the list and the h2 ids so they cannot drift), a
 * plain closing line set apart as the page's distillation. Image discipline:
 * the page carries its own images in words (the grove, the medicine cabinet,
 * the gardener and the rose); no photograph.
 */

const SECTIONS = [
  { id: "the-story-of-the-name", title: "The story of the name" },
  { id: "the-depth-behind-taking-care", title: "The depth behind Taking CARE" },
  { id: "why-a-handful", title: "Why a handful" },
  { id: "a-practicing-life-gathered", title: "A practicing life, gathered" },
  { id: "many-doors-one-practice", title: "Many doors, one practice" },
  { id: "walking-it", title: "Walking it" },
] as const;

function SectionHeading({ id }: { id: (typeof SECTIONS)[number]["id"] }) {
  const section = SECTIONS.find((s) => s.id === id)!;
  return <h2 id={section.id}>{section.title}</h2>;
}

export default function HandfulOfLeavesPage() {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">The depth behind the practice</p>
          <h1 className="pp-hero__title">A Handful of Leaves</h1>
          <p className="pp-hero__body">
            The teachings behind Taking CARE, gathered from across the traditions.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <nav className="pp-toc" aria-label="On this page">
            <p className="pp-toc__label" aria-hidden="true">
              On this page
            </p>
            <ol className="pp-toc__list" role="list">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a className="pp-toc__link" href={`#${s.id}`}>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="pp-prose pp-prose--sections">
            <SectionHeading id="the-story-of-the-name" />
            <p>
              One afternoon, some twenty-five centuries ago, the Buddha was walking with his
              students through a grove of trees. He gathered a few fallen leaves into his hand and
              asked which were more numerous, the leaves in his hand or the leaves in the forest
              above them. The answer was obvious, and so was the point. What he had come to
              understand was vast, like the forest. What he taught was like this handful: only what
              helps, only what leads onward, to peace, to clear seeing, to the easing of
              unnecessary suffering, and to lives of wisdom and compassion that benefit ourselves,
              the people we love, and the world we share.
            </p>
            <p>
              Our teaching takes its name from that afternoon, and its promise from it too.
              Everything in the handful was gathered with one question in mind: does this help a
              person suffer less, see more clearly, and love more capably? It is there because, for
              countless people across many centuries, the answer has been yes.
            </p>

            <SectionHeading id="the-depth-behind-taking-care" />
            <p>
              Taking CARE is our practice in eight plain words. A Handful of Leaves is the wider
              body of teaching behind them. It draws on the Buddha&apos;s earliest teachings, on
              the ways those teachings grew through centuries of practice, and on the living
              traditions today, and it gathers them into one shape a community can practice
              together. Each of the eight words opens onto teachings gathered here, so a person can
              begin with one word and keep finding more behind it for a lifetime.
            </p>
            <p>
              At the center of it all is the understanding our roots begin with: the mind is
              luminous, clouded only by what passes through it. The handful is ordered around that
              clarity: what clouds it, what helps us realize it, and how we come to live from it.
            </p>
            <p>
              The handful is open in both directions. When something true reaches us in practice,
              from any tradition or from none, it finds a place here, and the practice is richer
              for it.
            </p>

            <SectionHeading id="why-a-handful" />
            <p>
              Every teaching of every Buddhist tradition, and many beyond it, is available to us at
              once: a retreat in one lineage, a book from another, a podcast from a third, an app
              adapted from all of them. That is a real gift, and much of the time it is
              overwhelming. We can have all the information we could ever need and still not have
              what we need. Exposure everywhere, orientation nowhere.
            </p>
            <p>
              The traditions did nothing wrong. Each is complete in itself, a whole path able to
              carry a person all the way. But few of us can live inside a single tradition with a
              lifetime of immersion, and breadth without roots leaves even sincere practitioners
              holding valuable pieces with no way to put them together. A Handful of Leaves was
              gathered for this, and for people with jobs and children and full days. It replaces
              nothing and ranks nothing. The whole of the Dharma is honored as one living family,
              and whatever wisdom you bring from elsewhere keeps its place.
            </p>

            <SectionHeading id="a-practicing-life-gathered" />
            <p>
              The handful&apos;s teachings are ordered by what each is for in a life of practice,
              and they are best met as the arc of that life. Every one of them is available from
              the first week, and none is ever finished.
            </p>
            <p>
              <strong>Guiding Aspirations.</strong> Why we begin. The wish to be free, the wish that
              others be free, the intention to live with wisdom and compassion. From the first sit,
              our practice is already for more than ourselves.
            </p>
            <p>
              <strong>The Path as Refuge.</strong> What holds us. Refuge in our wakeful nature, in
              the teachings, and in one another, and the eightfold path, lived as a life that stops
              stirring the pond.
            </p>
            <p>
              <strong>Unwholesome States of Mind: Recognize and Release.</strong> What clouds the
              mind. Wanting, resentment, anxiety, and judging, named one by one and without
              contempt. They are visitors, with causes and no lease.
            </p>
            <p>
              <strong>Wholesome States of Mind: Recognize and Cultivate.</strong> What helps us
              realize its clarity. Kindness, patience, gratitude, contentment, and calm, recognized
              when they visit and cultivated with care, until moments become character.
            </p>
            <p>
              <strong>Domains of Contemplation.</strong> Where we look. The body and the breath,
              feeling tones, the mind and its states, the senses meeting the world, and the
              luminous mind itself.
            </p>
            <p>
              <strong>How to Contemplate.</strong> How we look. A warm, open knowing that receives
              experience without adding to it, brightening when practice grows dim and settling
              when it grows busy.
            </p>
            <p>
              <strong>Liberating Insights.</strong> What is finally seen. That everything changes,
              that the self is lighter than the fortress we defend, that all things arise together,
              and that release is possible. The seeing that frees us returns to the world as care.
            </p>
            <p>
              At the heart of the path, the handful and our daily practice share the same plain
              verbs. We recognize what clouds the mind and let it go, and we recognize, cultivate,
              and protect what helps us live from its clarity.
            </p>

            <SectionHeading id="many-doors-one-practice" />
            <p>
              Loving-kindness comes from one lineage, breath awareness from another, the
              contemplation of change from a third. They do not compete, because they share one
              ground. As <Link href="/our-roots">Our Roots</Link> describes, the open awareness of
              silent illumination is the hall every practice is played in.
            </p>
            <p>
              So the particular practices are doors, each taken up for a time, and each follows a
              shape simple enough to remember for life: settling first, adding the practice gently,
              recognizing that what it reveals was already ours, and letting it all return to
              openness at the end.
            </p>
            <p>
              The old traditions spoke of the teachings as medicines: many remedies, because there
              are many ways a heart can ache, all in service of one health. Different seasons of a
              life call for different doors, and over the years what we gather is a familiarity
              with our own medicine cabinet.
            </p>
            <p>
              The qualities these practices meet are both uncovered and cultivated. Kindness,
              patience, and calm are native to the mind, revealed as the clouding thins, and they
              are strengthened through real practice. A gardener cannot make a rose, and the rose
              does not flourish without the gardener.
            </p>

            <SectionHeading id="walking-it" />
            <p>
              Everyone who joins RIM receives <em>A Handful of Leaves: An Introduction</em> and the
              full map of its teachings. The map is meant to be returned to, the way one returns to
              a trusted friend with a question. Something arises in practice or in life, and
              somewhere on the map is the place where it belongs and the teachings that meet it.
              One leaf, taken up wholeheartedly, holds the spirit of the whole handful.
            </p>
            <p>
              We explore the handful together in our ongoing learning and practice, and Foundations
              begins with Taking CARE, the plain words the handful stands behind.
            </p>

            <p className="pp-distillation">
              The leaves in our hands are few.
              <br />
              The light they are read by has no size.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/care" className="pp-btn">
              Taking CARE: how we practice
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
