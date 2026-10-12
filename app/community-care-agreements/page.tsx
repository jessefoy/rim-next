import { auth } from "@/auth";
import Link from "next/link";
import {
  CARE_REPAIR_ACTION,
  CARE_REPAIR_BODY,
  CARE_REPAIR_HREF,
  CARE_REPAIR_TITLE,
  COMMUNITY_AGREEMENTS,
  COMMUNITY_AGREEMENTS_LEAD_IN,
  COMMUNITY_SHARED_VISION_TITLE,
} from "@/lib/communityAgreements";

export const metadata = {
  title: "Community Care Agreements - Rooted In Mindfulness",
  description:
    "The shared vision and the care agreements that guide how members of Rooted In Mindfulness care for themselves, one another, and RIM.",
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
          action: "Back to My Home",
        };

  return (
    <div className="pp-page pp-page--spine pp-page--column cc-page">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <h1 className="pp-hero__title">Community Care Agreements</h1>
          <p className="pp-hero__body">
            A shared vision, and three agreements about how we care for ourselves, one
            another, and RIM. Everyone who practices here holds them.
          </p>
        </div>
      </section>

      <section className="pp-section">
        <div className="rim-container">
          <div className="pp-intro cc-intro">
            <h2 className="pp-intro__title">A community we make together.</h2>
            <p className="pp-intro__body">
              <strong>{COMMUNITY_SHARED_VISION_TITLE}.</strong> {COMMUNITY_AGREEMENTS_LEAD_IN}
            </p>
          </div>

          <ol className="cc-agreements">
            {COMMUNITY_AGREEMENTS.map((agreement, index) => (
              <li key={agreement.title} className="cc-agreement">
                <span className="cc-agreement__number" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3 className="cc-agreement__title">{agreement.title}</h3>
                  <p className="cc-agreement__body">{agreement.summary}</p>
                </div>
              </li>
            ))}
          </ol>

          <section className="cc-repair" aria-labelledby="cc-repair-title">
            <h2 id="cc-repair-title" className="cc-repair__title">{CARE_REPAIR_TITLE}</h2>
            <p className="cc-repair__body">{CARE_REPAIR_BODY}</p>
            <div className="pp-actions">
              <Link href={CARE_REPAIR_HREF} className="pp-btn pp-btn--ghost">
                {CARE_REPAIR_ACTION} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>
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
