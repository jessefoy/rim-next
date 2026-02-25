import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export const metadata = { title: "My Profile — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

export default async function MyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  const { saved } = await searchParams;

  async function updateProfile(formData: FormData) {
    "use server";
    const sess = await auth();
    if (!sess?.user?.id) return;
    const firstName = (formData.get("firstName") as string)?.trim() ?? "";
    const lastName = (formData.get("lastName") as string)?.trim() ?? "";
    const phone = (formData.get("phone") as string)?.trim() ?? "";
    await db.user.update({
      where: { id: sess.user.id },
      data: {
        firstName,
        lastName,
        phone,
      },
    });
    redirect("/account/dashboard-my-profile?saved=true");
  }

  return (
    <div className="page-wrapper">
      <div className="dashboard-section">
        <div className="dashboard-content">
          <h1 className="heading-45">Your Profile Details</h1>

          {saved && (
            <div style={{ background: "#d4edda", color: "#155724", padding: "0.75rem 1rem", borderRadius: "4px", marginBottom: "1.5rem" }}>
              Profile saved successfully!
            </div>
          )}

          <div className="flex-stack-center top">
            <div className="container-10">
              <h4 className="heading-46">Update Member Data</h4>
              <div className="w-form">
                <form action={updateProfile} className="profile-form">
                  <div>
                    <div className="text-field-wrapper-2">
                      <label htmlFor="firstName" className="field-label-3">First Name</label>
                      <input
                        className="signup-field w-input"
                        maxLength={256}
                        name="firstName"
                        type="text"
                        id="firstName"
                        defaultValue={user?.firstName ?? ""}
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="field-label-3">Last Name</label>
                      <input
                        className="signup-field w-input"
                        maxLength={256}
                        name="lastName"
                        type="text"
                        id="lastName"
                        defaultValue={user?.lastName ?? ""}
                      />
                    </div>
                  </div>
                  <div className="text-field-wrapper-2">
                    <label htmlFor="phone" className="field-label-3">Phone</label>
                    <input
                      className="signup-field w-input"
                      maxLength={256}
                      name="phone"
                      type="text"
                      id="phone"
                      defaultValue={user?.phone ?? ""}
                    />
                  </div>
                  <input type="submit" className="profile-form-button w-button" value="Save Profile" />
                </form>
              </div>
            </div>
          </div>

          <div className="flex-stack-center top">
            <div className="container-10">
              <h4 className="heading-46">Email Address</h4>
              <p style={{ color: "#555", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                Your email is used for magic link login. To change it, contact us at{" "}
                <a href="mailto:hello@rootedinmindfulness.org">hello@rootedinmindfulness.org</a>.
              </p>
              <div className="signup-field w-input" style={{ padding: "8px 12px", background: "#f5f5f5", borderRadius: "4px", color: "#555" }}>
                {user?.email}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
