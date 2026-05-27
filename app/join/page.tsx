import { auth } from "@/auth";
import { redirect } from "next/navigation";
import JoinForm from "@/components/JoinForm";
import {
  COMMUNITY_AGREEMENTS,
  COMMUNITY_AGREEMENTS_LEAD_IN,
  JOIN_HERO_TITLE,
  JOIN_HERO_INTRO,
  JOIN_FORM_LEAD,
} from "@/lib/communityAgreements";

export const metadata = {
  title: "Become a member — Rooted In Mindfulness",
  description:
    "Join the Rooted In Mindfulness community. Read our four community care agreements and create your member account.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/account/dashboard");
  }

  // Accept a pre-filled email from /login's not-found soft-redirect (when a
  // visitor types an unknown email at /login, we route them here with their
  // email carried across so they don't have to retype it). Trim + cap
  // defensively — value lands in a server-rendered input attribute.
  const { email: emailRaw } = await searchParams;
  const prefillEmail =
    typeof emailRaw === "string" ? emailRaw.trim().slice(0, 256) : "";

  return (
    <div className="jn-page">
      <div className="jn-container">
        <header className="jn-hero">
          <h1 className="jn-hero__title">{JOIN_HERO_TITLE}</h1>
          <p className="jn-hero__intro">{JOIN_HERO_INTRO}</p>
        </header>

        <div className="jn-panel">
          <section
            className="jn-panel__section"
            aria-labelledby="jn-agreements-heading"
          >
            <h2 id="jn-agreements-heading" className="jn-panel__heading">
              Community Care Agreements
            </h2>
            <p className="jn-panel__lead">{COMMUNITY_AGREEMENTS_LEAD_IN}</p>
            <ol className="jn-agreements-list">
              {COMMUNITY_AGREEMENTS.map((a) => (
                <li key={a.title} className="jn-agreements-list__item">
                  <strong className="jn-agreements-list__title">{a.title}</strong>
                  <span className="jn-agreements-list__summary">{a.summary}</span>
                </li>
              ))}
            </ol>
          </section>

          <hr className="jn-panel__divider" />

          <section
            className="jn-panel__section"
            aria-labelledby="jn-form-heading"
          >
            <h3 id="jn-form-heading" className="jn-panel__subheading">
              Create your member account
            </h3>
            <p className="jn-panel__lead">{JOIN_FORM_LEAD}</p>
            <JoinForm defaultEmail={prefillEmail} />
          </section>
        </div>
      </div>
    </div>
  );
}
