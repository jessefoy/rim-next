import { auth } from "@/auth";
import { Resend } from "resend";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Volunteer — Rooted In Mindfulness" };

export default async function VolunteerPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [session, { submitted }] = await Promise.all([auth(), searchParams]);
  const isLoggedIn = !!session;

  async function handleVolunteerForm(formData: FormData) {
    "use server";
    const resend = new Resend(process.env.RESEND_API_KEY);
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const interests = formData.get("interests") as string;

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: "hello@rootedinmindfulness.org",
      subject: "New Volunteer Interest Submission",
      html: `
        <h2>New Volunteer Interest</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Interests &amp; Talents:</strong><br>${interests?.replace(/\n/g, "<br>")}</p>
      `,
    });
    redirect("/volunteerism/volunteer?submitted=true");
  }

  return (
    <>
      <div className="section-19">
        <div className="main-container">
          <div className="w-layout-grid grid-halves-3">
            <div
              id="w-node-aa97d7ea-f00c-e69f-c176-479194685427-96d6b85f"
              className="container"
            >
              <div className="image-wrapper">
                <div className="section-image volunteer-page"></div>
              </div>
            </div>
            <div className="container">
              <div className="section-title-3 reduced-margin">
                <div className="text-uppercase-2 subheading">Embodied Generosity</div>
                <h4 className="large-heading-2">Become a Volunteer</h4>
              </div>
              <div className="justify-content-left">
                <div>
                  If you&apos;d like to offer a gift of time and talent, you&apos;re welcome to
                  browse current volunteer opportunities at RIM.
                  <br />
                  <br />
                  If the listed needs are not a good fit for you, please tell us about your
                  interests and talents in the form below, and we&apos;ll reach out if we have
                  something available.
                </div>
                <div className="button-row justify-content-center">
                  <a href="#Current-Openings" className="button-5 w-inline-block">
                    <div className="button-text">Needed Positions</div>
                    <div className="button-hover-element"></div>
                  </a>
                  <a
                    href="#Share-Your-Talent"
                    className="button-5 bordered adjacent-to-button w-inline-block"
                  >
                    <div className="text-block-88">Share Your Talent</div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-19 bg-accent-2">
        <div className="main-container">
          <div className="container-large align-center text-center">
            <div className="medium-heading no-bottom-margin">
              <em>
                &quot;The best way to find yourself is to lose yourself in the service of
                others.&quot;
              </em>
            </div>
            <div className="text-block-80">Mahatma Gandhi</div>
          </div>
        </div>
      </div>

      <div id="Current-Openings" className="section-19">
        <div className="container align-center">
          <div className="section-title-3">
            <h3 className="medium-heading no-bottom-margin text-center">
              Positions with Openings
            </h3>
          </div>
          <p style={{ textAlign: "center", color: "#777", marginTop: "1rem" }}>
            Check back soon for current openings.
          </p>
        </div>
      </div>

      <div id="Share-Your-Talent" className="section-19 bg-accent-2">
        <div className="main-container">
          {isLoggedIn ? (
            <div className="container align-center">
              <div className="section-title-3 reduced-margin text-center">
                <h2>Share Your Talent</h2>
                <div>
                  Tell us about your interests and talents and we&apos;ll reach out when we have
                  something available.
                </div>
              </div>
              {submitted ? (
                <div
                  style={{
                    background: "#d4edda",
                    color: "#155724",
                    padding: "1rem 1.5rem",
                    borderRadius: "4px",
                    textAlign: "center",
                    maxWidth: "500px",
                    margin: "0 auto",
                  }}
                >
                  Thank you! Your submission has been received. We&apos;ll be in touch!
                </div>
              ) : (
                <div className="form-block-2 w-form">
                  <form action={handleVolunteerForm} className="form-grid-vertical">
                    <div className="w-layout-grid form-row">
                      <div>
                        <label htmlFor="firstName">First Name</label>
                        <input
                          className="form-input w-input"
                          maxLength={256}
                          name="firstName"
                          type="text"
                          id="firstName"
                          defaultValue={session.user?.name?.split(" ")[0] ?? ""}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="lastName">Last Name</label>
                        <input
                          className="form-input w-input"
                          maxLength={256}
                          name="lastName"
                          type="text"
                          id="lastName"
                          required
                        />
                      </div>
                    </div>
                    <div className="w-layout-grid form-row">
                      <div>
                        <label htmlFor="email">Email Address</label>
                        <input
                          className="form-input w-input"
                          maxLength={256}
                          name="email"
                          type="email"
                          id="email"
                          defaultValue={session.user?.email ?? ""}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="phone">Phone Number</label>
                        <input
                          className="form-input w-input"
                          maxLength={256}
                          name="phone"
                          type="tel"
                          id="phone"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="interests">My Interests and Talents</label>
                      <textarea
                        name="interests"
                        maxLength={5000}
                        id="interests"
                        className="textarea-2 w-input"
                      ></textarea>
                    </div>
                    <input type="submit" className="button-5 w-button" value="Submit" />
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="main-container">
              <div className="container-large align-center">
                <div className="section-title-3">
                  <h3 className="medium-heading">
                    Are you interested in sharing your talent at RIM?
                  </h3>
                  <div className="article w-richtext">
                    <p>
                      Wonderful! To access the Interests Form, you&apos;ll need to{" "}
                      <Link href="/login">
                        <strong>join or sign in</strong>
                      </Link>
                      {" "}and come back to this page.
                    </p>
                  </div>
                  <div className="become-member-buttons">
                    <Link href="/login" className="button-2 w-button">
                      Join or sign in →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
