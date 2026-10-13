import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AccountLayout from "@/components/AccountLayout";
import AboutMeSection from "@/components/account/AboutMeSection";
import ProfileDetailsForm, { type ProfileSaveState } from "@/components/account/ProfileDetailsForm";
import { RIM_SUPPORT_EMAIL } from "@/lib/locations";

export const metadata = { title: "My Profile - Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
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

  // Returns a status instead of redirecting: the answer appears beside the
  // Save button (ProfileDetailsForm), where the person is looking.
  async function updateProfile(_prev: ProfileSaveState, formData: FormData): Promise<ProfileSaveState> {
    "use server";
    const sess = await auth();
    if (!sess?.user?.id) return { status: "error" };
    const firstName = (formData.get("firstName") as string)?.trim() ?? "";
    const lastName = (formData.get("lastName") as string)?.trim() ?? "";
    const preferredName = (formData.get("preferredName") as string)?.trim() || null;
    const phone = (formData.get("phone") as string)?.trim() ?? "";
    const title = (formData.get("title") as string)?.trim() || null;
    try {
      await db.user.update({
        where: { id: sess.user.id },
        data: { firstName, lastName, preferredName, phone, title },
      });
    } catch (e) {
      console.error("[my-profile] save failed:", e);
      return { status: "error" };
    }
    // The header above the form shows the name; refresh it.
    revalidatePath("/account/dashboard-my-profile");
    return { status: "saved" };
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
          <ProfileDetailsForm
            action={updateProfile}
            initial={{
              firstName: user?.firstName ?? "",
              lastName: user?.lastName ?? "",
              preferredName: user?.preferredName ?? "",
              phone: user?.phone ?? "",
              title: user?.title ?? "",
            }}
          />
        </section>

        {/* Email */}
        <section className="mp-section">
          <h2 className="mp-section__title">Sign-in email</h2>
          <div className="mp-field">
            <div className="mp-input mp-input--readonly">{user?.email}</div>
            <p className="mp-note">
              Your email is where we send your sign-in code. To change it, contact us at{" "}
              <a href={`mailto:${RIM_SUPPORT_EMAIL}`}>{RIM_SUPPORT_EMAIL}</a>.
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
