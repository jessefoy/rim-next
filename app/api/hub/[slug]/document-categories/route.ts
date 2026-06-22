/**
 * /api/hub/[slug]/document-categories — member curation of the document
 * category vocabulary (Hub.documentCategories).
 *
 * Any hub member can both mint a category inline while filing a doc (the doc
 * POST/PATCH routes) AND tend the list here — rename, merge, reorder, remove.
 * Opened from coordinator-only to all members per Jesse (s156 follow-up): RIM's
 * trusted-team ethos favors access, and the destructive ops are recoverable
 * (remove just uncategorizes — docs are happy uncategorized — rename/merge re-file).
 *
 * - POST   { name }                               — add a category
 * - PATCH  { action: "rename", oldName, newName } — rename; cascades to
 *             HubDocument.category. Renaming INTO an existing name MERGES
 *             (old dropped, its docs re-filed under the target).
 *          { action: "reorder", order }           — set display order (a
 *             permutation of the existing list; never adds/drops here)
 * - DELETE ?name=Foo                              — remove; docs filed under it
 *             become uncategorized (category = null). Documents need no category.
 *
 * Gated to any active hub member (canAccessHub). Mirrors the conversation-
 * categories route, minus the "≥1 required / General fallback" rule.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { NextResponse } from "next/server";

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Load the hub and require active hub membership, or return an error response. */
async function loadMemberContext(slug: string, userId: string, roles: string[]) {
  const { hub, member } = await getHubMembership(slug, userId, roles);
  if (!hub) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!canAccessHub(member, roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { hub };
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const ctx = await loadMemberContext(slug, session.user.id, session.user.roles ?? []);
  if (ctx.error) return ctx.error;
  const { hub } = ctx;

  const body = await req.json().catch(() => null);
  const name = normalize(body?.name ?? "");
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (name.length > 40) {
    return NextResponse.json({ error: "Keep names under 40 characters" }, { status: 400 });
  }

  const existing = hub.documentCategories ?? [];
  if (existing.some((c) => c.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: "That category already exists" }, { status: 409 });
  }

  const updated = [...existing, name];
  await db.hub.update({ where: { id: hub.id }, data: { documentCategories: updated } });
  return NextResponse.json({ categories: updated });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const ctx = await loadMemberContext(slug, session.user.id, session.user.roles ?? []);
  if (ctx.error) return ctx.error;
  const { hub } = ctx;

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const existing = hub.documentCategories ?? [];

  // ── Reorder: set the display order. Must be a permutation of the current
  //    list — this endpoint never adds or drops a category. ──────────────────
  if (action === "reorder") {
    const order: string[] = Array.isArray(body?.order) ? body.order.map((s: unknown) => String(s)) : [];
    const samePermutation =
      order.length === existing.length &&
      JSON.stringify([...order].sort()) === JSON.stringify([...existing].sort());
    if (!samePermutation) {
      return NextResponse.json({ error: "Order must list exactly the existing categories" }, { status: 400 });
    }
    await db.hub.update({ where: { id: hub.id }, data: { documentCategories: order } });
    return NextResponse.json({ categories: order });
  }

  // ── Rename (and merge-on-collision) ────────────────────────────────────────
  if (action === "rename") {
    const oldName = normalize(body?.oldName ?? "");
    const newName = normalize(body?.newName ?? "");
    if (!oldName || !newName) {
      return NextResponse.json({ error: "oldName and newName are required" }, { status: 400 });
    }
    if (newName.length > 40) {
      return NextResponse.json({ error: "Keep names under 40 characters" }, { status: 400 });
    }
    if (!existing.includes(oldName)) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Renaming into an existing (different) category = merge: drop the old name,
    // keep the target's canonical casing, and re-file the old name's docs onto it.
    const target = existing.find((c) => c.toLowerCase() === newName.toLowerCase() && c !== oldName);
    const merged = Boolean(target);
    const canonicalNew = target ?? newName;
    const updated = merged
      ? existing.filter((c) => c !== oldName)
      : existing.map((c) => (c === oldName ? newName : c));

    await db.$transaction([
      db.hub.update({ where: { id: hub.id }, data: { documentCategories: updated } }),
      db.hubDocument.updateMany({ where: { hubId: hub.id, category: oldName }, data: { category: canonicalNew } }),
    ]);
    return NextResponse.json({ categories: updated, renamedTo: canonicalNew, merged });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const ctx = await loadMemberContext(slug, session.user.id, session.user.roles ?? []);
  if (ctx.error) return ctx.error;
  const { hub } = ctx;

  const url = new URL(req.url);
  const name = normalize(url.searchParams.get("name") ?? "");
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const existing = hub.documentCategories ?? [];
  if (!existing.includes(name)) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const updated = existing.filter((c) => c !== name);
  await db.$transaction([
    db.hub.update({ where: { id: hub.id }, data: { documentCategories: updated } }),
    // Docs become uncategorized — they surface under "Uncategorized", not lost.
    db.hubDocument.updateMany({ where: { hubId: hub.id, category: name }, data: { category: null } }),
  ]);
  return NextResponse.json({ categories: updated });
}
