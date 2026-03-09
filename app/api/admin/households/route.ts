import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

function hasAccess(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("REGISTRAR");
}

// GET /api/admin/households — list all households
export async function GET(req: Request) {
  const session = await auth();
  if (!session || !hasAccess(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";

  const households = await db.household.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  const filtered = q
    ? households.filter((h) => {
        if (h.name?.toLowerCase().includes(q)) return true;
        return h.members.some(
          (m) =>
            `${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.toLowerCase().includes(q) ||
            m.user.email.toLowerCase().includes(q)
        );
      })
    : households;

  return NextResponse.json(filtered);
}

// POST /api/admin/households — create household with first member
export async function POST(req: Request) {
  const session = await auth();
  if (!session || !hasAccess(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, memberId, relationshipType, relationshipCustom } = body;

  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  // Check if member is already in a household
  const existing = await db.householdMember.findUnique({ where: { userId: memberId } });
  if (existing) {
    return NextResponse.json(
      { error: "This member is already in another household. Remove them from that household first." },
      { status: 409 }
    );
  }

  const household = await db.household.create({
    data: {
      name: name || null,
      members: {
        create: {
          userId: memberId,
          relationshipType: relationshipType ?? "OTHER",
          relationshipCustom: relationshipType === "OTHER" ? (relationshipCustom ?? null) : null,
          isPrimary: true,
        },
      },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json(household, { status: 201 });
}
