/**
 * POST /api/hub/[slug]/documents/[id]/presence — Heartbeat for editing presence.
 * Called when the editor opens and periodically (every 30s).
 *
 * GET — Check who's editing (returns editingBy + editingAt).
 *
 * DELETE — Clear presence when editor closes.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership } from "@/lib/hubAuth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!hub || (!member)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.hubDocument.update({
    where: { id },
    data: { editingById: session.user.id, editingAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!hub || (!member)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await db.hubDocument.findFirst({
    where: { id, hubId: hub.id },
    select: {
      editingById: true,
      editingAt: true,
      editingBy: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Presence is stale after 60 seconds (heartbeat is every 30s)
  const isActive = doc.editingAt && (Date.now() - new Date(doc.editingAt).getTime() < 60_000);

  return NextResponse.json({
    editingById: isActive ? doc.editingById : null,
    editingBy: isActive ? doc.editingBy : null,
    editingAt: isActive ? doc.editingAt : null,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;

  // Only clear if the current user is the one editing
  await db.hubDocument.updateMany({
    where: { id, editingById: session.user.id },
    data: { editingById: null, editingAt: null },
  });

  return NextResponse.json({ ok: true });
}
