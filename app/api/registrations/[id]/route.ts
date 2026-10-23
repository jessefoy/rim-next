import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { RegistrationStatus, DonationStatus } from "@prisma/client";
import {
  sendApprovalEmail,
  sendCancellationNotificationEmail,
  sendDanaReminderEmail,
  sendEditRequestEmail,
  sendRegistrationEmail,
  sendReminderEmail,
} from "@/lib/email";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { buildGoogleCalendarUrl, buildIcsUrl } from "@/lib/calendarLinks";
import { emailLocationFor } from "@/lib/locations";
import { buildDateLabel } from "@/lib/dateLabel";
import { requiredDanaCents } from "@/lib/programUtils";
import { addRegistrationToFlodesk, removeRegistrationFromFlodesk } from "@/lib/flodesk";
import { canUseRegistration } from "@/lib/toolAuth";
import { recordRegistrationEvent } from "@/lib/registrationEvents";

// ─── PATCH — update status, notes, donationStatus, or send dana reminder ─────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, status, notes, donationStatus, danaMode, customFields } = body;

    // ── Special action: send self-service edit request email ─────────────────
    if (action === "sendEditRequest") {
      const reg = await db.registration.findUnique({ where: { id } });
      if (!reg || reg.status === "CANCELLED") {
        return NextResponse.json({ error: "Invalid registration" }, { status: 400 });
      }
      const token   = crypto.randomUUID();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await db.registration.update({
        where: { id },
        data: { editToken: token, editTokenExpiresAt: expires },
      });
      await sendEditRequestEmail({
        to:           reg.email,
        firstName:    reg.firstName,
        programTitle: reg.programTitle,
        token,
      });
      await recordRegistrationEvent({ kind: "edit-link-sent", programId: reg.programId, programSlug: reg.programSlug, registrationId: id, actorId: session.user.id });
      return NextResponse.json({ ok: true });
    }

    // ── Special action: send program reminder email ───────────────────────────
    if (action === "sendReminder") {
      const reg = await db.registration.findUnique({ where: { id } });
      if (!reg || reg.status === "CANCELLED") {
        return NextResponse.json({ error: "Invalid registration" }, { status: 400 });
      }
      const pgProgram = await db.program.findUnique({ where: { slug: reg.programSlug } });
      const loc = emailLocationFor(pgProgram ?? {});
      const startIso = pgProgram?.startDatetime?.toISOString() ?? null;
      const endIso = pgProgram?.endDatetime?.toISOString() ?? null;
      await sendReminderEmail({
        to:           reg.email,
        firstName:    reg.firstName,
        programTitle: reg.programTitle,
        programSlug:  reg.programSlug,
        dateText:     pgProgram?.dateText || buildDateLabel({
          startDatetime: startIso,
          endDatetime: endIso,
          recurrenceFreq: pgProgram?.recurrenceFreq ?? null,
          recurrenceInterval: pgProgram?.recurrenceInterval ?? null,
          recurrenceDays: pgProgram?.recurrenceDays ?? null,
        }) || undefined,
        locationText: loc.emailText,
        locationLink: loc.link,
        reminderMessage: pgProgram?.reminderMessage,
      });
      const updated = await db.registration.update({
        where: { id },
        data: { reminderSentAt: new Date() },
      });
      await recordRegistrationEvent({ kind: "reminder-sent", programId: reg.programId, programSlug: reg.programSlug, registrationId: id, actorId: session.user.id });
      return NextResponse.json({ ok: true, reminderSentAt: updated.reminderSentAt?.toISOString() });
    }

    // ── Special action: send dana reminder email ──────────────────────────────
    if (action === "sendDanaReminder") {
      const reg = await db.registration.findUnique({ where: { id } });
      if (!reg) {
        return NextResponse.json({ error: "Registration not found" }, { status: 404 });
      }
      if (reg.donationStatus !== "PENDING") {
        return NextResponse.json(
          { error: "Dana reminder only applies to registrations with PENDING dana" },
          { status: 400 }
        );
      }
      await sendDanaReminderEmail({
        to:           reg.email,
        firstName:    reg.firstName,
        programTitle: reg.programTitle,
        programSlug:  reg.programSlug,
        registrationId: reg.id,
      });
      await recordRegistrationEvent({ kind: "dana-reminder-sent", programId: reg.programId, programSlug: reg.programSlug, registrationId: id, actorId: session.user.id });
      return NextResponse.json({ ok: true });
    }

    // ── Special action: resend registration confirmation email ────────────────
    if (action === "resendConfirmation") {
      const reg = await db.registration.findUnique({ where: { id } });
      if (!reg || reg.status === "CANCELLED") {
        return NextResponse.json({ error: "Invalid registration" }, { status: 400 });
      }
      // Fetch program data from Postgres for email content + calendar links
      const pgProgram = await db.program.findUnique({ where: { slug: reg.programSlug } });

      let confirmationMessageHtml: string | undefined;
      let confirmationMessageText: string | undefined;
      if (pgProgram?.confirmationMessage) {
        const html = await renderFormattedTextAsync(pgProgram.confirmationMessage);
        if (html) {
          confirmationMessageHtml = html;
          confirmationMessageText = html.replace(/<[^>]+>/g, "");
        }
      }

      const loc = emailLocationFor(pgProgram ?? {});
      const startIso = pgProgram?.startDatetime?.toISOString() ?? null;
      const endIso = pgProgram?.endDatetime?.toISOString() ?? null;

      let googleCalendarUrl: string | undefined;
      let icsUrl: string | undefined;
      if (startIso && reg.status !== "WAITLISTED") {
        googleCalendarUrl = buildGoogleCalendarUrl({
          title: reg.programTitle,
          startDatetime: startIso,
          endDatetime: endIso,
          location: loc.emailText ?? undefined,
          programSlug: reg.programSlug,
          recurrenceFreq: pgProgram?.recurrenceFreq ?? null,
          recurrenceInterval: pgProgram?.recurrenceInterval ?? null,
          recurrenceDays: pgProgram?.recurrenceDays ?? null,
          recurrenceCount: pgProgram?.recurrenceCount ?? null,
        });
        icsUrl = buildIcsUrl(reg.programSlug);
      }

      await sendRegistrationEmail({
        to:            reg.email,
        firstName:     reg.firstName,
        programTitle:  reg.programTitle,
        programSlug:   reg.programSlug,
        status:        reg.status === "WAITLISTED" ? "WAITLISTED" : "REGISTERED",
        waitlistPosition: reg.waitlistPosition,
        dateText:      pgProgram?.dateText || buildDateLabel({
          startDatetime: startIso,
          endDatetime: endIso,
          recurrenceFreq: pgProgram?.recurrenceFreq ?? null,
          recurrenceInterval: pgProgram?.recurrenceInterval ?? null,
          recurrenceDays: pgProgram?.recurrenceDays ?? null,
        }) || undefined,
        locationText:  loc.emailText,
        locationUrl:   loc.emailLink,
        confirmationMessageHtml,
        confirmationMessageText,
        googleCalendarUrl,
        icsUrl,
      });
      await recordRegistrationEvent({ kind: "confirmation-resent", programId: reg.programId, programSlug: reg.programSlug, registrationId: id, actorId: session.user.id });

      return NextResponse.json({ ok: true });
    }

    // ── Standard field updates ────────────────────────────────────────────────

    // Validate enum values if provided
    if (status && !Object.values(RegistrationStatus).includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (donationStatus && !Object.values(DonationStatus).includes(donationStatus)) {
      return NextResponse.json({ error: "Invalid donationStatus" }, { status: 400 });
    }

    // Fetch current record so we can detect status transitions
    const current = await db.registration.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Detect waitlist promotion (WAITLISTED → APPROVED or REGISTERED)
    const isPromotion =
      current.status === "WAITLISTED" &&
      (status === "APPROVED" || status === "REGISTERED");

    // Auto-set donationStatus on promotion unless caller explicitly overrides it.
    // The dana shape comes from the program record, never the request body: a
    // program that REQUIRES payment (fixed / base + dana with an amount) must
    // leave the promoted member owing it, and the approval email must say so
    // rather than call it optional.
    const promotedProgram = isPromotion && current.programId
      ? await db.program.findUnique({
          where: { id: current.programId },
          select: { danaMode: true, danaFixedAmount: true, danaBaseAmount: true },
        })
      : null;
    const programDanaMode = promotedProgram?.danaMode ?? danaMode ?? "none";
    const requiredCents = promotedProgram ? requiredDanaCents(promotedProgram) : 0;
    let resolvedDonationStatus: DonationStatus | undefined = donationStatus as DonationStatus | undefined;
    if (isPromotion && !donationStatus) {
      // Owed (a required amount) or invited (voluntary) stays PENDING. A
      // fixed/base program with no amount set asks for nothing, as at
      // registration, so it's WAIVED rather than stuck at $0.
      resolvedDonationStatus =
        requiredCents > 0 || programDanaMode === "voluntary" ? "PENDING" : "WAIVED";
    }

    const registration = await db.registration.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(resolvedDonationStatus && { donationStatus: resolvedDonationStatus }),
        ...(customFields !== undefined && { customFields }),
      },
      select: { id: true, status: true, donationStatus: true, waitlistPosition: true },
    });

    // The program's history: who changed what (2026-10-23).
    const who = { programId: current.programId, programSlug: current.programSlug, registrationId: id, actorId: session.user.id };
    if (status && status !== current.status) {
      await recordRegistrationEvent({ ...who, kind: "status-changed", detail: { from: current.status, to: status } });
    }
    if (donationStatus && donationStatus !== current.donationStatus) {
      await recordRegistrationEvent({ ...who, kind: "dana-changed", detail: { from: current.donationStatus, to: donationStatus } });
    }
    if (customFields !== undefined && JSON.stringify(customFields) !== JSON.stringify(current.customFields)) {
      await recordRegistrationEvent({ ...who, kind: "answers-edited" });
    }

    // Send approval email when promoted from waitlist
    if (isPromotion) {
      await sendApprovalEmail({
        to:           current.email,
        firstName:    current.firstName,
        programTitle: current.programTitle,
        programSlug:  current.programSlug,
        danaMode:     programDanaMode,
        requiredCents,
        registrationId: id,
      });
    }

    // The program's Flodesk segment. A registrar's change into a confirmed
    // status (waitlist promotion, or restoring a cancelled registration)
    // bypasses the confirmation choke point, so it joins here; a cancellation
    // leaves the segment. Best-effort, after the response.
    const confirmed = (s: string) => s === "REGISTERED" || s === "APPROVED";
    if (status && confirmed(status) && !confirmed(current.status)) await addRegistrationToFlodesk(id);

    // Notify registrar when any registration is cancelled
    const isCancellation = status === "CANCELLED" && current.status !== "CANCELLED";
    if (isCancellation) await removeRegistrationFromFlodesk(id, current.status);
    if (isCancellation) {
      await sendCancellationNotificationEmail({
        registrantName:  `${current.firstName} ${current.lastName}`,
        registrantEmail: current.email,
        programTitle:    current.programTitle,
        programSlug:     current.programSlug,
      });
    }

    return NextResponse.json({ success: true, registration });
  } catch (error) {
    console.error("Update registration error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// ─── DELETE — permanently remove a CANCELLED registration ─────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const registration = await db.registration.findUnique({ where: { id } });
    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Guard: only CANCELLED records may be permanently deleted
    if (registration.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Only CANCELLED registrations may be deleted. Cancel it first." },
        { status: 400 }
      );
    }

    await db.registration.delete({ where: { id } });
    // Its notes go with it; its history stays, with this last line.
    await db.registrationNote.deleteMany({ where: { registrationId: id } }).catch((err) => {
      console.error("[registrations] notes cleanup failed:", err);
    });
    await recordRegistrationEvent({
      kind: "deleted",
      programId: registration.programId,
      programSlug: registration.programSlug,
      registrationId: id,
      actorId: session.user.id,
      detail: { name: `${registration.firstName} ${registration.lastName}`.trim() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete registration error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
