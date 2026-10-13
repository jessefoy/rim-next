/**
 * One-time (Jesse, 2026-10-13): the note about Leads only, and a kind ask to
 * tidy files before launch, to every team's active leads, one email each
 * (template "leads-files-update"). ADMIN only.
 *   GET  — who would receive it, with their teams (no email sent)
 *   POST — send it; refuses a second run (flag leads_files_note_sent_2026_10_13)
 * The sender (Jesse) and his second account are left out. Remove this route
 * and its panel once it has run.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { filesViewer, isCrossSiteRequest } from "@/lib/googleFiles";
import { sendLeadsFilesUpdateEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FLAG = "leads_files_note_sent_2026_10_13";
const ALSO_SKIP = ["jesse@rootedinmindfulness.org"];

async function adminViewer() {
  const viewer = filesViewer(await auth());
  return viewer && viewer.roles.includes("ADMIN") ? viewer : null;
}

async function recipients(senderId: string) {
  const rows = await db.hubMember.findMany({
    where: {
      isCoordinator: true,
      status: "ACTIVE",
      hub: { status: "ACTIVE" },
      user: { archivedAt: null, emailVerified: { not: null } },
    },
    select: {
      hub: { select: { name: true } },
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
  const byUser = new Map<string, { id: string; email: string; firstName: string | null; name: string; teams: string[] }>();
  for (const r of rows) {
    const u = r.user;
    if (u.id === senderId || !u.email || ALSO_SKIP.includes(u.email.toLowerCase())) continue;
    const entry = byUser.get(u.id) ?? {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
      teams: [],
    };
    entry.teams.push(r.hub.name);
    byUser.set(u.id, entry);
  }
  return [...byUser.values()]
    .map((e) => ({ ...e, teams: e.teams.sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function alreadySent() {
  const rows = await db.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM "_migration_flags" WHERE name = $1`,
    FLAG,
  ).catch(() => []);
  return rows.length > 0;
}

export async function GET() {
  const viewer = await adminViewer();
  if (!viewer) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const list = await recipients(viewer.userId);
  return NextResponse.json({
    sent: await alreadySent(),
    recipients: list.map((r) => ({ name: r.name, teams: r.teams })),
  });
}

export async function POST(req: NextRequest) {
  if (isCrossSiteRequest(req)) return NextResponse.json({ error: "Open this from within RIM." }, { status: 403 });
  const viewer = await adminViewer();
  if (!viewer) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (await alreadySent()) return NextResponse.json({ error: "This note has already gone out." }, { status: 409 });
  // Claim the run first, so a double click can't send twice.
  await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ($1) ON CONFLICT DO NOTHING`, FLAG);
  const list = await recipients(viewer.userId);
  const sent: string[] = [];
  const failed: string[] = [];
  for (const r of list) {
    try {
      await sendLeadsFilesUpdateEmail({ to: r.email, firstName: r.firstName, teamNames: r.teams });
      sent.push(r.name);
    } catch (e) {
      failed.push(r.name);
      console.error("[leads-note] send failed", r.id, e instanceof Error ? e.message : e);
    }
    await new Promise((resolve) => setTimeout(resolve, 600)); // Resend's rate limit
  }
  console.log("[leads-note] sent", sent.length, "failed", failed.length);
  return NextResponse.json({ sent, failed });
}
