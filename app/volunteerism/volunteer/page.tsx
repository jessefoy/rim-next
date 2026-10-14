import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendVolunteerInterestEmail } from "@/lib/email";
import { FORM_KIND, formField, formLine, isPlainEmail, type FormSendState } from "@/lib/formSubmissions";
import { after } from "next/server";
import Link from "next/link";
import VolunteerInterestForm from "@/components/VolunteerInterestForm";

export const metadata = {
  title: "Volunteer - Rooted In Mindfulness",
  description:
    "Offer a gift of time and talent at Rooted In Mindfulness. Browse current volunteer needs or tell us about your interests.",
};

export const dynamic = "force-dynamic";

export default async function VolunteerPage() {
  const session = await auth();
  // What RIM already knows is filled in (Jesse, 2026-10-13).
  const member = session?.user?.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true, email: true, phone: true },
      })
    : null;

  // Returns a status instead of redirecting, so the page never reloads: what
  // someone wrote survives an error and the confirmation comes to them.
  async function handleVolunteerForm(_prev: FormSendState, formData: FormData): Promise<FormSendState> {
    "use server";
    // The form is for members; the page shows it only when signed in, and
    // the action checks again (it can be posted without the page).
    const current = await auth();
    if (!current?.user?.id) return { status: "signin" };
    const data = {
      firstName: formLine(formData, "firstName", 256),
      lastName:  formLine(formData, "lastName", 256),
      email:     formLine(formData, "email", 256),
      phone:     formLine(formData, "phone", 256) || null,
      interests: formField(formData, "interests", 5000),
    };
    if (!isPlainEmail(data.email)) return { status: "email" };
    // Saved before the email, so a failed send never loses it; the notice
    // goes from after() (lib/formSubmissions.ts, /admin/form-submissions).
    try {
      await db.formSubmission.create({
        data: {
          kind: FORM_KIND.volunteer,
          userId: current.user.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          message: data.interests,
        },
      });
    } catch (e) {
      console.error("[volunteer-form] save failed:", e);
      return { status: "error" };
    }
    after(() => sendVolunteerInterestEmail(data));
    return { status: "sent", firstName: data.firstName };
  }

  return (
    <div className="pp-page pp-page--spine pp-page--column">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Embodied generosity</p>
          <h1 className="pp-hero__title">Become a Volunteer</h1>
          <p className="pp-hero__body">
            If you&rsquo;d like to offer a gift of time and talent, you&rsquo;re welcome to browse
            current volunteer opportunities at RIM. If the listed needs are not a good fit for you,
            tell us about your interests and talents and we&rsquo;ll reach out if something opens up.
          </p>
          <div className="pp-hero__actions">
            <a href="#current-openings" className="pp-btn">
              Current needs
            </a>
            <a href="#share-your-talent" className="pp-btn pp-btn--ghost">
              Share your talent
            </a>
          </div>
        </div>
      </section>

      {/* ── Current needs ─────────────────────────────────── */}
      <section id="current-openings" className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-intro">
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

      {/* ── Share your talent ─────────────────────────────── */}
      <section id="share-your-talent" className="pp-section pp-section--white pp-section--last">
        <div className="rim-container">
          <div className="pp-intro">
            <p className="pp-intro__eyebrow">Share your talent</p>
            <h2 className="pp-intro__title pp-intro__title--h2">
              Tell us about your interests
            </h2>
            <p className="pp-intro__body">
              We&rsquo;ll reach out when we have something that fits what you enjoy.
            </p>
          </div>

          {!member ? (
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
                <Link href="/login" className="pp-btn pp-btn--ghost">
                  I already have an account <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          ) : (
            <VolunteerInterestForm
              action={handleVolunteerForm}
              member={{
                firstName: member.firstName ?? "",
                lastName: member.lastName ?? "",
                email: member.email,
                phone: member.phone ?? "",
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}
