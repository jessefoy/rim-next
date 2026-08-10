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
          {/* Membership and the word "community" are themselves intimidating;
              this section disarms that before the agreements teach anything.
              The reader's own objection ("will I have to be social?") is raised
              at the moment it occurs and answered with a real distinction. */}
          <section
            className="jn-panel__section"
            aria-labelledby="jn-meaning-heading"
          >
            <h2 id="jn-meaning-heading" className="jn-panel__heading">
              What membership means
            </h2>
            <p className="jn-panel__lead">
              Membership may not mean here what it has meant to you elsewhere. There are no dues;
              like everything at RIM, membership is freely offered. There is no attendance
              requirement and no role to fill, and nobody tracks how often you come. Joining says
              one thing: this is my practice community, and I would like a seat in it.
            </p>
            <p className="jn-panel__lead">
              If you are quiet by nature, you may be carrying the question many of us carried in:
              will I have to be social? You will not. The heart of what we do together is sitting in
              silence, side by side. Nobody will ask you to share, to mingle, or to be anyone other
              than the person who walked in. Some of the steadiest members of this community are
              also its quietest. Presence is enough.
            </p>
            <p className="jn-panel__lead">
              So why practice with others at all? Because the work of this path is inward, and it
              goes better in company. A room of settled people settles you. Other people&rsquo;s
              honest difficulties teach as much as their calm. And over time, without anyone forcing
              it, the people you sit beside become what the tradition warmly calls friends on the
              path. The Buddha&rsquo;s own attendant once guessed that such friendship must be half
              of the spiritual life. The Buddha corrected him: it is the whole of it.
            </p>
            <p className="jn-panel__lead">
              That is what we mean by community. Friends who support one another&rsquo;s practice:
              each of us releasing what gets in the way, each of us strengthening what serves, for
              our own lives and for the people and the world our lives touch.
            </p>
          </section>

          <hr className="jn-panel__divider" />

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
