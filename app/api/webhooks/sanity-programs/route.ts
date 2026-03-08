/**
 * POST /api/webhooks/sanity-programs
 *
 * Sanity GROQ-powered webhook. Fires whenever a "programs" document is
 * created, updated, or deleted in Sanity Studio.
 *
 * Handles three cases automatically:
 *   CREATE  — isVirtual + startDatetime + no zoomLink → create Meet, write back fields
 *   UPDATE  — isVirtual + startDatetime changed + calendarEventId → patch calendar event
 *   UPDATE  — isVirtual turned OFF + calendarEventId → delete calendar event, clear fields
 *   DELETE  — calendarEventId in payload → delete calendar event
 *
 * ── Sanity Webhook Configuration ─────────────────────────────────────────────
 * Dashboard → API → Webhooks → Add webhook:
 *
 *   URL:      https://rim-next.vercel.app/api/webhooks/sanity-programs
 *   Dataset:  production
 *   Trigger on: Create, Update, Delete
 *   Filter:   _type == "programs"
 *   Projection:
 *     {
 *       "_id": _id,
 *       "_type": _type,
 *       "operation": delta::operation(),
 *       "name": name,
 *       "slug": slug.current,
 *       "isVirtual": isVirtual,
 *       "startDatetime": startDatetime,
 *       "endDatetime": endDatetime,
 *       "zoomLink": zoomLink,
 *       "meetHostAccount": meetHostAccount,
 *       "calendarEventId": calendarEventId
 *     }
 *   HTTP method: POST
 *   Secret: <value of SANITY_WEBHOOK_SECRET env var>
 *
 * ── Env vars required ─────────────────────────────────────────────────────────
 *   SANITY_WEBHOOK_SECRET  — set in Vercel, matches the secret in Sanity Dashboard
 *   SANITY_API_TOKEN       — already set (Editor role)
 *   GOOGLE_*               — already set (service account + room emails)
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sanityClient } from "@/lib/sanity";
import { createMeeting, updateCalendarEvent, deleteCalendarEvent } from "@/lib/google-meet";

// ── Signature verification ────────────────────────────────────────────────────

function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;

  // Format: "t=<timestamp>,v1=<hmac-sha256>"
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=", 2) as [string, string])
  );
  const { t: timestamp, v1: hash } = parts;
  if (!timestamp || !hash) return false;

  // Reject payloads older than 5 minutes
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

// ── Webhook payload type ──────────────────────────────────────────────────────

interface ProgramWebhookPayload {
  _id: string;
  _type: string;
  operation: "create" | "update" | "delete";
  name?: string;
  slug?: string;
  isVirtual?: boolean;
  startDatetime?: string | null;
  endDatetime?: string | null;
  zoomLink?: string | null;
  meetHostAccount?: string | null;
  calendarEventId?: string | null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[sanity-webhook] SANITY_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Read raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("sanity-webhook-signature");

  if (!verifySignature(rawBody, signature, secret)) {
    console.warn("[sanity-webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: ProgramWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { _id, _type, operation } = payload;

  // Only handle programs documents
  if (_type !== "programs") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const {
    name,
    slug,
    isVirtual,
    startDatetime,
    endDatetime,
    zoomLink,
    meetHostAccount,
    calendarEventId,
  } = payload;

  console.log(`[sanity-webhook] programs ${operation} — ${slug ?? _id}`);

  // ── DELETE: clean up the calendar event if we have its ID ──────────────────
  if (operation === "delete") {
    if (calendarEventId && meetHostAccount) {
      try {
        await deleteCalendarEvent({ calendarEventId, roomEmail: meetHostAccount });
        console.log(`[sanity-webhook] Deleted calendar event ${calendarEventId} for deleted program ${_id}`);
      } catch (err) {
        // Non-fatal: the event may already be gone or the program was in-person
        console.error("[sanity-webhook] deleteCalendarEvent on DELETE failed:", err);
      }
    }
    return NextResponse.json({ ok: true });
  }

  // ── CREATE / UPDATE ────────────────────────────────────────────────────────

  // Case A: Virtual turned OFF — clean up existing Meet room booking
  if (!isVirtual && calendarEventId && meetHostAccount) {
    try {
      await deleteCalendarEvent({ calendarEventId, roomEmail: meetHostAccount });
      await sanityClient
        .patch(_id)
        .unset(["zoomLink", "meetHostAccount", "calendarEventId"])
        .commit();
      console.log(`[sanity-webhook] Cleared Meet fields for in-person program ${slug}`);
    } catch (err) {
      console.error("[sanity-webhook] Cleanup on isVirtual=false failed:", err);
    }
    return NextResponse.json({ ok: true });
  }

  // Skip if not virtual or no startDatetime
  if (!isVirtual || !startDatetime) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Default endDatetime to 1 hour after start
  const resolvedEnd =
    endDatetime ??
    new Date(new Date(startDatetime).getTime() + 60 * 60 * 1000).toISOString();

  const programName = name ?? slug ?? _id;

  // Case B: Meet exists + calendar event tracked → update the calendar event time
  if (zoomLink && calendarEventId && meetHostAccount) {
    try {
      await updateCalendarEvent({
        calendarEventId,
        roomEmail: meetHostAccount,
        title: programName,
        startDatetime,
        endDatetime: resolvedEnd,
      });
      console.log(`[sanity-webhook] Updated calendar event for ${slug}`);
    } catch (err) {
      console.error("[sanity-webhook] updateCalendarEvent failed:", err);
    }
    return NextResponse.json({ ok: true });
  }

  // Case C: No Meet yet — create one
  if (!zoomLink) {
    try {
      const result = await createMeeting({
        title: programName,
        startDatetime,
        endDatetime: resolvedEnd,
        programSlug: slug ?? _id,
      });

      await sanityClient
        .patch(_id)
        .set({
          zoomLink: result.meetLink,
          meetHostAccount: result.roomEmail,
          calendarEventId: result.calendarEventId,
        })
        .commit();

      console.log(`[sanity-webhook] Created Meet for ${slug} — ${result.meetLink} (${result.roomEmail})`);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "";
      if (msg.startsWith("NO_ROOM_AVAILABLE")) {
        console.error(`[sanity-webhook] No room available for ${slug} at ${startDatetime}`);
      } else {
        console.error("[sanity-webhook] createMeeting failed:", err);
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, skipped: true });
}
