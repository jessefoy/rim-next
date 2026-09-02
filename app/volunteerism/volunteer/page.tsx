import { auth } from "@/auth";
import { sendVolunteerInterestEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Volunteer — Rooted In Mindfulness",
  description:
    "Offer a gift of time and talent at Rooted In Mindfulness. Browse current volunteer needs or tell us about your interests.",
};

export default async function VolunteerPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [session, { submitted }] = await Promise.all([auth(), searchParams]);
  const isLoggedIn = !!session;

  async function handleVolunteerForm(formData: FormData) {
    "use server";
    await sendVolunteerInterestEmail({
      firstName: formData.get("firstName") as string,
      lastName:  formData.get("lastName") as string,
      email:     formData.get("email") as string,
      phone:     formData.get("phone") as string | null,
      interests: formData.get("interests") as string,
    });
    redirect("/volunteerism/volunteer?submitted=true");
  }

  return (
    <div className="pp-page">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section
        className="pp-hero"
        style={{
          ["--pp-hero-image" as string]: "url('/images/Community-Hands-on-Tree.jpg')",
          ["--pp-hero-position" as string]: "center 55%",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Embodied generosity</p>
          <h1 className="pp-hero__title">Become a Volunteer</h1>
          <p className="pp-hero__body">
            If you&rsquo;d like to offer a gift of time and talent, you&rsquo;re welcome to browse
            current volunteer opportunities at RIM. If the listed needs are not a good fit for you,
            tell us about your interests and talents and we&rsquo;ll reach out if something opens up.
          </p>
          <div className="pp-hero__actions">
            <a href="#current-openings" className="pp-btn pp-btn--onblue">
              Current needs
            </a>
            <a href="#share-your-talent" className="pp-hero__link">
              Share your talent <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── Quote ─────────────────────────────────────────── */}
      <section className="pp-section pp-section--tight">
        <div className="rim-container">
          <blockquote className="pp-quote">
            <p className="pp-quote__text">
              &ldquo;The best way to find yourself is to lose yourself in the service of others.&rdquo;
            </p>
            <footer className="pp-quote__attr">Mahatma Gandhi</footer>
          </blockquote>
        </div>
      </section>

      {/* ── Current needs ─────────────────────────────────── */}
      <section id="current-openings" className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-intro pp-intro--center">
            <p className="pp-intro__eyebrow">Where help is needed</p>
            <h2 className="pp-intro__title">Current volunteer needs</h2>
            <p className="pp-intro__body">
              RIM runs on the generosity of the people who practice here: greeting people at the
              door, hosting a Zoom room, caring for the plants, running sound. Roles open and fill
              as the community&rsquo;s needs change.
            </p>
          </div>

          <div className="pp-panel">
            <p className="pp-panel__body">
              We&rsquo;re between postings at the moment. The fastest way in is to tell us what
              you&rsquo;d enjoy doing. We keep those notes and reach out when something fits.
            </p>
            <div className="pp-actions">
              <a href="#share-your-talent" className="pp-btn">
                Tell us your interests
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Share your talent ─────────────────────────────── */}
      <section id="share-your-talent" className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-intro pp-intro--center">
            <p className="pp-intro__eyebrow">Share your talent</p>
            <h2 className="pp-intro__title pp-intro__title--h2">
              Tell us about your interests
            </h2>
            <p className="pp-intro__body">
              We&rsquo;ll reach out when we have something that fits what you enjoy.
            </p>
          </div>

          {!isLoggedIn ? (
            <div className="pp-notice">
              <p className="pp-notice__title">You&rsquo;ll need an account for this form</p>
              <p className="pp-notice__body">
                Membership is freely offered. Create an account or sign in, then come back to this
                page and the form will be here.
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
                <strong>Thank you.</strong> Your note has been received. Someone from RIM will be
                in touch.
              </p>
            </div>
          ) : (
            <form action={handleVolunteerForm} className="pp-form">
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
                    required
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
                    required
                  />
                </div>
              </div>

              <div className="pp-form__row">
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
                  <label className="pp-form__label" htmlFor="phone">
                    Phone number
                  </label>
                  <input
                    className="pp-form__input"
                    maxLength={256}
                    name="phone"
                    type="tel"
                    id="phone"
                  />
                  <p className="pp-form__help">Optional.</p>
                </div>
              </div>

              <div className="pp-form__field">
                <label className="pp-form__label" htmlFor="interests">
                  My interests and talents
                </label>
                <textarea
                  name="interests"
                  maxLength={5000}
                  id="interests"
                  className="pp-form__textarea"
                />
              </div>

              <button type="submit" className="pp-btn pp-form__submit">
                Send
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
