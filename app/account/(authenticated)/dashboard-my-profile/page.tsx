import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import AccountLayout from "@/components/AccountLayout";
import AboutMeSection from "@/components/account/AboutMeSection";

export const metadata = { title: "My Profile — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

export default async function MyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [user, household] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.householdMember.findUnique({
      where: { userId },
      include: {
        household: {
          include: {
            members: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
              },
            },
          },
        },
      },
    }),

  ]);

  const { saved } = await searchParams;

  const displayName = user?.preferredName
    || [user?.firstName, user?.lastName].filter(Boolean).join(" ")
    || "Member";

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  const householdMembers = household?.household.members
    .filter((m) => m.userId !== userId)
    .map((m) => {
      const u = m.user;
      return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
    }) ?? [];

  async function updateProfile(formData: FormData) {
    "use server";
    const sess = await auth();
    if (!sess?.user?.id) return;
    const firstName = (formData.get("firstName") as string)?.trim() ?? "";
    const lastName = (formData.get("lastName") as string)?.trim() ?? "";
    const preferredName = (formData.get("preferredName") as string)?.trim() || null;
    const phone = (formData.get("phone") as string)?.trim() ?? "";
    const title = (formData.get("title") as string)?.trim() || null;
    await db.user.update({
      where: { id: sess.user.id },
      data: { firstName, lastName, preferredName, phone, title },
    });
    redirect("/account/dashboard-my-profile?saved=true");
  }

  return (
    <AccountLayout>
      <div className="mp-page ac-member-page mp-page--calm">
        <header className="ac-page-head">
          <div>
            <h1 className="mp-heading ac-page-title">My Profile</h1>
            <p className="ac-page-sub">Manage your contact information and how you appear in the RIM community.</p>
          </div>
        </header>

        {saved && (
          <div className="mp-success" role="status">Profile saved successfully.</div>
        )}

        {/* Profile header */}
        <div className="mp-header">
          <div className="mp-header__initials">
            {(user?.firstName?.[0] ?? "").toUpperCase()}
            {(user?.lastName?.[0] ?? "").toUpperCase()}
          </div>
          <div className="mp-header__info">
            <div className="mp-header__name">{displayName}</div>
            {user?.title && <div className="mp-header__title">{user.title}</div>}
            <div className="mp-header__details">
              {memberSince && <span>Member since {memberSince}</span>}
              {user?.email && <span>{user.email}</span>}
            </div>

          </div>
        </div>

        {/* Contact form */}
        <section className="mp-section">
          <h2 className="mp-section__title">Personal details</h2>
          <form action={updateProfile} className="mp-form">
            <div className="mp-field__row">
              <div className="mp-field">
                <label htmlFor="firstName" className="mp-label">First name</label>
                <input className="mp-input" name="firstName" type="text" autoComplete="given-name" id="firstName" maxLength={256} defaultValue={user?.firstName ?? ""} />
              </div>
              <div className="mp-field">
                <label htmlFor="lastName" className="mp-label">Last name</label>
                <input className="mp-input" name="lastName" type="text" autoComplete="family-name" id="lastName" maxLength={256} defaultValue={user?.lastName ?? ""} />
              </div>
            </div>
            <div className="mp-field">
              <label htmlFor="preferredName" className="mp-label">Preferred name</label>
              <input className="mp-input" name="preferredName" type="text" id="preferredName" maxLength={256} placeholder="How you'd like to be addressed" defaultValue={user?.preferredName ?? ""} />
            </div>
            <div className="mp-field">
              <label htmlFor="phone" className="mp-label">Phone</label>
              <input className="mp-input" name="phone" type="tel" autoComplete="tel" id="phone" maxLength={256} defaultValue={user?.phone ?? ""} />
            </div>
            <div className="mp-field">
              <label htmlFor="title" className="mp-label">Title</label>
              <input className="mp-input" name="title" type="text" id="title" maxLength={256} placeholder="e.g. Guiding Teacher, Program Registrar" defaultValue={user?.title ?? ""} />
            </div>
            <input type="submit" className="mp-submit" value="Save profile" />
          </form>
        </section>

        {/* Email */}
        <section className="mp-section">
          <h2 className="mp-section__title">Sign-in email</h2>
          <div className="mp-field">
            <div className="mp-input mp-input--readonly">{user?.email}</div>
            <p className="mp-note">
              Your email is where we send your sign-in code. To change it, contact us at{" "}
              <a href="mailto:hello@rootedinmindfulness.org">hello@rootedinmindfulness.org</a>.
            </p>
          </div>
        </section>

        {/* About me — avatar + bio */}
        <AboutMeSection
          initialBio={user?.bio ?? null}
          initialAvatarUrl={user?.avatarUrl ?? null}
        />

        {/* Household */}
        {household && (
          <section className="mp-section">
            <h2 className="mp-section__title">Household</h2>
            <div className="mp-household">
              <div className="mp-household__name">{household.household.name}</div>
              {householdMembers.length > 0 && (
                <div className="mp-household__members">
                  {householdMembers.map((name, i) => (
                    <span key={i} className="mp-household__member">{name}</span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </AccountLayout>
  );
}
