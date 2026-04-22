import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/**
 * PATCH /api/account/bio
 *
 * Save or clear the current user's `bio` — a Message-type BlockNote document
 * (personal description, separate from any role). Used from the account
 * profile page's "About me" section.
 *
 * Body: { bio: unknown | null }  — BlockNote JSON or null
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bio } = await req.json();

  await db.user.update({
    where: { id: session.user.id },
    data: { bio: bio ?? Prisma.JsonNull },
  });

  return NextResponse.json({ ok: true });
}
