/**
 * /api/hub/[slug]/categories — Conversation category management.
 *
 * - POST   { name }                  — add a new category (any active member)
 * - PATCH  { oldName, newName }      — rename (any active member); cascades to threads
 * - DELETE ?name=Foo                 — remove (coordinator/admin); reassigns threads → "General"
 *
 * Categories live as a String[] on Hub.conversationCategories. Rename + delete
 * walk HubConversationThread.category to keep existing threads coherent.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import { NextResponse } from "next/server";

const FALLBACK = "General";

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

async function loadContext(slug: string, userId: string, roles: string[]) {
  const { hub, member, isAdmin } = await getHubMembership(slug, userId, roles);
  if (!hub) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!member) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (member && member.status !== "ACTIVE" && !isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { hub, member, isAdmin };
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const ctx = await loadContext(slug, session.user.id, session.user.roles ?? []);
  if (ctx.error) return ctx.error;
  const { hub } = ctx;

  const body = await req.json().catch(() => null);
  const name = normalize(body?.name ?? "");
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (name.length > 40) {
    return NextResponse.json({ error: "Keep names under 40 characters" }, { status: 400 });
  }

  const existing = hub.conversationCategories ?? [];
  if (existing.some((c) => c.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: "That category already exists" }, { status: 409 });
  }

  const updated = [...existing, name];
  await db.hub.update({
    where: { id: hub.id },
    data: { conversationCategories: updated },
  });

  return NextResponse.json({ categories: updated });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const ctx = await loadContext(slug, session.user.id, session.user.roles ?? []);
  if (ctx.error) return ctx.error;
  const { hub } = ctx;

  const body = await req.json().catch(() => null);
  const oldName = normalize(body?.oldName ?? "");
  const newName = normalize(body?.newName ?? "");
  if (!oldName || !newName) {
    return NextResponse.json({ error: "oldName and newName are required" }, { status: 400 });
  }
  if (newName.length > 40) {
    return NextResponse.json({ error: "Keep names under 40 characters" }, { status: 400 });
  }

  const existing = hub.conversationCategories ?? [];
  if (!existing.includes(oldName)) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (oldName !== newName && existing.some((c) => c.toLowerCase() === newName.toLowerCase())) {
    return NextResponse.json({ error: "That name is already in use" }, { status: 409 });
  }

  const updated = existing.map((c) => (c === oldName ? newName : c));

  await db.$transaction([
    db.hub.update({
      where: { id: hub.id },
      data: { conversationCategories: updated },
    }),
    db.hubConversationThread.updateMany({
      where: { hubId: hub.id, category: oldName },
      data: { category: newName },
    }),
  ]);

  return NextResponse.json({ categories: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const ctx = await loadContext(slug, session.user.id, session.user.roles ?? []);
  if (ctx.error) return ctx.error;
  const { hub, member, isAdmin } = ctx;

  if (!isAdmin && !member?.isCoordinator) {
    return NextResponse.json(
      { error: "Only coordinators can delete a category." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const name = normalize(url.searchParams.get("name") ?? "");
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const existing = hub.conversationCategories ?? [];
  if (!existing.includes(name)) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (existing.length <= 1) {
    return NextResponse.json(
      { error: "At least one category is required." },
      { status: 400 },
    );
  }

  const updated = existing.filter((c) => c !== name);
  const replacement = updated.includes(FALLBACK) ? FALLBACK : updated[0];

  await db.$transaction([
    db.hub.update({
      where: { id: hub.id },
      data: { conversationCategories: updated },
    }),
    db.hubConversationThread.updateMany({
      where: { hubId: hub.id, category: name },
      data: { category: replacement },
    }),
  ]);

  return NextResponse.json({ categories: updated, reassignedTo: replacement });
}
