import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import AccountLayout from "@/components/AccountLayout";

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
      data: { firstName, lastName, phone },
    });
    redirect("/account/dashboard-my-profile?saved=true");
  }

  return (
    <AccountLayout>
    <div className="page-wrapper">
      <div className="lp-content mp-page">
        <h1 className="mp-heading">My Profile</h1>

        {saved && (
          <div className="mp-success">Profile saved successfully.</div>
        )}

        <section className="mp-section">
          <p className="mp-section__title">Contact Details</p>
          <form action={updateProfile} className="mp-form">
            <div className="mp-field__row">
              <div className="mp-field">
                <label htmlFor="firstName" className="mp-label">First Name</label>
                <input
                  className="mp-input"
                  name="firstName"
                  type="text"
                  id="firstName"
                  maxLength={256}
                  defaultValue={user?.firstName ?? ""}
                />
              </div>
              <div className="mp-field">
                <label htmlFor="lastName" className="mp-label">Last Name</label>
                <input
                  className="mp-input"
                  name="lastName"
                  type="text"
                  id="lastName"
                  maxLength={256}
                  defaultValue={user?.lastName ?? ""}
                />
              </div>
            </div>
            <div className="mp-field">
              <label htmlFor="phone" className="mp-label">Phone</label>
              <input
                className="mp-input"
                name="phone"
                type="text"
                id="phone"
                maxLength={256}
                defaultValue={user?.phone ?? ""}
              />
            </div>
            <input type="submit" className="mp-submit" value="Save Profile" />
          </form>
        </section>

        <section className="mp-section">
          <p className="mp-section__title">Email Address</p>
          <div className="mp-field">
            <div className="mp-input mp-input--readonly">{user?.email}</div>
            <p className="mp-note">
              Your email is used for magic link login. To change it, contact us at{" "}
              <a href="mailto:hello@rootedinmindfulness.org">hello@rootedinmindfulness.org</a>.
            </p>
          </div>
        </section>
      </div>
    </div>
    </AccountLayout>
  );
}
