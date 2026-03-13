import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// POST — save name/phone and mark community agreements accepted
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const phone = (body.phone ?? "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      firstName,
      lastName,
      phone: phone || null,
      agreedToTerms: true,
      agreedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE — member explicitly declined; remove their account entirely
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cascade deletes: Sessions, Accounts, CourseAccess, HubMember, Alerts, threads/replies, etc.
  // Registrations use onDelete: SetNull — registration records are preserved with userId = null.
  await db.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ ok: true });
}
