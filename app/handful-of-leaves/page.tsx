import Link from "next/link";
import ReadingToc from "@/components/ReadingToc";
import MemberAreaLink from "@/components/MemberAreaLink";

export const metadata = {
  title: "A Handful of Leaves - Rooted In Mindfulness",
  description:
    "A Handful of Leaves: the teachings behind Taking CARE, drawn from the Buddha's early teachings, the ways they grew through centuries of practice, and the living traditions today, and ordered as a practicing life.",
};

/**
 * /handful-of-leaves — A Handful of Leaves (new, 2026-10-01, the integration
 * brief, A10; shortened 2026-10-22). It was /what-we-practice until
 * 2026-09-25, which redirects here.
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/08-promotion-site-brief-condensation-2026-10-22.md
 * (Part B §4, Jesse's approved condensation; it supersedes Section 1 of
 * 08-promotion-site-drafts-integration-2026-10-01.md), built from "A Handful
 * of Leaves: An Introduction". Provisional until Jesse's read-aloud.
 *
 * The luminous mind is "a teaching preserved in the early discourses" and is
 * "clouded by what passes through it and able to be freed of it": never
 * "earliest", never "clouded only" (the 2026-10-22 integrity pass).
 *
 * Layout is Why We Practice's: a reading column, "On this page" over the six
 * sections (one array feeds the list and the h2 ids so they cannot drift),
 * the seven gatherings as a compact list, and the closing couplet set apart.
 * Image discipline: the page carries its own images in words (the grove, the
 * medicine cabinet, the gardener and the rose); no photograph.
 */

const SECTIONS = [
  { id: "the-story-of-the-name", title: "The story of the name" },
  { id: "why-a-handful", title: "Why a handful" },
  { id: "the-depth-behind-taking-care", title: "The depth behind Taking CARE" },
  { id: "a-practicing-life-gathered", title: "A practicing life, gathered" },
  { id: "many-medicines-one-health", title: "Many medicines, one health" },
  { id: "walking-it", title: "Walking it" },
] as const;

/** The seven gatherings, each named and glossed by what it is for. */
const GATHERINGS = [
  {
    name: "Guiding Aspirations",
    gloss:
      "Why we begin. The wish to be free, the wish that others be free, and the intention to live with wisdom and compassion. From the first sit, our practice is already for more than ourselves.",
  },
  {
    name: "The Path as Refuge",
    gloss:
      "What holds us. Our wakeful nature, the teachings, and one another, and the eightfold path, lived as a life that stops stirring the pond.",
  },
  {
    name: "Unwholesome States of Mind",
    gloss:
      "What clouds the mind. Wanting, resentment, anxiety, and judging, recognized and released without contempt. They are visitors, with causes and no lease.",
  },
  {
    name: "Wholesome States of Mind",
    gloss:
      "What helps us realize its clarity. Kindness, patience, gratitude, contentment, and calm, recognized and cultivated until moments become character.",
  },
  {
    name: "Domains of Contemplation",
    gloss:
      "Where we look. The body and the breath, feeling tones, the mind and its states, the senses meeting the world, and the luminous mind itself.",
  },
  {
    name: "How to Contemplate",
    gloss: "How we look. A warm, open knowing that receives experience without adding to it.",
  },
  {
    name: "Liberating Insights",
    gloss:
      "What is finally seen. That everything changes, that the self is lighter than the fortress we defend, that everything arises from causes and conditions, and that release is possible. The seeing that frees us returns to the world as care.",
  },
] as const;

function SectionHeading({ id }: { id: (typeof SECTIONS)[number]["id"] }) {
  const section = SECTIONS.find((s) => s.id === id)!;
  return <h2 id={section.id}>{section.title}</h2>;
}

export default function HandfulOfLeavesPage() {
  return (
    <div className="pp-page pp-page--spine pp-page--reading">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">The depth behind the practice</p>
          <h1 className="pp-hero__title">A Handful of Leaves</h1>
          <p className="pp-hero__body">
            The teachings behind Taking CARE, gathered from across the traditions.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container pp-reading">
          <ReadingToc sections={SECTIONS} />
          <div className="pp-reading__article">
          <div className="pp-prose pp-prose--sections">
            <SectionHeading id="the-story-of-the-name" />
            <p>
              Some twenty-five centuries ago, the Buddha was staying with his students in a grove of
              simsapa trees. He picked up a few leaves and asked which were more numerous, the
              leaves in his hand or the leaves in the grove. What he had come to know was vast, like
              the forest. What he taught was like this handful: only what truly helps, what leads to
              peace, to clear seeing, and to freedom from suffering.
            </p>
            <p>
              Our teaching takes its name from that day, and its promise too. Everything in the
              handful was gathered with one question in mind: does this help a person suffer less,
              see more clearly, and love more capably? Each teaching is here because, across the
              centuries and in our own community, it has helped people do just that, for
              themselves, for those they care about, and for our shared world.
            </p>

            <SectionHeading id="why-a-handful" />
            <p>
              Every teaching of every Buddhist tradition, and many beyond it, is available to us at
              once: a retreat in one lineage, a book from another, a podcast from a third, an app
              adapted from all of them. That is a real gift, and much of the time it is
              overwhelming. We can have all the information we could ever need and still not have
              what we need.
            </p>
            <p>
              Each tradition is complete in itself, a whole path able to carry a person all the
              way. Few of us can live inside one with a lifetime of immersion, and breadth without
              roots leaves sincere practitioners holding valuable pieces with no way to put them
              together. A Handful of Leaves was gathered for this, and for people with jobs and
              children and full days. It replaces nothing and ranks nothing, and whatever wisdom you
              bring from elsewhere keeps its place.
            </p>

            <SectionHeading id="the-depth-behind-taking-care" />
            <p>
              Taking CARE is our practice in eight plain words. A Handful of Leaves is the wider
              body of teaching behind them, drawn from the Buddha&rsquo;s early teachings, the ways
              they grew through centuries of practice, and the living traditions today. Each of the
              eight words opens onto teachings gathered here, so a person can begin with one word
              and keep finding more behind it for a lifetime.
            </p>
            <p>
              At its center is the understanding our roots begin with: the mind is luminous,
              clouded by what passes through it and able to be freed of it. The handful is ordered
              around that clarity: what clouds it, what helps us realize it, and how we come to live
              from it. It is open in both directions. When something true reaches us in practice,
              from any tradition or from none, it finds a place here.
            </p>

            <SectionHeading id="a-practicing-life-gathered" />
            <p>
              The teachings are ordered by what each is for in a life of practice. Every one of them
              is available from the first week, and none is ever finished.
            </p>
            <ul className="pp-leaves">
              {GATHERINGS.map((g) => (
                <li key={g.name}>
                  <strong className="pp-leaves__name">{g.name}.</strong>{" "}
                  <span className="pp-leaves__gloss">{g.gloss}</span>
                </li>
              ))}
            </ul>

            <SectionHeading id="many-medicines-one-health" />
            <p>
              The old traditions called the teachings medicines: many remedies for the many ways a
              heart can ache, all in service of one health. Loving-kindness, attention resting with
              the breath, the contemplation of the body and of change: each is a door, taken up for
              a time, and whichever door we take, the whole of Taking CARE is there.
            </p>
            <p>
              The qualities these practices meet are both uncovered and cultivated. A gardener
              cannot manufacture a rose, and the rose does not flourish without the gardener. Our
              practice is this kind of work: nothing to fabricate, and a garden that needs us.
            </p>

            <SectionHeading id="walking-it" />
            <p>
              Members can explore the handful in their{" "}
              <MemberAreaLink>member area</MemberAreaLink>, beginning with{" "}
              <em>A Handful of Leaves: An Introduction</em> and the map of its teachings. The map
              is meant to be returned to, the way one returns to a trusted friend with a question.
              We explore the handful together in our ongoing learning and practice, and Foundations
              begins with Taking CARE, the plain words the handful stands behind. One leaf, taken up
              wholeheartedly, holds the spirit of the whole handful.
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
        </div>
      </section>
    </div>
  );
}
