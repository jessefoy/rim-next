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
    select: { firstName: true, lastName: true, phone: true },
  });

  return (
    <div className="wl-page">
      <div className="wl-container">
        <div className="wl-header">
          <p className="wl-eyebrow">Rooted In Mindfulness</p>
          <h1 className="wl-title">Welcome</h1>
          <p className="wl-subtitle">
            We&apos;re glad you&apos;re here. Before you step in, we&apos;d love to know
            your name — it&apos;s how we know one another in this community.
          </p>
        </div>

        <WelcomeForm
          defaultFirstName={user?.firstName ?? ""}
          defaultLastName={user?.lastName ?? ""}
          defaultPhone={user?.phone ?? ""}
        />
      </div>
    </div>
  );
}
