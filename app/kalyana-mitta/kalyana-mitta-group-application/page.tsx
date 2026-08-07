import { auth } from "@/auth";
import { sendKalyanaApplicationEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Kalyana Mitta Group Application — Rooted In Mindfulness",
  description:
    "Any member of RIM can start a Kalyana Mitta group or community activity. Tell us about your idea and we'll help you get it going.",
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
    await sendKalyanaApplicationEmail({
      firstName: formData.get("firstName") as string,
      lastName:  formData.get("lastName") as string,
      email:     formData.get("email") as string,
      idea:      formData.get("idea") as string,
    });
    redirect("/kalyana-mitta/kalyana-mitta-group-application?submitted=true");
  }

  return (
    <div className="pp-page">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Kalyana Mitta</p>
          <h1 className="pp-hero__title">
            Interested in starting a group, event, or activity?
          </h1>
          <p className="pp-hero__body">
            Any member of RIM can start a Kalyana Mitta group or community activity.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-prose">
            <p>
              Dharma practice is a whole-life practice. Therefore, the possible focus and intentions
              for forming a group or planning an event are countless. Some groups have a single
              purpose, such as right speech, dharma study, recovery, affinity, or community service,
              to name a few. Other KM Groups more generally address keeping the practice alive and
              fresh in one&rsquo;s daily life and supporting each other in this intention.
            </p>
            <p>
              Kalyana Mitta Groups are a wonderful way to connect with friends who share our
              intentions to deepen meditation and mindful living practices, and to feel encouraged
              and supported along the way.
            </p>
            <ul>
              <li>
                <strong>Do you have an idea for a KM group or event?</strong>
              </li>
              <li>
                <strong>Are you interested in planning or sustaining a group?</strong>
              </li>
            </ul>
            <p>
              We are here to help you get started, stay rooted in the living Dharma, and strengthen
              RIM&rsquo;s mission and vision. We will support you and the group as it is
              established, grows, and meets challenges.
            </p>
            <p>
              <em>
                Starting a Kalyana Mitta Group is a true act of generosity. On behalf of everyone at
                RIM, thank you!
              </em>
            </p>
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
                RIM community members are welcome to create a new Kalyana Mitta group. Membership is
                free — create an account or sign in, then return to this page and the form will be
                here.
              </p>
              <div className="pp-actions">
                <Link href="/join" className="pp-btn">
                  Become a member
                </Link>
                <Link href="/login" className="pp-link">
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
