import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

interface ImportRow {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { members }: { members: ImportRow[] } = body;

  if (!Array.isArray(members) || members.length === 0) {
    return NextResponse.json({ error: "No members provided" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of members) {
    const email = row.email?.trim().toLowerCase();
    if (!email) {
      skipped++;
      continue;
    }

    const existing = await db.user.findUnique({ where: { email } });

    if (existing) {
      // Only fill in blank fields — never overwrite existing data
      const patch: Record<string, string> = {};
      if (!existing.firstName && row.firstName?.trim()) patch.firstName = row.firstName.trim();
      if (!existing.lastName && row.lastName?.trim()) patch.lastName = row.lastName.trim();
      if (!existing.phone && row.phone?.trim()) patch.phone = row.phone.trim();

      if (Object.keys(patch).length > 0) {
        await db.user.update({ where: { email }, data: patch });
        updated++;
      } else {
        skipped++;
      }
    } else {
      await db.user.create({
        data: {
          email,
          firstName: row.firstName?.trim() || null,
          lastName: row.lastName?.trim() || null,
          phone: row.phone?.trim() || null,
        },
      });
      created++;
    }
  }

  return NextResponse.json({ created, updated, skipped });
}
