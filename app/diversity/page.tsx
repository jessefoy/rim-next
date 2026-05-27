import Link from "next/link";

export const metadata = { title: "Diversity — Rooted In Mindfulness" };

export default function DiversityPage() {
  return (
    <div className="rim-main-section">
      <div className="content-container">
        <div className="diversity-content-box">
          <div className="w-richtext">
            <h2>Diverse Together</h2>
            <h5>
              <strong>
                <br />
                Honoring Diversity
              </strong>
            </h5>
            <p>
              At Rooted In Mindfulness (RIM), we honor the inherent beauty and wisdom found in the
              rich tapestry of human diversity. Our community thrives when individuals from all walks
              of life come together to support, encourage, and inspire one another on the path of
              self-discovery and spiritual growth. We believe that cultivating an environment of
              inclusivity, understanding, and mutual respect fosters harmony and deepens our
              collective wisdom.
            </p>
            <h5>
              <strong>Diversity is Healthy and Beautiful</strong>
            </h5>
            <p>
              As a community grounded in the principles of Buddhist teachings, we are committed to
              upholding the values of compassion, empathy, and open-mindedness. We recognize that
              our strength lies in embracing the unique perspectives and experiences of each
              individual, transcending boundaries of race, ethnicity, gender, sexual orientation,
              socio-economic status, age, ability, and spiritual tradition.
            </p>
            <h5>
              <strong>Co-Creating a Welcoming Space</strong>
            </h5>
            <p>
              RIM strives to create a welcoming space for all, where the essence of Buddhist wisdom
              is shared in a universal, inclusive manner. Our teachings are informed by science,
              free of dogma, and relevant to people from all backgrounds. We encourage open dialogue
              and the exchange of ideas, as we believe that diversity of thought enriches our
              understanding and fuels our growth as a community.
            </p>
            <h5>
              <strong>Supporting Health and Well-being</strong>
            </h5>
            <p>
              In our pursuit of collective awakening, we are dedicated to supporting the health and
              well-being of all who seek solace, guidance, and connection within our community. We
              acknowledge the challenges that life may present, and we strive to provide a nurturing
              environment where individuals can find healing, empowerment, and inner peace.
            </p>
            <h5>
              <strong>A Shared Journey</strong>
            </h5>
            <p>
              Together, we embark on a journey of self-discovery and transformation, fostering a
              deeper connection with ourselves, others, and the world around us. RIM is devoted to
              embodying the bodhisattva way of being, as we cultivate compassion, wisdom, and
              loving-kindness in our daily lives.
            </p>
            <h5>
              <strong>Please, Come as You Are</strong>
            </h5>
            <p>
              We invite you to join us, just as you are, in this shared endeavor to create a
              kinder, more compassionate, and enlightened world. May our collective efforts bring
              happiness, peace, and well-being to all beings.
            </p>
          </div>
          <Link href="/join" className="button-2 no-top-margin w-button">
            Join Us!
          </Link>
        </div>
      </div>
    </div>
  );
}
