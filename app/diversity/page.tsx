import Link from "next/link";

export const metadata = {
  title: "Diverse Together — Rooted In Mindfulness",
  description:
    "Come as you are. RIM is a sangha brought together by learning and practice, with diversity that deepens the life and understanding of the whole community.",
};

export default function DiversityPage() {
  return (
    <div className="pp-page">
      <section
        className="pp-hero pp-hero--diversity"
        style={{
          ["--pp-hero-image" as string]: "url('/images/color-powder-diversity.webp')",
          ["--pp-hero-position" as string]: "center 52%",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Our community</p>
          <h1 className="pp-hero__title">Diverse Together</h1>
          <p className="pp-hero__body">Come as you are. We mean it.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="dv-layout">
            <div className="dv-layout__lead">
              <p className="dv-layout__title">
                <em>Many lives, one sangha.</em>
              </p>
              <p className="dv-layout__statement">
                <em>
                  Everyone here came from somewhere different. What we share is the direction.
                </em>
              </p>
            </div>

            <div className="dv-layout__body">
              <section className="dv-layout__section">
                <h2 className="dv-layout__section-title">What brings us together</h2>
                <p>
                  What brings us together at RIM is simple, and it is shared: learning and
                  practice. Our aspiration is old and it is large: to suffer less, to see more
                  clearly, and to love more capably. To be free of what burdens the heart, and to
                  help others be free of it too.
                </p>
                <p>
                  So we practice, releasing what gets in the way of our well-being and our innate
                  goodness, cultivating what nourishes them, and letting the benefit reach past us,
                  to the people we love and the world we share.
                </p>
                <p>
                  Wisdom and compassion are the heart of it. The old word for a community like
                  this is sangha, one of the tradition&rsquo;s three refuges: a shelter we create
                  by practicing in it together. That shared aspiration is our bond.
                </p>
              </section>

              <section className="dv-layout__section">
                <h2 className="dv-layout__section-title">Many kinds of people</h2>
                <p>
                  Everything else about us differs, and we are glad it does. This community holds
                  different generations and backgrounds, different beliefs and politics,
                  different reasons for walking in the door.
                </p>
                <p>
                  Difference, in a room like this, works like medicine. Another life is a way of
                  seeing beyond our own, and each person who joins changes what the whole community
                  can understand. Whoever you are, you add to both: to the aspiration we share, and
                  to the diversity that deepens it.
                </p>
                <p>
                  And not all of it can be seen. We differ in temperament too: some of us at ease
                  in any gathering, some quiet by nature, some unsure that belonging to a
                  community is something we can do.
                </p>
                <p>
                  That is diversity as well, and a sangha needs all of it. No one here will ask
                  you to speak, share, or be anyone in particular. Come learn and practice in the
                  way that fits you. Presence is enough.
                </p>
              </section>

              <section className="dv-layout__section">
                <h2 className="dv-layout__section-title">Room to grow</h2>
                <p>
                  Practice will ask all of us to grow. It will never ask you to become someone
                  else. What grows is authenticity: ourselves, more fully, held more lightly.
                </p>
                <p>
                  The same is true of this community. We do not claim to have arrived at some
                  ideal of diversity. There is no final version of a community, any more than
                  there is of a person.
                </p>
                <p>
                  Everything alive keeps changing, and on this path that is good news. So we are
                  always becoming a community where more people can feel fully at home. Come as
                  you are, and help us become it.
                </p>
              </section>

              <section className="dv-layout__section">
                <h2 className="dv-layout__section-title">A welcome we keep together</h2>
                <p>
                  The teachings here are shared without dogma, for people of every race and
                  ethnicity, gender and orientation, age, ability, income, political affiliation,
                  and spiritual tradition, and for people of no spiritual tradition at all.
                </p>
                <p>
                  We name these because naming matters, and because some of us have been made to
                  feel like visitors in rooms like this one. If that has been your experience,
                  come and see. The seat was already yours.
                </p>
              </section>

              <p className="dv-layout__care">
                Words alone do not hold a welcome. Ours is held by shared agreement: our{" "}
                <Link href="/community-care-agreements">Community Care Agreements</Link>, the
                intentions of care that every member keeps.
              </p>

              <p className="dv-layout__blessing">
                <em>
                  May our practice together bring happiness, peace, and well-being to all beings.
                </em>
              </p>

              <div className="pp-actions">
                <Link href="/join" className="pp-btn">
                  Join us
                </Link>
                <Link href="/community-programs" className="pp-link">
                  See our programs <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
