import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendKalyanaApplicationEmail } from "@/lib/email";
import { FORM_KIND, formField, formLine, isPlainEmail, type FormSendState } from "@/lib/formSubmissions";
import { after } from "next/server";
import Link from "next/link";
import KalyanaApplicationForm from "@/components/KalyanaApplicationForm";

export const metadata = {
  title: "Kalyana Mitta Group Application - Rooted In Mindfulness",
  description:
    "Any member of RIM can start a Kalyana Mitta group or community activity. Tell us about your idea and we'll help you get it going.",
};

export const dynamic = "force-dynamic";

export default async function KalyanaApplicationPage() {
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
  async function handleApplication(_prev: FormSendState, formData: FormData): Promise<FormSendState> {
    "use server";
    // The form is for members; the page shows it only when signed in, and
    // the action checks again (it can be posted without the page).
    const current = await auth();
    if (!current?.user?.id) return { status: "signin" };
    const data = {
      firstName: formLine(formData, "firstName", 256),
      lastName:  formLine(formData, "lastName", 256),
      email:     formLine(formData, "email", 256),
      idea:      formField(formData, "idea", 5000),
    };
    if (!isPlainEmail(data.email)) return { status: "email" };
    if (!data.idea) return { status: "error" };
    // Saved before the email, so a failed send never loses it; the notice
    // goes from after() (lib/formSubmissions.ts, /admin/form-submissions).
    try {
      await db.formSubmission.create({
        data: {
          kind: FORM_KIND.kalyanaMitta,
          userId: current.user.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          message: data.idea,
        },
      });
    } catch (e) {
      console.error("[kalyana-mitta-form] save failed:", e);
      return { status: "error" };
    }
    after(() => sendKalyanaApplicationEmail(data));
    return { status: "sent", firstName: data.firstName };
  }

  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--quiet">
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

          <div className="pp-actions">
            <Link
              href="/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group"
              className="pp-btn pp-btn--ghost"
            >
              The group guidelines
            </Link>
          </div>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-intro">
            <p className="pp-intro__eyebrow">The application</p>
            <h2 className="pp-intro__title pp-intro__title--h2">
              Tell us about your idea
            </h2>
          </div>

          {!member ? (
            <div className="pp-notice">
              <p className="pp-notice__title">You&rsquo;ll need an account for this form</p>
              <p className="pp-notice__body">
                RIM community members are welcome to create a new Kalyana Mitta group. Membership is
                freely offered. Create an account or sign in, then return to this page and the form
                will be here.
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
            <KalyanaApplicationForm
              action={handleApplication}
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
