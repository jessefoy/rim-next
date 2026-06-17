import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { toProperName } from "@/lib/nameCase";

export async function GET(req: Request) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("REGISTRAR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";
  const limit = parseInt(searchParams.get("limit") ?? "200", 10);

  const users = await db.user.findMany({
    // This GET backs the household add-member person-picker only (the Member
    // Registry listing is server-rendered from props, and the +Add modal POSTs).
    // Hide the legacy migration pool (imported-but-never-claimed ghosts) and
    // archived accounts — neither belongs in a person-picker. A legacy member
    // becomes pickable once they claim their account on first login
    // (isLegacyUnclaimed → false).
    where: { isLegacyUnclaimed: false, archivedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      roles: true,
      createdAt: true,
      _count: {
        select: {
          registrations: {
            where: { status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } },
          },
        },
      },
    },
  });

  const filtered = q
    ? users.filter((u) => {
        const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase();
        return name.includes(q) || u.email.toLowerCase().includes(q);
      })
    : users;

  const serialized = filtered.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return NextResponse.json(serialized);
}

/**
 * POST /api/admin/members — create a member record from the registry.
 *
 * The deliberate use case is pre-launch staging: an admin adds a real person
 * (a host, a volunteer) who isn't yet a participant, then assigns their role
 * and schedule. The account is created WITHOUT agreedToTerms or emailVerified —
 * it's a placeholder until they complete the normal new-member sign-up (which
 * matches by email, updates their name from what they type, sends the welcome
 * + onboarding, and preserves everything wired to this id). No email fires
 * here; the pre-threshold gate in lib/email.ts keeps team notifications silent
 * until they log in, and the cleanup cron's staged-account guard keeps the row
 * alive once a role/hub is attached.
 *
 * ADMIN + REGISTRAR (matching the GET). Role assignment stays ADMIN-only on the
 * member's profile.
 */
export async function POST(req: Request) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("REGISTRAR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const firstName = toProperName(typeof raw.firstName === "string" ? raw.firstName : "");
  const lastName = toProperName(typeof raw.lastName === "string" ? raw.lastName : "");
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First and last name are required." },
      { status: 400 },
    );
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A member with that email already exists.", existingId: existing.id },
      { status: 409 },
    );
  }

  try {
    const user = await db.user.create({
      data: {
        email,
        firstName,
        lastName,
        phone: phone || null,
        // Intentionally NOT agreedToTerms / emailVerified — this is a staged
        // placeholder. They cross the real threshold (agreements + sign-in) when
        // they first log in, exactly like any new member.
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: user.id }, { status: 201 });
  } catch (err) {
    // Backstop for the check→create race on the unique email (P2002).
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A member with that email already exists." },
        { status: 409 },
      );
    }
    console.error("[admin/members POST] create failed", err);
    return NextResponse.json(
      { error: "Couldn't create the member. Please try again." },
      { status: 500 },
    );
  }
}
