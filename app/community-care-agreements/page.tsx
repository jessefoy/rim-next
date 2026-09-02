import { auth } from "@/auth";
import Link from "next/link";
import {
  COMMUNITY_AGREEMENTS,
  COMMUNITY_AGREEMENTS_LEAD_IN,
} from "@/lib/communityAgreements";

export const metadata = {
  title: "Community Care Agreements — Rooted In Mindfulness",
  description:
    "The four shared intentions that guide how members of Rooted In Mindfulness care for themselves, one another, RIM, and our shared vision.",
};

export const dynamic = "force-dynamic";

export default async function CommunityCareAgreementsPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user?.id;
  const hasAgreed = !!session?.user?.agreedToTerms;

  const closing = !isLoggedIn
    ? {
        title: "A place in this community is open to you.",
        body: "If you can hold these intentions with us, we would be honored to have you.",
        href: "/join#community-care-agreements",
        action: "Become a member",
      }
    : !hasAgreed
      ? {
          title: "Complete your welcome.",
          body: "Take a moment to confirm these intentions and step into your member home.",
          href: "/account/welcome",
          action: "Complete your welcome",
        }
      : {
          title: "These are the intentions we share.",
          body: "They are not a promise of perfection. They are a way to return to ourselves, to one another, and to the community we keep together.",
          href: "/account/dashboard",
          action: "Return to My RIM",
        };

  return (
    <div className="pp-page cc-page">
      <section
        className="pp-hero"
        style={{
          ["--pp-hero-image" as string]: "url('/images/Community-Hands-on-Tree.jpg')",
          ["--pp-hero-position" as string]: "center 48%",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <h1 className="pp-hero__title">Community Care Agreements</h1>
          <p className="pp-hero__body">
            RIM is not held by one person or a building. It is held by how we care for
            ourselves, one another, this community, and the life our practice touches.
          </p>
        </div>
      </section>

      <section className="pp-section">
        <div className="rim-container">
          <div className="pp-intro cc-intro">
            <h2 className="pp-intro__title">A community we make together.</h2>
            <p className="pp-intro__body">{COMMUNITY_AGREEMENTS_LEAD_IN}</p>
            <p className="pp-intro__body">
              And the care runs both ways. Held together, these intentions become the
              refuge itself: a shelter we build and rest in at the same time.
            </p>
          </div>

          <ol className="cc-agreements">
            {COMMUNITY_AGREEMENTS.map((agreement, index) => (
              <li key={agreement.title} className="cc-agreement">
                <span className="cc-agreement__number" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h2 className="cc-agreement__title">{agreement.title}</h2>
                  <p className="cc-agreement__body">{agreement.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pp-section pp-section--white pp-section--last">
        <div className="rim-container">
          <aside className="pp-closing">
            <div>
              <h2 className="pp-closing__title">{closing.title}</h2>
              <p className="pp-closing__body">{closing.body}</p>
            </div>
            <Link href={closing.href} className="pp-btn pp-closing__link">
              {closing.action} <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
}
