import Link from "next/link";

export const metadata = {
  title: "Diverse Together — Rooted In Mindfulness",
  description:
    "Come as you are. Rooted in Mindfulness welcomes people of every race and ethnicity, gender and orientation, age, ability, income, and spiritual tradition, and people of no spiritual tradition at all.",
};

export default function DiversityPage() {
  return (
    <div className="pp-page">
      <section
        className="pp-hero"
        style={{
          ["--pp-hero-image" as string]: "url('/images/Community-Hands-on-Tree.jpg')",
          ["--pp-hero-position" as string]: "center 42%",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Our community</p>
          <h1 className="pp-hero__title">Diverse Together</h1>
          <p className="pp-hero__body">
            Come as you are. We mean it in the widest way it can be meant.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <p>
              This community is made of many kinds of people: different bodies, different histories,
              different ways of naming what is sacred, different reasons for walking in the door.
              That difference is not something we manage here. It is part of what we are made of. A
              room where different lives settle down together sees more than any one life sees
              alone, and every person who joins adds to what the rest of us can understand.
            </p>
            <p>
              The teachings are shared in plain language, without dogma, for people of every race
              and ethnicity, gender and orientation, age, ability, income, and spiritual tradition,
              and for people of no spiritual tradition at all. We name these because naming matters,
              and because some of us have been made to feel like visitors in rooms like this one. If
              that has been your experience, come and see. The seat was already yours.
            </p>
          </div>

          <div className="pp-actions pp-actions--center">
            <Link href="/join" className="pp-btn">
              Join Us
            </Link>
            <Link href="/community-programs" className="pp-link">
              See our programs <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
