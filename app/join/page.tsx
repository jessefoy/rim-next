import { auth } from "@/auth";
import { redirect } from "next/navigation";
import JoinForm from "@/components/JoinForm";
import { COMMUNITY_AGREEMENTS_SHORT } from "@/lib/communityAgreements";

export const metadata = {
  title: "Become a member — Rooted In Mindfulness",
  description:
    "Join the Rooted In Mindfulness community. Read our four community care agreements and create your member account.",
};

export default async function JoinPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/account/dashboard");
  }

  return (
    <div className="jn-page">
      <div className="jn-container">
        <header className="jn-hero">
          <h1 className="jn-hero__title">Become a member</h1>
          <p className="jn-hero__subtitle">
            We&apos;re glad you&apos;re considering it. Take a moment with our four
            community care agreements; if they feel like home, we&apos;d be
            honored to have you.
          </p>
        </header>

        <section className="jn-agreements" aria-labelledby="jn-agreements-heading">
          <h2 id="jn-agreements-heading" className="jn-agreements__heading">
            Community Care Agreements
          </h2>
          <p className="jn-agreements__lead">
            We ask members to hold these four shared intentions, which together
            create a safe and supportive environment for all.
          </p>
          <div className="jn-agreements__grid">
            {COMMUNITY_AGREEMENTS_SHORT.map((a) => (
              <article key={a.title} className="jn-card">
                <h3 className="jn-card__title">{a.title}</h3>
                <p className="jn-card__body">{a.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="jn-formwrap" aria-labelledby="jn-form-heading">
          <h2 id="jn-form-heading" className="jn-formwrap__heading">
            Create your member account
          </h2>
          <p className="jn-formwrap__lead">
            If these intentions resonate with you, we&apos;d be honored to have
            you join us. After you submit, we&apos;ll send a 6-digit code to
            your email to confirm — no password needed.
          </p>
          <JoinForm />
        </section>
      </div>
    </div>
  );
}
