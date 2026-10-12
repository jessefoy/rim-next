import { auth } from "@/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import CareConcernForm, { type CareConcernState } from "@/components/CareConcernForm";
import { sendCareConcernEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";
import { CARE_REPAIR_TITLE } from "@/lib/communityAgreements";

// "If harm happens" (Jesse, 2026-10-12): a private way to tell the guiding
// teacher that something has caused harm, or that someone is a worry. The
// message is emailed to the guiding teacher (lib/email.ts
// sendCareConcernEmail) and is not stored. A signed-in member writes only the
// message; their name and email come from their record. Not in the sitemap,
// and not indexed.
export const metadata = {
  title: `${CARE_REPAIR_TITLE} - Rooted In Mindfulness`,
  description: "A private way to tell RIM's guiding teacher that something has caused harm.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function sender(): Promise<{ id: string; name: string; email: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!user?.email) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return { id: user.id, name: name || user.email, email: user.email };
}

export default async function CareConcernPage() {
  const member = await sender();

  // Returns a status rather than redirecting, so a failed or rate-limited
  // send keeps what the person wrote on screen (components/CareConcernForm).
  async function sendConcern(_prev: CareConcernState, formData: FormData): Promise<CareConcernState> {
    "use server";
    // A filled hidden field means an automated submission: accept quietly,
    // and log it so a real message lost this way would be visible.
    if (String(formData.get("cc_leave_blank") ?? "").trim()) {
      console.warn("[care-concern] hidden field filled; message not sent");
      return { status: "sent" };
    }

    const signedIn = await sender();
    // A signed-in member's name and email come from their record. If the
    // session lapsed while they wrote, the hidden fields carry them instead.
    const name = signedIn?.name ?? String(formData.get("name") ?? "").trim().slice(0, 200);
    const email = signedIn?.email ?? String(formData.get("email") ?? "").trim().slice(0, 254);
    const message = String(formData.get("message") ?? "").trim().slice(0, 5000);
    if (!name || !email.includes("@") || !message) return { status: "error" };

    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
    // Members are counted by account, visitors by the email they typed, so
    // no one can lock a member out by sending under their address.
    const [byIp, bySender] = await Promise.all([
      checkRateLimit(`care-concern-ip:${ip}`, 5, 3600),
      checkRateLimit(
        signedIn ? `care-concern-user:${signedIn.id}` : `care-concern-email:${email.toLowerCase()}`,
        5,
        3600,
      ),
    ]);
    if (!byIp.allowed || !bySender.allowed) return { status: "wait" };

    const ok = await sendCareConcernEmail({ name, email, message, isMember: !!signedIn });
    return { status: ok ? "sent" : "error" };
  }

  return (
    <div className="pp-page pp-page--spine cc-concern">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <h1 className="pp-hero__title">{CARE_REPAIR_TITLE}</h1>
          <p className="pp-hero__body">
            If something at RIM has caused harm, or you are worried about someone in our
            community, you can write here. Your message goes only to our guiding teacher,
            Jesse Foy, who will read it and reply.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <CareConcernForm
            action={sendConcern}
            member={member ? { name: member.name, email: member.email } : null}
          />
        </div>
      </section>
    </div>
  );
}
