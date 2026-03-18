import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — list all sections ordered by order
export async function GET() {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as string[];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sections = await db.manualSection.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(sections);
}

// POST — create a new section
export async function POST(request: Request) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as string[];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, slug, hubSlug, body: sectionBody, relations, order } = body;

  if (!title || !slug) {
    return NextResponse.json({ error: "title and slug are required" }, { status: 400 });
  }

  const section = await db.manualSection.create({
    data: {
      title,
      slug,
      hubSlug: hubSlug ?? null,
      body: sectionBody ?? null,
      relations: relations ?? [],
      order: order ?? 0,
    },
  });

  return NextResponse.json(section, { status: 201 });
}
