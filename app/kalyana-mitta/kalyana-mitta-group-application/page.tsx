import { auth } from "@/auth";
import { Resend } from "resend";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Kalyana Mitta Group Application — Rooted In Mindfulness" };

export default async function KalyanaApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [session, { submitted }] = await Promise.all([auth(), searchParams]);
  const isLoggedIn = !!session;

  async function handleApplication(formData: FormData) {
    "use server";
    const resend = new Resend(process.env.RESEND_API_KEY);
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const email = formData.get("email") as string;
    const idea = formData.get("idea") as string;

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: "hello@rootedinmindfulness.org",
      subject: "New Kalyana Mitta Group Application",
      html: `
        <h2>New Kalyana Mitta Group Application</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Group Idea:</strong><br>${idea?.replace(/\n/g, "<br>")}</p>
      `,
    });
    redirect("/kalyana-mitta/kalyana-mitta-group-application?submitted=true");
  }

  return (
    <>
      <div className="section lesson-hero">
        <div className="container-4"></div>
        <h1 className="lesson-page-heading">
          <strong>
            Interested in starting a Kalyana Mitta Group, Event, or Activity?
          </strong>
        </h1>
      </div>

      <div className="section background-white">
        <div className="content-container">
          <div className="diversity-content-box">
            <div className="w-richtext">
              <h4>
                <strong>
                  Any member of RIM can start a Kalyana Mitta Group or community activity.
                  <br />
                </strong>
              </h4>
              <p>
                Dharma practice is a whole-life practice. Therefore, the possible focus and
                intentions for forming a group or planning an event are countless. Some groups have
                a single purpose, such as right speech, dharma study, recovery, affinity, or
                community service, to name a few. Other KM Groups more generally address keeping
                the practice alive and fresh in one&apos;s daily life and supporting each other in
                this intention.
                <br />
              </p>
              <p>
                Kalyana Mitta Groups are a wonderful way to connect with friends who share our
                intentions to deepen meditation and mindful living practices, and to feel encouraged
                and supported along the way.
              </p>
              <ul role="list">
                <li>
                  <strong>Do you have an idea for a KM group or event?</strong>
                </li>
                <li>
                  <strong>Are you interested in planning or sustaining a group?</strong>
                </li>
              </ul>
              <p>
                We are here to help you get started, stay rooted in the living Dharma, and
                strengthen RIM&apos;s mission and vision. We will support you and the group as it
                is established, grows, and meets challenges.
              </p>
              <p>
                <strong>
                  <em>
                    Starting a Kalyana Mitta Group is a true act of generosity. On behalf of
                    everyone at RIM, thank you!
                  </em>
                </strong>
              </p>
            </div>

            <div className="line-spacer"></div>

            {!isLoggedIn ? (
              <div className="km-application-not-logged-in-message">
                <h4>Oops. It looks like you are not signed-in.</h4>
                <div className="w-richtext">
                  <p>
                    RIM community members are welcome to create a new Kalyana Mitta Group.
                    Please{" "}
                    <Link href="/login">
                      <strong>join or sign in</strong>
                    </Link>
                    {" "}and return to this page to access the application form.
                  </p>
                </div>
              </div>
            ) : submitted ? (
              <div
                style={{
                  background: "#d4edda",
                  color: "#155724",
                  padding: "1rem 1.5rem",
                  borderRadius: "4px",
                }}
              >
                Thank you for your application! We&apos;ll be in touch soon.
              </div>
            ) : (
              <div className="km-application-form">
                <div className="w-richtext">
                  <h3>Kalyana Mitta Group Application:</h3>
                </div>
                <div className="w-form">
                  <form action={handleApplication} className="form-5">
                    <label htmlFor="firstName" className="field-label">First Name</label>
                    <input
                      className="form-input-field w-input"
                      maxLength={256}
                      name="firstName"
                      type="text"
                      id="firstName"
                      defaultValue={session.user?.name?.split(" ")[0] ?? ""}
                    />
                    <label htmlFor="lastName" className="field-label">Last Name</label>
                    <input
                      className="form-input-field w-input"
                      maxLength={256}
                      name="lastName"
                      type="text"
                      id="lastName"
                    />
                    <label htmlFor="email" className="field-label">Email Address</label>
                    <input
                      className="form-input-field w-input"
                      maxLength={256}
                      name="email"
                      type="email"
                      id="email"
                      defaultValue={session.user?.email ?? ""}
                      required
                    />
                    <label htmlFor="idea" className="field-label">
                      Tell us about your idea for a Kalyana Mitta Group at RIM :)
                    </label>
                    <textarea
                      id="idea"
                      name="idea"
                      maxLength={5000}
                      required
                      className="form-input-field large-text-input-field w-input"
                    ></textarea>
                    <input type="submit" className="button-4 w-button" value="Submit" />
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
