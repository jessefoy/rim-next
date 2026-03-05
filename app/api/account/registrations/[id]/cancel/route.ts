import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendCancellationNotificationEmail } from "@/lib/email";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const registration = await db.registration.findUnique({ where: { id } });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Ownership check — member can only cancel their own registration
  if (registration.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Can only cancel active registrations
  const cancellable = ["REGISTERED", "APPROVED", "WAITLISTED"];
  if (!cancellable.includes(registration.status)) {
    return NextResponse.json(
      { error: "Registration is not in a cancellable state" },
      { status: 400 }
    );
  }

  await db.registration.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  // Notify registrar — fire-and-forget, never blocks the response
  sendCancellationNotificationEmail({
    registrantName: `${registration.firstName} ${registration.lastName}`,
    registrantEmail: registration.email,
    programTitle: registration.programTitle,
    programSlug: registration.programSlug,
  }).catch(() => {});

  return NextResponse.json({ id, status: "CANCELLED" });
}
