import { authReturnPath, authCallbackPath } from "@/lib/authReturn";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import JoinForm from "@/components/JoinForm";
import {
  COMMUNITY_AGREEMENTS,
  COMMUNITY_AGREEMENTS_LEAD_IN,
  COMMUNITY_SHARED_VISION_TITLE,
  JOIN_HERO_TITLE,
  JOIN_HERO_INTRO,
  JOIN_FORM_LEAD,
} from "@/lib/communityAgreements";

export const metadata = {
  title: "Become a member — Rooted In Mindfulness",
  description:
    "Join the Rooted In Mindfulness community. Read our shared vision and community care agreements and create your member account.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; returnTo?: string }>;
}) {
  const { email: emailRaw, returnTo: requestedReturn } = await searchParams;
  const returnTo = authReturnPath(requestedReturn);
  const session = await auth();
  if (session?.user?.id) {
    redirect(authCallbackPath(returnTo));
  }

  // Accept a pre-filled email from /login's not-found soft-redirect (when a
  // visitor types an unknown email at /login, we route them here with their
  // email carried across so they don't have to retype it). Trim + cap
  // defensively — value lands in a server-rendered input attribute.
  const prefillEmail =
    typeof emailRaw === "string" ? emailRaw.trim().slice(0, 256) : "";

  return (
    /*
     * Session 176: this page joined the pp- grammar. It had been the clearest
     * case of the site changing identity at the moment of commitment — a 38px
     * dark heading at x=300 with no hero, 15px grey body copy for the most
     * important reading RIM asks anyone to do, and a 4px-radius submit against
     * the rim-blue pill every other page uses. The words are unchanged; only
     * the surfaces carrying them are.
     */
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">A seat in the community</p>
          <h1 className="pp-hero__title">{JOIN_HERO_TITLE}</h1>
          <p className="pp-hero__body">{JOIN_HERO_INTRO}</p>
        </div>
      </section>

      <section className="pp-section" aria-labelledby="jn-meaning-heading">
        <div className="rim-container">
          {/* Membership and the word "community" are themselves intimidating;
              this section disarms that before the agreements teach anything.
              The reader's own objection ("will I have to be social?") is raised
              at the moment it occurs and answered with a real distinction. */}
          <div className="pp-prose">
            <h2 id="jn-meaning-heading">What membership means</h2>
            <p>
              Membership gives you an account for online gatherings and program registration.
              There are no dues or attendance requirements. You can come for one gathering and
              decide what feels useful. You do not need to identify as Buddhist.
            </p>
            <p>
              Our community includes people who enjoy conversation and people who prefer to sit
              in silence. You can take your time getting to know others. Individual programs describe
              any discussion or sharing that is part of their practice.
            </p>
            <p>
              We ask everyone to practice care and respect for one another. The shared vision below
              describes what guides RIM; the agreements describe how we take part together.
            </p>
          </div>
        </div>
      </section>

      <section
        className="pp-section pp-section--tight"
        id="community-care-agreements"
        aria-labelledby="jn-agreements-heading"
      >
        <div className="rim-container">
          <div className="pp-prose">
            <h2 id="jn-agreements-heading">Community Care Agreements</h2>
            <p>
              <strong>{COMMUNITY_SHARED_VISION_TITLE}.</strong> {COMMUNITY_AGREEMENTS_LEAD_IN}
            </p>
          </div>
          <ol className="jn-agreements-list">
            {COMMUNITY_AGREEMENTS.map((a) => (
              <li key={a.title} className="jn-agreements-list__item">
                <strong className="jn-agreements-list__title">{a.title}</strong>
                <span className="jn-agreements-list__summary">{a.summary}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pp-section pp-section--last" aria-labelledby="jn-form-heading">
        <div className="rim-container">
          <div className="pp-form">
            <h2 id="jn-form-heading" className="jn-form__heading">
              Create your member account
            </h2>
            <p className="jn-form__lead">{JOIN_FORM_LEAD}</p>
            <JoinForm defaultEmail={prefillEmail} returnTo={returnTo} />
          </div>
        </div>
      </section>
    </div>
  );
}
