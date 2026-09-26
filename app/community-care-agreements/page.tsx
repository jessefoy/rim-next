import { publicPageMetadata } from "@/lib/publicMetadata";
import { auth } from "@/auth";
import Link from "next/link";
import {
  COMMUNITY_AGREEMENTS,
  COMMUNITY_AGREEMENTS_LEAD_IN,
  COMMUNITY_SHARED_VISION_TITLE,
} from "@/lib/communityAgreements";

export const metadata = publicPageMetadata("Community Care Agreements — Rooted In Mindfulness", "How we care for ourselves, others, and the RIM community. Read our shared commitments and find a contact for questions or concerns.", "/community-care-agreements");

export const dynamic = "force-dynamic";

export default async function CommunityCareAgreementsPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user?.id;
  const hasAgreed = !!session?.user?.agreedToTerms;

  const closing = !isLoggedIn
    ? {
        title: "A place in this community is open to you.",
        body: "You can create a member account while you are getting to know RIM. There are no dues or attendance requirements. We ask you to take part in a spirit of care and respect.",
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
    <div className="pp-page pp-page--spine pp-page--column cc-page">
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
            <p className="pp-intro__body">
              <strong>{COMMUNITY_SHARED_VISION_TITLE}.</strong> {COMMUNITY_AGREEMENTS_LEAD_IN}
            </p>
            <p className="pp-intro__body">
              These agreements bring CARE into our relationships: listening when someone speaks,
              respecting a boundary, and taking responsibility when our actions cause harm.
              They apply to how we care for one another while learning and practicing together.
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
          <div className="pp-prose">
            <h2 id="concerns">When something needs attention</h2>
            <p>
              If you feel uncomfortable, excluded, or harmed at RIM, you can raise a concern at
              <a href="mailto:support@rootedinmindfulness.org?subject=A%20community%20concern"> support@rootedinmindfulness.org</a>
              {" "}or call <a href="tel:4148828932">(414) 882-8932</a> and leave a message.
              This is the center’s general contact, handled by volunteers.
            </p>
            <p>
              You can begin by asking who would receive your concern and how it would be handled,
              before deciding what personal details to share. You do not have to resolve a concern
              directly with the person involved before contacting RIM.
            </p>
          </div>
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
