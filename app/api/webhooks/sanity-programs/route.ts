/**
 * POST /api/webhooks/sanity-programs
 *
 * Sanity GROQ-powered webhook. Fires whenever a "programs" document is
 * created, updated, or deleted in Sanity Studio.
 *
 * Handles two cases automatically:
 *   UPDATE  — programFormat != "in-person" + startDatetime changed + calendarEventId → patch calendar event
 *   UPDATE  — programFormat changed to "in-person" + calendarEventId → delete calendar event, clear fields
 *   DELETE  — calendarEventId in payload → delete calendar event
 *
 * ── Sanity Webhook Configuration ─────────────────────────────────────────────
 * Dashboard → API → Webhooks → Add webhook:
 *
 *   URL:      https://rim-next.vercel.app/api/webhooks/sanity-programs
 *   Dataset:  production
 *   Trigger on: Create, Update, Delete
 *   Filter:   _type == "programs"
 *   Projection: (optional — handler detects deletes via Sanity query if omitted)
 *     {
 *       "_id": _id,
 *       "_type": _type,
 *       "operation": delta::operation(),
 *       "name": name,
 *       "slug": slug.current,
 *       "programFormat": programFormat,
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
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/google-meet";

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
  operation?: "create" | "update" | "delete"; // from delta::operation() in GROQ projection; optional — inferred from Sanity query if missing
  name?: string;
  slug?: string;
  programFormat?: string;
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

  const { _id, _type } = payload;

  // Only handle programs documents
  if (_type !== "programs") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const {
    name,
    slug,
    programFormat,
    startDatetime,
    endDatetime,
    zoomLink,
    meetHostAccount,
    calendarEventId,
  } = payload;

  // Resolve operation: use payload field (GROQ projection) or detect via Sanity query
  let operation = payload.operation;
  if (!operation) {
    const exists = await sanityClient.fetch<{ _id: string } | null>(
      `*[_id == $_id && !(_id in path("drafts.**"))][0] { _id }`,
      { _id }
    );
    operation = exists ? "update" : "delete";
  }

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

  // Case A: Switched to in-person — clean up existing Meet room booking
  if (programFormat === "in-person" && calendarEventId && meetHostAccount) {
    try {
      await deleteCalendarEvent({ calendarEventId, roomEmail: meetHostAccount });
      await sanityClient
        .patch(_id)
        .unset(["zoomLink", "meetHostAccount", "calendarEventId"])
        .commit();
      console.log(`[sanity-webhook] Cleared Meet fields for in-person program ${slug}`);
    } catch (err) {
      console.error("[sanity-webhook] Cleanup on programFormat=in-person failed:", err);
    }
    return NextResponse.json({ ok: true });
  }

  // Skip if in-person (nothing to do) or no startDatetime (can't update calendar)
  if (programFormat === "in-person" || !startDatetime) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Default endDatetime to 1 hour after start
  const resolvedEnd =
    endDatetime ??
    new Date(new Date(startDatetime).getTime() + 60 * 60 * 1000).toISOString();

  const programName = name ?? slug ?? _id;

  // Case B: Meet exists + calendar event tracked → update the calendar event time
  // (Registrars create Meet links manually from the Registrar Area — no auto-create here)
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

  return NextResponse.json({ ok: true, skipped: true });
}
