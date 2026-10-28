import "server-only";
import { after } from "next/server";
import { Prisma, RegistrationStatus, DonationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { SaveActor, SaveReply } from "@/lib/programSave";
import { accountForFormerEmail } from "@/lib/formerEmail";
import { toProperName } from "@/lib/nameCase";
import { sendRegistrationConfirmation } from "@/lib/registrationConfirmation";
import { enrollMemberInProgramCourse } from "@/lib/enrollment";
import { addRegistrationToFlodesk, removeRegistrationFromFlodesk, getFlodeskSegment } from "@/lib/flodesk";
import {
  sendApprovalEmail,
  sendCancellationNotificationEmail,
  sendRegistrationCancelledEmail,
  sendDanaReminderEmail,
  sendEditRequestEmail,
  sendRegistrationEmail,
  sendReminderEmail,
  sendEachPaced,
  sendRegistrationMessageEmail,
} from "@/lib/email";
import { recordRegistrationEvent, staffName } from "@/lib/registrationEvents";
import { countPlacesTaken } from "@/lib/registrationPlaces";
import { answersForNewRegistration, mergeAnswers, type QuestionLike } from "@/lib/registrationAnswers";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { buildGoogleCalendarUrl, buildIcsUrl } from "@/lib/calendarLinks";
import { emailLocationFor } from "@/lib/locations";
import { buildDateLabel } from "@/lib/dateLabel";
import { requiredDanaCents } from "@/lib/programUtils";
import { centralToUtc } from "@/lib/timezone";
import { MESSAGE_MAX_PEOPLE } from "@/lib/programUpdate";

/**
 * The Registration app's actions (2026-10-28): each route's steps moved here
 * unchanged, so the RIM Guide does exactly what the buttons do
 * (lib/guideRegistration.ts). Whoever calls one has already checked
 * canUseRegistration. Each answers with the status and body its route sends.
 * The routes' own notes on each step stay above their handlers.
 */

const reply = (payload: unknown, init?: { status?: number }): SaveReply => ({
  status: init?.status ?? 200,
  body: payload as Record<string, unknown>,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/programs/[slug]/people: Add a person. */
export async function addPerson(actor: SaveActor, slug: string, body: Record<string, unknown>): Promise<SaveReply> {
  const firstName = toProperName(typeof body.firstName === "string" ? body.firstName : "").trim();
  const lastName = toProperName(typeof body.lastName === "string" ? body.lastName : "").trim();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  // Chosen by the team, never assumed (2026-10-26: "online" emails a link).
  const dana = body.dana === "given" || body.dana === "none" || body.dana === "online" ? body.dana : null;
  const sendConfirmation = body.sendConfirmation !== false;
  // What the page showed: a place, or the waiting list. If that changed since
  // it loaded, say so rather than record dana for a place they didn't get.
  const expectPlace = body.expectPlace !== false;

  if (!firstName || !lastName || !email) {
    return reply({ error: "Fill in their first name, last name and email." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return reply({ error: "That email address doesn't look complete." }, { status: 400 });
  }

  const program = await db.program.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      archivedAt: true,
      registrationEnabled: true,
      registrationCapacity: true,
      danaMode: true,
      danaFixedAmount: true,
      danaBaseAmount: true,
      registrationFields: true,
    },
  });
  if (!program || program.archivedAt || !program.registrationEnabled) {
    return reply({ error: "This program isn't taking registrations." }, { status: 404 });
  }

  // The person: their account by address, or by an address they used to use.
  let user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true },
  });
  if (!user) {
    const moved = await accountForFormerEmail(email);
    if (moved) {
      user = await db.user.findUnique({
        where: { id: moved.id },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
      });
    }
  }

  // Already here, by account or by address? Say where they are rather than
  // adding them twice. A place held while they pay online is theirs: adding
  // them beside it made two registrations once the payment finished.
  const existing = await db.registration.findMany({
    where: {
      programId: program.id,
      OR: [
        ...(user ? [{ userId: user.id }] : []),
        { email: { equals: email, mode: "insensitive" as const } },
      ],
    },
    select: { status: true },
  });
  const has = (...s: string[]) => existing.some((r) => s.includes(r.status));
  const refusal = has("PENDING_PAYMENT")
    ? "They're paying online right now, and their place is held. Wait for that to finish, or try again in an hour."
    : has("REGISTERED", "APPROVED")
    ? "They're already registered."
    : has("WAITLISTED")
    ? "They're already on the waiting list."
    : has("CANCELLED")
    ? "Their registration was cancelled; restore it from their card."
    : null;
  if (refusal) return reply({ error: refusal }, { status: 409 });

  // The place, counted as the public form counts it: a held place is taken.
  const [taken, waiting] = await Promise.all([
    countPlacesTaken(program.id),
    db.registration.count({ where: { programId: program.id, status: "WAITLISTED" } }),
  ]);
  const hasPlace = program.registrationCapacity == null || taken < program.registrationCapacity;
  const status = hasPlace ? "REGISTERED" : "WAITLISTED";
  if (hasPlace !== expectPlace) {
    return reply(
      { error: hasPlace ? "A place has opened since this page loaded. Reload the page, then add them." : "The program filled since this page loaded. Reload the page, then add them." },
      { status: 409 },
    );
  }

  // Dana: the program decides whether it's asked; the team says how it went.
  const requiresPayment =
    (program.danaMode === "fixed" && (program.danaFixedAmount ?? 0) > 0) ||
    (program.danaMode === "base_plus_dana" && (program.danaBaseAmount ?? 0) > 0);
  const asksDana = program.danaMode === "voluntary" || requiresPayment;
  if (hasPlace && asksDana && !dana) {
    return reply({ error: "Choose how they'll give dana." }, { status: 400 });
  }
  const donationStatus = !hasPlace
    ? "NOT_REQUIRED" // waiting: asked when offered a place
    : !asksDana
    ? "WAIVED"
    : dana === "given"
    ? "COMPLETED"
    : dana === "none"
    ? "WAIVED"
    : "PENDING";

  // The program's questions, as the public form reads them (a malformed entry is skipped).
  const questions = ((Array.isArray(program.registrationFields) ? program.registrationFields : []) as unknown as (QuestionLike | null)[])
    .filter((q): q is QuestionLike => !!q && typeof q.label === "string");
  const answers = answersForNewRegistration(body.customFields, questions) as Prisma.InputJsonObject | null;

  // A new person becomes a member, as on the public form; they agree to the
  // agreements themselves when they first sign in.
  let userId = user?.id ?? null;
  if (user) {
    const updates: Record<string, string> = {};
    if (!user.firstName) updates.firstName = firstName;
    if (!user.lastName) updates.lastName = lastName;
    if (!user.phone && phone) updates.phone = phone;
    if (Object.keys(updates).length) await db.user.update({ where: { id: user.id }, data: updates });
  } else {
    const created = await db.user.create({
      data: { email, firstName, lastName, phone, agreedToTerms: false },
      select: { id: true },
    });
    userId = created.id;
  }

  const registration = await db.registration.create({
    data: {
      programId: program.id,
      programSlug: program.slug,
      programTitle: program.name,
      userId,
      email: user?.email.trim().toLowerCase() ?? email,
      firstName: user?.firstName || firstName,
      lastName: user?.lastName || lastName,
      phone: user?.phone || phone,
      status,
      waitlistPosition: hasPlace ? null : waiting + 1,
      donationStatus,
      // What they told the team, by question id, as the public form keeps it.
      ...(answers ? { customFields: answers } : {}),
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  await recordRegistrationEvent({
    kind: "added",
    programId: program.id,
    programSlug: program.slug,
    registrationId: registration.id,
    actorId: actor.id,
    detail: { status, donationStatus, emailed: sendConfirmation || (status === "REGISTERED" && donationStatus === "PENDING") },
  });

  // Course access comes with the place, except a price still to be paid: as
  // on the public form, the webhook gives it on payment.
  const awaitsPayment = requiresPayment && donationStatus === "PENDING";
  if (status === "REGISTERED" && userId && !awaitsPayment) {
    const enrollUserId = userId;
    after(async () => {
      try {
        await enrollMemberInProgramCourse(enrollUserId, program.id);
      } catch (err) {
        console.error("[programs/people] enrollMemberInProgramCourse failed", err);
      }
    });
  }

  if (status === "REGISTERED" && donationStatus === "PENDING") {
    // Giving online: the dana link now; the confirmation follows the choice.
    await sendDanaReminderEmail({
      to: registration.email,
      firstName: registration.firstName,
      programTitle: program.name,
      programSlug: program.slug,
      registrationId: registration.id,
    });
  } else if (sendConfirmation) {
    // The choke point: their confirmation (or waiting-list email), support@'s
    // notice, and the program's mailing list.
    await sendRegistrationConfirmation(registration.id);
  } else {
    // No email, but a registered person still joins the program's mailing list.
    await addRegistrationToFlodesk(registration.id);
  }

  return reply({
    ok: true,
    status,
    name: `${registration.firstName} ${registration.lastName}`.trim(),
    email: registration.email,
  });
}

/** PATCH /api/registrations/[id]: a registration's status, dana, answers, and the email actions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function changeRegistration(actor: SaveActor, id: string, body: any): Promise<SaveReply> {
  const { action, status, notes, donationStatus, danaMode, customFields } = body;
  // The Registration app's "Email them to say so" on a cancellation.
  const notifyPerson = body.notifyPerson === true;

  // ── Special action: send self-service edit request email ─────────────────
  if (action === "sendEditRequest") {
    const reg = await db.registration.findUnique({ where: { id } });
    if (!reg || reg.status === "CANCELLED") {
      return reply({ error: "Invalid registration" }, { status: 400 });
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
    await recordRegistrationEvent({ kind: "edit-link-sent", programId: reg.programId, programSlug: reg.programSlug, registrationId: id, actorId: actor.id });
    return reply({ ok: true });
  }

  // ── Special action: send program reminder email ───────────────────────────
  if (action === "sendReminder") {
    const reg = await db.registration.findUnique({ where: { id } });
    if (!reg || reg.status === "CANCELLED") {
      return reply({ error: "Invalid registration" }, { status: 400 });
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
      timeText: pgProgram?.timeText ?? null,
      locationText: loc.emailText,
      locationLink: loc.link,
      reminderMessage: pgProgram?.reminderMessage,
    });
    const updated = await db.registration.update({
      where: { id },
      data: { reminderSentAt: new Date() },
    });
    await recordRegistrationEvent({ kind: "reminder-sent", programId: reg.programId, programSlug: reg.programSlug, registrationId: id, actorId: actor.id });
    return reply({ ok: true, reminderSentAt: updated.reminderSentAt?.toISOString() });
  }

  // ── Special action: send dana reminder email ──────────────────────────────
  if (action === "sendDanaReminder") {
    const reg = await db.registration.findUnique({ where: { id } });
    if (!reg) {
      return reply({ error: "Registration not found" }, { status: 404 });
    }
    if (reg.donationStatus !== "PENDING") {
      return reply(
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
    await recordRegistrationEvent({ kind: "dana-reminder-sent", programId: reg.programId, programSlug: reg.programSlug, registrationId: id, actorId: actor.id });
    return reply({ ok: true });
  }

  // ── Special action: resend registration confirmation email ────────────────
  if (action === "resendConfirmation") {
    const reg = await db.registration.findUnique({ where: { id } });
    if (!reg || reg.status === "CANCELLED") {
      return reply({ error: "Invalid registration" }, { status: 400 });
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
        recurrenceUntil: pgProgram?.recurrenceUntil ?? null,
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
    await recordRegistrationEvent({ kind: "confirmation-resent", programId: reg.programId, programSlug: reg.programSlug, registrationId: id, actorId: actor.id });

    return reply({ ok: true });
  }

  // ── Standard field updates ────────────────────────────────────────────────

  // Validate enum values if provided
  if (status && !Object.values(RegistrationStatus).includes(status)) {
    return reply({ error: "Invalid status" }, { status: 400 });
  }
  if (donationStatus && !Object.values(DonationStatus).includes(donationStatus)) {
    return reply({ error: "Invalid donationStatus" }, { status: 400 });
  }

  // Fetch current record so we can detect status transitions
  const current = await db.registration.findUnique({ where: { id } });
  if (!current) {
    return reply({ error: "Registration not found" }, { status: 404 });
  }

  // Detect waitlist promotion (WAITLISTED → APPROVED or REGISTERED)
  // Changed answers merged over what's stored, by question id; an old
  // answer stored by wording is kept, never rewritten (lib/registrationAnswers.ts).
  let mergedAnswers: Prisma.InputJsonObject | undefined;
  if (customFields !== undefined) {
    const prog = await db.program.findUnique({ where: { slug: current.programSlug }, select: { registrationFields: true } });
    const questions = Array.isArray(prog?.registrationFields)
      ? (prog.registrationFields as unknown as QuestionLike[]).filter((q) => q && typeof q.label === "string")
      : [];
    mergedAnswers = mergeAnswers(current.customFields, customFields, questions) as Prisma.InputJsonObject;
  }

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

  // The team settling dana (given another way, or none) finishes a
  // registration still waiting on its dana choice. Its confirmation was held
  // until that choice, and the cleanup cron only finishes rows still PENDING,
  // so without this the person was never confirmed (2026-10-27). Claimed by
  // a guarded update so the cron, decline, the Stripe webhook or a second
  // click can't send it twice; a screen that is out of date (the dana was
  // settled meanwhile) is told so instead of overwriting what happened.
  const confirmedStatus = (s: string) => s === "REGISTERED" || s === "APPROVED";
  const alreadySettled = () => reply(
    { error: "Their dana was already settled. Reload the page to see where it stands." },
    { status: 409 },
  );
  let confirmNow = false;
  if (!isPromotion && !status && (donationStatus === "COMPLETED" || donationStatus === "WAIVED")) {
    if (current.donationStatus !== "PENDING") return alreadySettled();
    if (confirmedStatus(current.status)) {
      const claim = await db.registration.updateMany({
        where: { id, status: { in: ["REGISTERED", "APPROVED"] }, donationStatus: "PENDING" },
        data: { donationStatus },
      });
      if (claim.count === 0) return alreadySettled();
      confirmNow = true;
    }
  }

  const registration = await db.registration.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(resolvedDonationStatus && { donationStatus: resolvedDonationStatus }),
      ...(mergedAnswers !== undefined && { customFields: mergedAnswers }),
    },
    select: { id: true, status: true, donationStatus: true, waitlistPosition: true },
  });

  // The program's history: who changed what (2026-10-23).
  const who = { programId: current.programId, programSlug: current.programSlug, registrationId: id, actorId: actor.id };
  if (status && status !== current.status) {
    await recordRegistrationEvent({
      ...who,
      kind: "status-changed",
      detail: { from: current.status, to: status, ...(status === "CANCELLED" ? { emailed: notifyPerson } : {}) },
    });
  }
  // The held confirmation, through the one choke point (support@'s notice
  // and the program's mailing list come with it, as from the cron).
  if (confirmNow) {
    try {
      await sendRegistrationConfirmation(id);
    } catch (err) {
      confirmNow = false;
      console.error(`[registrations PATCH] confirmation failed for ${id}`, err);
    }
  }
  if (donationStatus && donationStatus !== current.donationStatus) {
    await recordRegistrationEvent({ ...who, kind: "dana-changed", detail: { from: current.donationStatus, to: donationStatus, emailed: confirmNow } });
  }
  if (mergedAnswers !== undefined && JSON.stringify(mergedAnswers) !== JSON.stringify(current.customFields ?? {})) {
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
  if (status && confirmedStatus(status) && !confirmedStatus(current.status)) await addRegistrationToFlodesk(id);

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
    if (notifyPerson) {
      await sendRegistrationCancelledEmail({
        to:           current.email,
        firstName:    current.firstName,
        programTitle: current.programTitle,
        programSlug:  current.programSlug,
      });
    }
  }

  return reply({ success: true, registration, confirmationSent: confirmNow });
}

/** DELETE /api/registrations/[id]: remove a cancelled registration for good. */
export async function deleteRegistration(actor: SaveActor, id: string): Promise<SaveReply> {
  const registration = await db.registration.findUnique({ where: { id } });
  if (!registration) {
    return reply({ error: "Registration not found" }, { status: 404 });
  }

  // Guard: only CANCELLED records may be permanently deleted
  if (registration.status !== "CANCELLED") {
    return reply(
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
    actorId: actor.id,
    detail: { name: `${registration.firstName} ${registration.lastName}`.trim() },
  });
  return reply({ ok: true });
}

const MAX_NOTE = 4000;

/** POST /api/registrations/[id]/notes: add a note. */
export async function addRegistrationNote(actor: SaveActor, id: string, body: { body?: unknown; forTeacher?: unknown }): Promise<SaveReply> {
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return reply({ error: "Write the note first." }, { status: 400 });
  if (text.length > MAX_NOTE) {
    return reply({ error: `A note can be up to ${MAX_NOTE} characters.` }, { status: 400 });
  }
  const forTeacher = body.forTeacher === true;

  const reg = await db.registration.findUnique({
    where: { id },
    select: { id: true, programId: true, programSlug: true },
  });
  if (!reg) return reply({ error: "Registration not found" }, { status: 404 });

  const [note, author] = await Promise.all([
    db.registrationNote.create({
      data: { registrationId: id, authorId: actor.id, body: text, forTeacher },
    }),
    db.user.findUnique({
      where: { id: actor.id },
      select: { firstName: true, lastName: true, preferredName: true },
    }),
  ]);
  await recordRegistrationEvent({
    kind: "note-added",
    programId: reg.programId,
    programSlug: reg.programSlug,
    registrationId: id,
    actorId: actor.id,
    detail: { forTeacher },
  });

  return reply({
    note: {
      id: note.id,
      body: note.body,
      forTeacher: note.forTeacher,
      authorName: staffName(author),
      createdAt: note.createdAt.toISOString(),
    },
  });
}

const MAX_PEOPLE = MESSAGE_MAX_PEOPLE;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 10000;

type To = "registered" | "waiting" | "both";
const STATUSES: Record<To, ("REGISTERED" | "APPROVED" | "WAITLISTED")[]> = {
  registered: ["REGISTERED", "APPROVED"],
  waiting: ["WAITLISTED"],
  both: ["REGISTERED", "APPROVED", "WAITLISTED"],
};

/** POST /api/programs/[slug]/message: Message people (sent one at a time after the response). */
export async function messagePeople(actor: SaveActor, slug: string, body: Record<string, unknown>): Promise<SaveReply> {
  const to: To = body.to === "waiting" || body.to === "both" ? body.to : "registered";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const test = body.test === true;

  if (!subject || !message) {
    return reply({ error: "Write a subject and a message." }, { status: 400 });
  }
  if (subject.length > MAX_SUBJECT) {
    return reply({ error: `A subject can be up to ${MAX_SUBJECT} characters.` }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return reply({ error: `A message can be up to ${MAX_MESSAGE} characters.` }, { status: 400 });
  }

  const program = await db.program.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!program) return reply({ error: "Program not found" }, { status: 404 });

  if (test) {
    const me = await db.user.findUnique({
      where: { id: actor.id },
      select: { email: true, firstName: true, preferredName: true },
    });
    if (!me?.email) return reply({ error: "Your account has no email address." }, { status: 400 });
    await sendRegistrationMessageEmail({
      to: me.email,
      firstName: me.preferredName || me.firstName || "there",
      programTitle: program.name,
      programSlug: program.slug,
      subject,
      message,
      test: true,
    });
    return reply({ ok: true, test: true, email: me.email });
  }

  const rows = await db.registration.findMany({
    where: { programSlug: slug, status: { in: STATUSES[to] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, firstName: true },
  });
  const seen = new Set<string>();
  const people = rows.filter((r) => {
    const key = r.email.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (people.length === 0) {
    return reply({ error: "No one is in that group." }, { status: 400 });
  }
  if (people.length > MAX_PEOPLE) {
    return reply(
      { error: `That's ${people.length} people, more than ${MAX_PEOPLE} can be sent here. Use the program's Flodesk segment for a group this size.` },
      { status: 400 },
    );
  }

  await recordRegistrationEvent({
    kind: "message-sent",
    programId: program.id,
    programSlug: program.slug,
    actorId: actor.id,
    detail: { to, count: people.length, subject, message, registrationIds: rows.map((p) => p.id) },
  });

  const programTitle = program.name;
  const programSlug = program.slug;
  after(async () => {
    await sendEachPaced(
      people,
      (p) => sendRegistrationMessageEmail({
        to: p.email,
        firstName: p.firstName,
        programTitle,
        programSlug,
        subject,
        message,
      }),
      "registration-message",
    );
  });

  return reply({ ok: true, count: people.length });
}

/** POST /api/programs/[slug]/send-reminder: the reminder to those registered who haven't had it. */
export async function sendReminderNow(actor: SaveActor, slug: string): Promise<SaveReply> {
  // Fetch program details from Postgres
  const pgProgram = await db.program.findUnique({ where: { slug } });

  // Find all active registrants who haven't received the reminder yet
  const registrations = await db.registration.findMany({
    where: {
      programSlug: slug,
      status: { in: ["REGISTERED", "APPROVED"] },
      reminderSentAt: null,
    },
  });

  const now = new Date();
  const loc = emailLocationFor(pgProgram ?? {});
  const startIso = pgProgram?.startDatetime?.toISOString() ?? null;
  const endIso = pgProgram?.endDatetime?.toISOString() ?? null;

  for (const reg of registrations) {
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
      }),
      timeText: pgProgram?.timeText ?? null,
      locationText: loc.emailText,
      locationLink: loc.link,
      reminderMessage: pgProgram?.reminderMessage,
    });
    await db.registration.update({
      where: { id: reg.id },
      data: { reminderSentAt: now },
    });
  }

  if (registrations.length > 0) {
    await recordRegistrationEvent({
      kind: "reminders-sent",
      programId: pgProgram?.id ?? null,
      programSlug: slug,
      actorId: actor.id,
      detail: { count: registrations.length, registrationIds: registrations.map((r) => r.id) },
    });
  }

  return reply({ sent: registrations.length });
}

const PLACES_MAX = 10000;

/** PATCH /api/programs/[slug]/registration-settings: open or closed, places, dates, the mailing list. */
export async function saveRegistrationSettings(actor: SaveActor, slug: string, body: Record<string, unknown>): Promise<SaveReply> {
  const program = await db.program.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      updatedAt: true,
      archivedAt: true,
      registrationEnabled: true,
      registrationClosed: true,
      registrationCapacity: true,
      registrationDeadline: true,
      registrationOpensAt: true,
      flodeskSync: true,
      flodeskSegmentId: true,
    },
  });
  if (!program) return reply({ error: "Program not found" }, { status: 404 });
  if (program.archivedAt || !program.registrationEnabled) {
    return reply(
      { error: "Registration is off for this program. Turn it on in the program editor first." },
      { status: 409 },
    );
  }

  const loaded = typeof body.updatedAt === "string" ? new Date(body.updatedAt) : null;
  const stale = "This program was changed since the page loaded, so nothing was saved. Reload the page, then make your change again.";
  if (!loaded || isNaN(loaded.getTime()) || loaded.getTime() !== program.updatedAt.getTime()) {
    return reply({ error: stale }, { status: 409 });
  }

  const data: {
    registrationClosed?: boolean;
    registrationCapacity?: number | null;
    registrationDeadline?: Date | null;
    registrationOpensAt?: Date | null;
    flodeskSync?: boolean | null;
    flodeskSegmentId?: string;
    flodeskSegmentName?: string;
  } = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  if (body.registrationClosed !== undefined) {
    if (typeof body.registrationClosed !== "boolean") {
      return reply({ error: "Registration must be open or closed." }, { status: 422 });
    }
    if (body.registrationClosed !== program.registrationClosed) {
      data.registrationClosed = body.registrationClosed;
      changes.closed = { from: program.registrationClosed, to: body.registrationClosed };
    }
  }

  if (body.registrationCapacity !== undefined) {
    const raw = body.registrationCapacity;
    const places = raw === null || raw === "" ? null : Number(raw);
    if (places !== null && (!Number.isInteger(places) || places < 1 || places > PLACES_MAX)) {
      return reply({ error: "Places must be a whole number of at least 1, or empty for no limit." }, { status: 422 });
    }
    if (places !== program.registrationCapacity) {
      if (places !== null) {
        const taken = await countPlacesTaken(program.id);
        if (places < taken) {
          return reply(
            { error: `${taken} ${taken === 1 ? "place is" : "places are"} already taken, so places can't be fewer than ${taken}. Cancel someone first if a place has to go.` },
            { status: 422 },
          );
        }
      }
      data.registrationCapacity = places;
      changes.places = { from: program.registrationCapacity, to: places };
    }
  }

  if (body.registrationDeadline !== undefined) {
    const raw = body.registrationDeadline;
    let deadline: Date | null = null;
    if (raw !== null && raw !== "") {
      deadline = typeof raw === "string" ? centralToUtc(raw) : null;
      if (!deadline) {
        return reply({ error: "That closing date isn't a date and time." }, { status: 422 });
      }
    }
    if ((deadline?.getTime() ?? null) !== (program.registrationDeadline?.getTime() ?? null)) {
      data.registrationDeadline = deadline;
      changes.closes = { from: program.registrationDeadline?.toISOString() ?? null, to: deadline?.toISOString() ?? null };
    }
  }

  if (body.registrationOpensAt !== undefined) {
    const raw = body.registrationOpensAt;
    let opens: Date | null = null;
    if (raw !== null && raw !== "") {
      opens = typeof raw === "string" ? centralToUtc(raw) : null;
      if (!opens) {
        return reply({ error: "That opening date isn't a date and time." }, { status: 422 });
      }
    }
    if ((opens?.getTime() ?? null) !== (program.registrationOpensAt?.getTime() ?? null)) {
      data.registrationOpensAt = opens;
      changes.opens = { from: program.registrationOpensAt?.toISOString() ?? null, to: opens?.toISOString() ?? null };
    }
  }

  if (body.flodeskSync !== undefined) {
    if (body.flodeskSync !== null && typeof body.flodeskSync !== "boolean") {
      return reply({ error: "The mailing list must be automatic, on or off." }, { status: 422 });
    }
    if (body.flodeskSync !== program.flodeskSync) {
      data.flodeskSync = body.flodeskSync;
      changes.mailingList = { from: program.flodeskSync, to: body.flodeskSync };
    }
  }

  // A segment chosen from Flodesk's list. Its name is read from Flodesk, never
  // from the request. There is no unlinking: Flodesk can't rename or delete a
  // segment, so a fresh one would duplicate it.
  if (body.flodeskSegmentId !== undefined && body.flodeskSegmentId !== null && body.flodeskSegmentId !== "") {
    if (typeof body.flodeskSegmentId !== "string") {
      return reply({ error: "Choose the segment again from the list." }, { status: 422 });
    }
    if (body.flodeskSegmentId !== program.flodeskSegmentId) {
      let segment: { id: string; name: string } | null;
      try {
        segment = await getFlodeskSegment(body.flodeskSegmentId);
      } catch {
        return reply({ error: "Flodesk didn't answer, so the settings weren't saved. Try again in a moment." }, { status: 503 });
      }
      if (!segment) {
        return reply({ error: "That Flodesk segment couldn't be found. Choose it again from the list." }, { status: 422 });
      }
      data.flodeskSegmentId = segment.id;
      data.flodeskSegmentName = segment.name;
      changes.segment = { from: program.flodeskSegmentId, to: segment.name };
    }
  }

  // Never closing before it opens: it would never be open.
  const opensAfter = data.registrationOpensAt !== undefined ? data.registrationOpensAt : program.registrationOpensAt;
  const closesAfter = data.registrationDeadline !== undefined ? data.registrationDeadline : program.registrationDeadline;
  if (opensAfter && closesAfter && closesAfter <= opensAfter) {
    return reply({ error: "The closing date comes before registration opens. Move one of them." }, { status: 422 });
  }

  if (Object.keys(data).length === 0) {
    return reply({ ok: true, unchanged: true, updatedAt: program.updatedAt.toISOString() });
  }

  // Saved only if the program is still as the page loaded it, in one write
  // that also hands back the new updatedAt for the next save.
  let after: { updatedAt: Date };
  try {
    after = await db.program.update({
      where: { id: program.id, updatedAt: program.updatedAt },
      data,
      select: { updatedAt: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return reply({ error: stale }, { status: 409 });
    }
    throw err;
  }
  await recordRegistrationEvent({
    kind: "settings-changed",
    programId: program.id,
    programSlug: program.slug,
    actorId: actor.id,
    detail: { changes } as Prisma.InputJsonValue,
  });

  return reply({ ok: true, updatedAt: after.updatedAt.toISOString() });
}
