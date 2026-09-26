import { auth } from "@/auth";
import { sendKalyanaApplicationEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Propose a Community Group — Rooted In Mindfulness",
  description:
    "Propose a community group or activity at RIM. Share your idea with the coordinator and discuss the next steps.",
};

export default async function KalyanaApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [session, { submitted }] = await Promise.all([auth(), searchParams]);
  const isLoggedIn = !!session;

  async function handleApplication(formData: FormData) {
    "use server";
    const member = await auth();
    if (!member?.user?.id) redirect("/login?returnTo=%2Fkalyana-mitta%2Fkalyana-mitta-group-application");
    await sendKalyanaApplicationEmail({
      firstName: formData.get("firstName") as string,
      lastName:  formData.get("lastName") as string,
      email:     formData.get("email") as string,
      idea:      formData.get("idea") as string,
    });
    redirect("/kalyana-mitta/kalyana-mitta-group-application?submitted=true");
  }

  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Community groups</p>
          <h1 className="pp-hero__title">
            Interested in starting a group, event, or activity?
          </h1>
          <p className="pp-hero__body">
            Any member of RIM can propose a community group or activity.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-prose">
            <p>Tell us the purpose of your group, who it would serve, and who might facilitate with you. The coordinator will discuss how the idea fits RIM before you make further plans.</p>
            <p>You do not need a finished plan to begin the conversation. For questions before using the form, email <a href="mailto:KalyanaMitta@rootedinmindfulness.org">KalyanaMitta@rootedinmindfulness.org</a>.</p>
          </div>

          <div className="pp-actions pp-actions--center">
            <Link
              href="/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group"
              className="pp-link"
            >
              Read the group guidelines first <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-intro pp-intro--center">
            <p className="pp-intro__eyebrow">The application</p>
            <h2 className="pp-intro__title pp-intro__title--h2">
              Tell us about your idea
            </h2>
          </div>

          {!isLoggedIn ? (
            <div className="pp-notice">
              <p className="pp-notice__title">You&rsquo;ll need an account for this form</p>
              <p className="pp-notice__body">
                Membership is freely offered. Create an account or sign in to return to this proposal form.
              </p>
              <div className="pp-actions">
                <Link href="/join?returnTo=%2Fkalyana-mitta%2Fkalyana-mitta-group-application" className="pp-btn">
                  Become a member
                </Link>
                <Link href="/login?returnTo=%2Fkalyana-mitta%2Fkalyana-mitta-group-application" className="pp-link">
                  I already have an account <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          ) : submitted ? (
            <div className="pp-form__done">
              <p>
                <strong>Thank you for your application.</strong> The Kalyana Mitta Coordinator will
                be in touch soon.
              </p>
            </div>
          ) : (
            <form action={handleApplication} className="pp-form">
              <p className="pp-form__help rim-information-use">Your contact details and proposal are sent to RIM for review and follow-up. Describe how the group could support practice and care in daily life; personal information about potential participants is not needed.</p>
              <div className="pp-form__row">
                <div className="pp-form__field">
                  <label className="pp-form__label" htmlFor="firstName">
                    First name
                  </label>
                  <input
                    className="pp-form__input"
                    maxLength={256}
                    name="firstName"
                    type="text"
                    id="firstName"
                    defaultValue={session.user?.name?.split(" ")[0] ?? ""}
                  />
                </div>
                <div className="pp-form__field">
                  <label className="pp-form__label" htmlFor="lastName">
                    Last name
                  </label>
                  <input
                    className="pp-form__input"
                    maxLength={256}
                    name="lastName"
                    type="text"
                    id="lastName"
                  />
                </div>
              </div>

              <div className="pp-form__field">
                <label className="pp-form__label" htmlFor="email">
                  Email address
                </label>
                <input
                  className="pp-form__input"
                  maxLength={256}
                  name="email"
                  type="email"
                  id="email"
                  defaultValue={session.user?.email ?? ""}
                  required
                />
              </div>

              <div className="pp-form__field">
                <label className="pp-form__label" htmlFor="idea">
                  Tell us about your idea for a Kalyana Mitta group at RIM
                </label>
                <textarea
                  id="idea"
                  name="idea"
                  maxLength={5000}
                  required
                  className="pp-form__textarea"
                />
              </div>

              <button type="submit" className="pp-btn pp-form__submit">
                Send application
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
