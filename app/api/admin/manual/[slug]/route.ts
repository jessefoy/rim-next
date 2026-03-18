import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — fetch one section by slug
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as string[];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const section = await db.manualSection.findUnique({ where: { slug } });
  if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(section);
}

// PATCH — update section fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as string[];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const body = await request.json();

  const section = await db.manualSection.findUnique({ where: { slug } });
  if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { title, hubSlug, body: sectionBody, relations, order } = body;

  const updated = await db.manualSection.update({
    where: { slug },
    data: {
      ...(title !== undefined && { title }),
      ...(hubSlug !== undefined && { hubSlug: hubSlug || null }),
      ...(sectionBody !== undefined && { body: sectionBody }),
      ...(relations !== undefined && { relations }),
      ...(order !== undefined && { order: Number(order) }),
    },
  });

  return NextResponse.json(updated);
}
