import Link from "next/link";

export const metadata = {
  title: "Diverse Together — Rooted In Mindfulness",
  description:
    "Rooted In Mindfulness honors the inherent beauty and wisdom found in the rich tapestry of human diversity. Come as you are.",
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
            We honor the inherent beauty and wisdom found in the rich tapestry of human
            diversity. Please, come as you are.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <h2>Honoring Diversity</h2>
            <p>
              At Rooted In Mindfulness (RIM), we honor the inherent beauty and wisdom found in the
              rich tapestry of human diversity. Our community thrives when individuals from all walks
              of life come together to support, encourage, and inspire one another on the path of
              self-discovery and spiritual growth. We believe that cultivating an environment of
              inclusivity, understanding, and mutual respect fosters harmony and deepens our
              collective wisdom.
            </p>

            <h2>Diversity is Healthy and Beautiful</h2>
            <p>
              As a community grounded in the principles of Buddhist teachings, we are committed to
              upholding the values of compassion, empathy, and open-mindedness. We recognize that our
              strength lies in embracing the unique perspectives and experiences of each individual,
              transcending boundaries of race, ethnicity, gender, sexual orientation, socio-economic
              status, age, ability, and spiritual tradition.
            </p>

            <h2>Co-Creating a Welcoming Space</h2>
            <p>
              RIM strives to create a welcoming space for all, where the essence of Buddhist wisdom
              is shared in a universal, inclusive manner. Our teachings are informed by science, free
              of dogma, and relevant to people from all backgrounds. We encourage open dialogue and
              the exchange of ideas, as we believe that diversity of thought enriches our
              understanding and fuels our growth as a community.
            </p>

            <h2>Supporting Health and Well-being</h2>
            <p>
              In our pursuit of collective awakening, we are dedicated to supporting the health and
              well-being of all who seek solace, guidance, and connection within our community. We
              acknowledge the challenges that life may present, and we strive to provide a nurturing
              environment where individuals can find healing, empowerment, and inner peace.
            </p>

            <h2>A Shared Journey</h2>
            <p>
              Together, we embark on a journey of self-discovery and transformation, fostering a
              deeper connection with ourselves, others, and the world around us. RIM is devoted to
              embodying the bodhisattva way of being, as we cultivate compassion, wisdom, and
              loving-kindness in our daily lives.
            </p>

            <h2>Please, Come as You Are</h2>
            <p>
              We invite you to join us, just as you are, in this shared endeavor to create a kinder,
              more compassionate, and enlightened world. May our collective efforts bring happiness,
              peace, and well-being to all beings.
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
