import { publicPageMetadata } from "@/lib/publicMetadata";
import Link from "next/link";

export const metadata = publicPageMetadata(
  "Our Roots — Rooted In Mindfulness",
  "How CARE, our shared practice at Rooted in Mindfulness, is nourished by silent illumination, Buddhist teachings, and modern mindfulness. Explore the roots of a lifelong practice.",
  "/our-roots",
);

/**
 * CARE is the shared practice that deepens; the Buddhist roots nourish it.
 * A Handful of Leaves names the ordered body of teachings that informs CARE.
 * This editorial order follows Jesse's approved newcomer review and his
 * correction of the first implementation (2026-09-26).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * Revision 10. Provisional until Jesse's read-aloud.
 * The CARE handout and diagram are unchanged.
 */
export default function OurRootsPage() {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Where this comes from</p>
          <h1 className="pp-hero__title">Our Roots</h1>
          <p className="pp-hero__body">
            The Buddhist roots and teachings that nourish our practice of CARE.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <p>
              <Link href="/care">CARE</Link> is the way we learn and practice together at RIM. Its eight words describe aspects of one practice: taking care of ourselves, those we care about, and our shared world. We explore their meaning through meditation and in how we live. That exploration can deepen throughout a lifetime.
            </p>
            <p>
              Our practice is rooted in Buddhism. A Handful of Leaves is our name for the body of traditional teachings that informs CARE. These teachings help us understand what we encounter in practice and how to respond with wisdom and compassion.
            </p>
            <h2>Silent illumination</h2>
            <p>
              At the heart of our practice is silent illumination, an open, settled awareness that meets whatever arrives with warmth. It comes to us through Chan, the Chinese Buddhist meditation tradition also known as Zen.
            </p>
            <p>
              In CARE, <Link href="/care#aware">Aware</Link> names the clarity that allows us to know our experience. <Link href="/care#attitude">Attitude</Link> names the presence with which we meet it: kindly, with curiosity, without clinging to what we like or pushing away what we find difficult. Together, clarity and presence are the heart of silent illumination.
            </p>
            <p>
              During meditation, this means knowing sensations, thoughts, and feelings as they arise, allowing them to be present without having to follow each one. Practices such as awareness of breathing and loving-kindness support this way of being with our experience. In daily life, the same clarity and presence help us recognize a reaction and give care to how we respond.
            </p>
            <h2>A Handful of Leaves</h2>
            <p>
              The name comes from a story about the Buddha. Holding a few leaves, he compared them with the leaves in the forest: what he understood was vast, but what he taught was what helped people find peace and live with wisdom and compassion.
            </p>
            <p>
              A Handful of Leaves brings together teachings from across Buddhist traditions, organized by what each helps us understand and practice. It gives our community a shared way to explore those teachings and their relationship to CARE.
            </p>
            <p>
              For example, teachings about change help us explore <Link href="/care#recognize">Recognize</Link>: seeing a feeling honestly and understanding that it arises through conditions and can change. Teachings on compassion inform how we <Link href="/care#engage">Engage</Link>: caring for ourselves and others through our choices and actions. Study returns us to the experience these ordinary words invite us to know.
            </p>
            <p>
              There is a written community introduction that describes how A Handful of Leaves is organized. To ask for it or learn about current opportunities to study, contact <a href="mailto:support@rootedinmindfulness.org?subject=A%20Handful%20of%20Leaves">support@rootedinmindfulness.org</a>. You can practice CARE deeply without adopting a Buddhist identity or mastering traditional vocabulary; studying these roots offers further ways to explore that same practice.
            </p>
            <h2>Informed by modern understanding</h2>
            <p>
              Our teaching is also informed by mindfulness-based programs, psychology, and modern science. Years of teaching Mindfulness-Based Stress Reduction have helped shape how we introduce meditation and connect it with everyday life. CARE brings this experience of teaching into conversation with the Buddhist roots described here.
            </p>
            <h2>Practicing together, living with care</h2>
            <p>
              People come with different interests and histories of practice. Guided meditation, teaching, reflection, and conversation help us explore CARE together. Foundations of Mindful Living is a planned introduction to this shared approach. Our ongoing gatherings offer ways to practice now and continue learning over time.
            </p>
            <p>
              We bring the difficulties and discoveries of daily life into our learning together, then carry what we learn back into our relationships and responsibilities. The practice continues in how we listen, the decisions we make, and the care we give to the world around us.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/care" className="pp-btn">
              Taking Care: our shared practice
            </Link>
            <Link href="/programs/meditation-and-dharma-talk" className="pp-btn pp-btn--ghost">
              Come to Meditation and Dharma Talk
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
