/**
 * POST /api/files/[fileId]/notify — announce a file to the Space (the
 * "posting a document" notification, RIM_GoogleWorkspace.md).
 *
 * Body: { notify: { mode: "none" | "everyone" | "people", userIds? }, note? }.
 * Basecamp-style + per-post: the sharer picks who to email (default no one).
 * Gated by authorizeFileWrite — only a writer of the Space announces a file;
 * recipients are resolved through the notifiable-members pool (pre-threshold /
 * comms-off / paused excluded), and the sender is never notified.
 */

import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  authorizeFileWrite,
  logFileAction,
  resolveNotifyRecipients,
} from "@/lib/googleFiles";
import { sessionDisplayName } from "@/lib/sessionIdentity";
import { sendFileSharedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  let body: { notify?: { mode?: unknown; userIds?: unknown }; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request didn't make sense." }, { status: 400 });
  }

  try {
    const gate = await authorizeFileWrite(await auth(), req, fileId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const { viewer, file, place } = gate.data;

    const recipients = await resolveNotifyRecipients(place, body.notify, viewer.userId);
    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, notified: 0 });
    }
    const note =
      typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
    const actor = await db.user.findUnique({
      where: { id: viewer.userId },
      select: { firstName: true, lastName: true, preferredName: true },
    });
    const sharerName = sessionDisplayName(actor, "A member");

    after(async () => {
      for (const r of recipients) {
        await sendFileSharedEmail({
          to: r.email,
          firstName: r.firstName,
          sharerName,
          fileName: file.name,
          spaceName: place.name,
          note,
          fileId,
        });
      }
    });
    await logFileAction({
      userId: viewer.userId,
      action: "notify-shared",
      googleFileId: fileId,
      hubId: place.hubId,
      detail: { place: place.key, count: recipients.length },
    });
    return NextResponse.json({ ok: true, notified: recipients.length });
  } catch (e) {
    console.error("[files-notify]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't send those notifications. Please try again." },
      { status: 502 },
    );
  }
}
