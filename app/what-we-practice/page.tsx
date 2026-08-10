import Link from "next/link";

export const metadata = {
  title: "A Handful of Leaves — Rooted In Mindfulness",
  description:
    "What we practice at Rooted in Mindfulness, and why it has that name. Buddhist wisdom gathered from across the traditions, offered so that anyone can use it. Insight meditation and mindfulness practice in Brookfield, Wisconsin.",
};

/**
 * /what-we-practice — the page that answers what RIM is.
 *
 * Deliberately pure prose on the ground (`pp-prose`, never boxed): it earns its
 * length by being the only long-form reading a curious visitor meets, and the
 * `sparse ≠ minimal` tombstone in RIM_Public_Pages.md rules out dressing it in
 * card scaffolding it doesn't need.
 *
 * Nav label is "Our Practice" (the bar is tight); the page keeps its own title.
 *
 * When the community introduction is ratified and published, this page gets one
 * closing line linking to it, for readers who want the full story.
 */
export default function WhatWePracticePage() {
  return (
    <div className="pp-page">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">What we practice</p>
          <h1 className="pp-hero__title">A Handful of Leaves</h1>
          <p className="pp-hero__body">What we practice, and why it has that name.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <p>
              One afternoon, some twenty-five centuries ago, the Buddha was walking with his
              students through a forest. He bent down, gathered a few fallen leaves into his hand,
              and asked them: which are more numerous, the leaves in my hand, or the leaves in the
              forest above us? The answer was obvious, and so was the point. He told them: what I
              have come to understand is vast, like the forest. What I teach is this handful. Only
              what helps. Only what leads onward.
            </p>
            <p>
              Our practice takes its name from that afternoon. From the vast forest of the Buddhist
              traditions, honored as one living family, we gather a handful: the teachings and
              practices that have proven, over many centuries and in our own lives, to help a person
              suffer less, see more clearly, and love more capably. That is the whole test for what
              belongs. We are not a center of one school or one method, and the handful replaces
              nothing and ranks nothing; the great traditions are complete in themselves, and we
              gather from them with gratitude. The spirit that holds it all is simple: settle first,
              see clearly, and let what you find become how you live.
            </p>
            <p>
              And the handful is for anyone. Buddhist, secular, spiritual, or undecided: the door is
              the same, and so is the depth. What we share is informed by modern science, lived
              experience, and the world&rsquo;s wisdom traditions, and it will feel familiar if you
              came to meditation through a mindfulness course, a class at work, or an app. Those
              doors are real doors; they led you here. Whatever true thing you carry from elsewhere
              keeps its honored place, and nothing you find here will ask you to believe anything.
              It will ask you to look.
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
