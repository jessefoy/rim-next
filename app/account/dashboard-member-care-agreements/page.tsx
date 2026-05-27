import AccountLayout from "@/components/AccountLayout";

export const metadata = { title: "Community Care Agreements — Rooted In Mindfulness" };

const AGREEMENTS = [
  {
    title: "1. Care for Yourself",
    body: "Meditation and mindful living allow us to transform unhealthy patterns of the heart and mind, helping us realize authentic health, well-being, meaning, and happiness. While a community, teachers, and supportive friends can be powerful allies on the path of awakening, growth, and transformation, it is ultimately up to each of us to take the necessary steps along the journey.",
  },
  {
    title: "2. Care for Others",
    body: "The work of self-discovery and development can be challenging to undertake alone. Being part of a loving community where each member genuinely cares for one another\u2019s well-being offers a true refuge. Showing up and sharing an intentional space to learn and practice with friends is immeasurably beneficial for both ourselves and our shared world.",
  },
  {
    title: "3. Care for RIM: Our Shared Refuge",
    body: "RIM is co-created through the generosity, goodwill, and appreciation of its community. As a living expression of generosity, RIM is 100% community-funded and entirely dependent on donations. These donations cover all operating costs, contribute to teacher livelihoods, and maintain the building. RIM does not charge fixed fees. Instead, we ask that all members contribute to the financial health of our precious center with an ongoing donation amount (RIM Dana) that feels right to them.",
  },
  {
    title: "4. Care for Our Shared Mission and Vision",
    body: "RIM is a community refuge that welcomes individuals while creating opportunities for mutual support and friendship. Members of RIM are dedicated to learning and practicing the dharma, meditation, and mindful living. We do this to understand ourselves, others, and the world, aiming to free ourselves from unhealthy and harmful thoughts, words, and actions in order to realize our shared vision \u2014 a world where all beings live with great wisdom and great compassion.",
  },
];

export default function MemberCareAgreementsPage() {
  return (
    <AccountLayout>
    <div className="page-wrapper">
      <div className="lp-content mc-page">
        <h1 className="mc-heading">Community Care Agreements</h1>
        <p className="mc-intro">
          At Rooted In Mindfulness, we strive to create a culture that is deeply intentional,
          accepting, easygoing, and friendly. These four shared intentions enable us to co-create
          a refuge for deep learning, practice, and friendship.
        </p>

        {AGREEMENTS.map((a) => (
          <div key={a.title} className="mc-agreement">
            <h2 className="mc-agreement__title">{a.title}</h2>
            <p className="mc-agreement__body">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
    </AccountLayout>
  );
}
