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
    /*
     * Session 176: this page joined the pp- grammar. It had been the clearest
     * case of the site changing identity at the moment of commitment — a 38px
     * dark heading at x=300 with no hero, 15px grey body copy for the most
     * important reading RIM asks anyone to do, and a 4px-radius submit against
     * the rim-blue pill every other page uses. The words are unchanged; only
     * the surfaces carrying them are.
     */
    <div className="pp-page pp-page--spine">
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
              Membership may not mean here what it has meant to you elsewhere. There are no dues;
              like everything at RIM, membership is freely offered. There is no attendance
              requirement and no role to fill, and nobody tracks how often you come. Joining says
              one thing: this is my practice community, and I would like a seat in it.
            </p>
            <p>
              If you are quiet by nature, you may be carrying the question many of us carried in:
              will I have to be social? You will not. The heart of what we do together is sitting in
              silence, side by side. Nobody will ask you to share, to mingle, or to be anyone other
              than the person who walked in. Some of the steadiest members of this community are
              also its quietest. Presence is enough.
            </p>
            <p>
              So why practice with others at all? Because the work of this path is inward, and it
              goes better in company. A room of settled people settles you. Other people&rsquo;s
              honest difficulties teach as much as their calm. And over time, without anyone forcing
              it, the people you sit beside become what the tradition warmly calls friends on the
              path. The Buddha&rsquo;s own attendant once guessed that such friendship must be half
              of the spiritual life. The Buddha corrected him: it is the whole of it.
            </p>
            <p>
              That is what we mean by community. Friends who support one another&rsquo;s practice:
              each of us releasing what gets in the way, each of us strengthening what serves, for
              our own lives and for the people and the world our lives touch.
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
            <p>{COMMUNITY_AGREEMENTS_LEAD_IN}</p>
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
            <JoinForm defaultEmail={prefillEmail} />
          </div>
        </div>
      </section>
    </div>
  );
}
