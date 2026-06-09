import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import WelcomeForm from "@/components/WelcomeForm";

export const metadata = { title: "Welcome to RIM — Rooted In Mindfulness" };

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // If they've already agreed, send them on their way
  if (session.user.agreedToTerms) redirect("/account/dashboard");

  // Pre-fill name/phone from DB in case they came through a registration
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true, phone: true, isLegacyUnclaimed: true },
  });
  // Returning member migrated from the old Webflow/Memberstack site — greet them
  // back into the new home rather than as a stranger signing up for the first time.
  const isLegacy = user?.isLegacyUnclaimed ?? false;

  return (
    <div className="wl-page">
      <div className="wl-container">
        <div className="wl-header">
          <p className="wl-eyebrow">Rooted In Mindfulness</p>
          <h1 className="wl-title">{isLegacy ? "Welcome back" : "Welcome"}</h1>
          <p className="wl-subtitle">
            {isLegacy ? (
              <>
                We&apos;ve rebuilt Rooted In Mindfulness as a new website and home,
                and your membership came with you — there&apos;s nothing to sign up
                for again. As we begin here together, we&apos;re simply asking every
                member to revisit our community commitments below and confirm your name.
              </>
            ) : (
              <>
                We&apos;re glad you&apos;re here. Before you step in, we&apos;d love to
                know your name — it&apos;s how we know one another in this community.
              </>
            )}
          </p>
        </div>

        <WelcomeForm
          isLegacy={isLegacy}
          defaultFirstName={user?.firstName ?? ""}
          defaultLastName={user?.lastName ?? ""}
          defaultPhone={user?.phone ?? ""}
        />
      </div>
    </div>
  );
}
