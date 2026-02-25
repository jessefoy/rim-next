import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Become a Member — Rooted In Mindfulness" };

export default async function CommunityMembershipPage() {
  const session = await auth();
  if (session) redirect("/account/dashboard");

  async function handleSignUp(formData: FormData) {
    "use server";
    await signIn("resend", {
      email: formData.get("email") as string,
      redirectTo: "/account/dashboard",
    });
  }

  return (
    <div className="section background-white">
      <div className="container-7">
        <div className="container-home-page">
          <div className="grid-halves reverse-direction">
            <div
              id="w-node-c2cece22-07f9-ea4a-5d10-fe76e63e8153-00e041cc"
              className="container-image"
            >
              <div className="section-image join-us-page-image"></div>
            </div>
            <div
              id="w-node-c2cece22-07f9-ea4a-5d10-fe76e63e8155-00e041cc"
              className="container-content flip-pull"
            >
              <div className="section-content content-info">
                <h2>Become a Member</h2>
                <p className="section-text-3">
                  <strong>RIM is a refuge we create together</strong>—a place for learning, practice,
                  and genuine friendship. Everyone is welcome, from all backgrounds and phases of
                  life. <strong>Come as you are.</strong>
                </p>
              </div>
              <div className="section-box">
                <div className="program-details-content no-bottom-margin">
                  <div className="rich-text-block-15 w-richtext">
                    <h3>Community Care Agreements</h3>
                    <p>
                      We ask members to hold these four shared intentions, which together create a
                      safe and supportive environment for all.
                    </p>
                    <ol role="list">
                      <li>
                        <strong>Care for Yourself</strong>
                        <br />
                        Take responsibility for your own path. Teachers and community offer support
                        and friendship, but the journey is yours to walk.
                      </li>
                      <li>
                        <strong>Care for Others</strong>
                        <br />
                        Show up for one another. Your presence and goodwill are gifts to every
                        member of this community.
                      </li>
                      <li>
                        <strong>Care for RIM</strong>
                        <br />
                        RIM is 100% community-funded. We ask that all members contribute
                        financially in a way that feels right to them.
                      </li>
                      <li>
                        <strong>Care for Our Shared Vision</strong>
                        <br />
                        We practice to cultivate wisdom and compassion—for ourselves, each other,
                        and all beings.
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="sign-up-box">
                  <div className="w-form">
                    <form action={handleSignUp} className="login-form">
                      <h3 className="join-us-form-header">Create Your Member Account</h3>
                      <p className="paragraph-19">
                        If these intentions resonate with you, we&apos;d be honored to have you join
                        us. Enter your email to get started — no password needed.
                      </p>
                      <div className="text-field-wrapper">
                        <label htmlFor="email-2" className="input-label-2">
                          Email
                        </label>
                        <input
                          className="input w-input"
                          maxLength={256}
                          name="email"
                          placeholder="e.g. AliciaFernández@gmail.com"
                          type="email"
                          id="email-2"
                          required
                        />
                      </div>
                      <input
                        type="submit"
                        className="link-block-3 w-button"
                        value="Let's go →"
                      />
                    </form>
                  </div>
                  <a href="/login" className="password-link">
                    I already have an account
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
