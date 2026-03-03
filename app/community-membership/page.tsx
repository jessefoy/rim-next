import Link from "next/link";

export const metadata = { title: "Community Care Agreements — Rooted In Mindfulness" };

export default function CommunityMembershipPage() {
  return (
    <div className="section background-white">
      <div className="container-7">
        <div className="container-home-page">
          <div className="flex-stack-center top">
            <div className="container-10">

              <div className="section-content content-info">
                <h2>Community Care Agreements</h2>
                <p className="section-text-3">
                  Rooted In Mindfulness is a refuge we create together — a place for learning,
                  practice, and genuine friendship. Everyone is welcome, from all backgrounds and
                  phases of life. We ask everyone who joins to hold these four shared intentions.
                  They are the foundation of the trust, care, and openness that makes this
                  community possible.
                </p>
              </div>

              <div className="program-details-content no-bottom-margin">
                <div className="rich-text-block-15 w-richtext">
                  <h5>
                    <strong>1. Care for Yourself</strong>
                  </h5>
                  <p>
                    Meditation and mindful living allow us to transform unhealthy patterns of the
                    heart and mind, helping us realize authentic health, well-being, meaning, and
                    happiness. While a community, teachers, and supportive friends can be powerful
                    allies on the path of awakening, growth, and transformation, it is ultimately up
                    to each of us to take the necessary steps along the journey.
                  </p>
                  <h5>
                    <strong>2. Care for Others</strong>
                  </h5>
                  <p>
                    The work of self-discovery and development can be challenging to undertake alone.
                    Being part of a loving community where each member genuinely cares for one
                    another&apos;s well-being offers a true refuge. Showing up and sharing an
                    intentional space to learn and practice with friends is immeasurably beneficial
                    for both ourselves and our shared world.
                  </p>
                  <h5>
                    <strong>3. Care for RIM: Our Shared Refuge</strong>
                  </h5>
                  <p>
                    RIM is co-created through the generosity, goodwill, and appreciation of its
                    community. As a living expression of generosity, RIM is 100% community-funded
                    and entirely dependent on donations. These donations cover all operating costs,
                    contribute to teacher livelihoods, and maintain the building.
                  </p>
                  <p>
                    RIM does not charge fixed &quot;fees.&quot; Instead, we ask that all members
                    contribute to the financial health of our precious center with an ongoing
                    donation amount (RIM Dana) that feels right to them. When deciding on ongoing
                    financial support, please be mindful of what stirs in your heart, your financial
                    ability, and the value the RIM community and teachings have in your life.
                  </p>
                  <h5>
                    <strong>4. Care for Our Shared Mission and Vision</strong>
                  </h5>
                  <p>
                    RIM is a community refuge that welcomes individuals while creating opportunities
                    for mutual support and friendship. Members of RIM are dedicated to learning and
                    practicing the dharma, meditation, and mindful living. We do this to understand
                    ourselves, others, and the world, aiming to free ourselves from unhealthy and
                    harmful thoughts, words, and actions in order to realize our shared vision. This
                    vision encompasses a world where all beings live with great wisdom and great
                    compassion.
                  </p>
                </div>
              </div>

              <div className="sign-up-box" style={{ marginTop: "2.5rem", textAlign: "center" }}>
                <p className="paragraph-19" style={{ marginBottom: "1rem" }}>
                  If these intentions resonate with you, we&apos;d be honored to have you join us.
                </p>
                <Link href="/login" className="link-block-3 w-button">
                  Join or sign in →
                </Link>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
