import { db } from "@/lib/db";
import {
  sendRegistrationEmail,
  sendRegistrationSupportNotification,
} from "@/lib/email";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { buildGoogleCalendarUrl, buildIcsUrl } from "@/lib/calendarLinks";
import { resolveLocation } from "@/lib/locations";
import { buildDateLabel } from "@/lib/dateLabel";

/**
 * Send the registration confirmation (or waitlist) email for one registration.
 *
 * Loads everything it needs from the registration id — the registration row
 * plus its program — and assembles the full email payload: program-specific
 * confirmation copy, resolved date + location, and add-to-calendar links.
 *
 * This is the single place the confirmation is built, so every completion point
 * can fire it with just an id. Extracted from the registration POST so the
 * confirmation can be sent when the dana choice actually resolves (voluntary
 * decline endpoint, or the Stripe webhook on paid completion) rather than at
 * submit time.
 *
 * Throws on a genuinely missing registration so an awaiting caller can surface
 * the failure; the email send itself never throws (errors are caught inside
 * sendTemplatedEmail).
 */
export async function sendRegistrationConfirmation(
  registrationId: string,
): Promise<void> {
  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      programTitle: true,
      programSlug: true,
      status: true,
      donationStatus: true,
      waitlistPosition: true,
      program: {
        select: {
          confirmationMessage: true,
          startDatetime: true,
          endDatetime: true,
          venue: true,
          locationText: true,
          locationLink: true,
          dateText: true,
          recurrenceFreq: true,
          recurrenceInterval: true,
          recurrenceDays: true,
          recurrenceCount: true,
        },
      },
    },
  });

  if (!registration) {
    console.error(
      `[registrationConfirmation] Registration not found: ${registrationId}`,
    );
    throw new Error(`Registration not found: ${registrationId}`);
  }

  const isWaitlisted = registration.status === "WAITLISTED";
  const program = registration.program;

  let confirmationMessageHtml: string | undefined;
  let confirmationMessageText: string | undefined;
  let googleCalendarUrl: string | undefined;
  let icsUrl: string | undefined;
  let resolvedLocationText: string | null = null;
  let resolvedDateText: string | null = null;

  try {
    if (program) {
      // Render Tiptap JSON confirmation message to HTML for email
      if (program.confirmationMessage) {
        const html = await renderFormattedTextAsync(program.confirmationMessage);
        if (html) {
          confirmationMessageHtml = html;
          // Strip HTML for plain text fallback
          confirmationMessageText = html.replace(/<[^>]+>/g, "");
        }
      }

      // Resolve location (venue → RIM defaults, or custom text/link)
      const loc = resolveLocation(
        program.venue,
        program.locationText,
        program.locationLink,
      );
      resolvedLocationText = loc.emailText;

      // Prefer the program's cached display label; fall back to computing it.
      resolvedDateText = program.dateText?.trim()
        ? program.dateText
        : buildDateLabel({
            startDatetime: program.startDatetime?.toISOString() ?? null,
            endDatetime: program.endDatetime?.toISOString() ?? null,
            recurrenceFreq: program.recurrenceFreq,
            recurrenceInterval: program.recurrenceInterval,
            recurrenceDays: program.recurrenceDays,
          });

      // Build calendar links only for confirmed (not waitlisted) registrations
      if (program.startDatetime && !isWaitlisted) {
        googleCalendarUrl = buildGoogleCalendarUrl({
          title: registration.programTitle,
          startDatetime: program.startDatetime.toISOString(),
          endDatetime: program.endDatetime?.toISOString() ?? null,
          location: loc.emailText ?? null,
          programSlug: registration.programSlug,
          recurrenceFreq: program.recurrenceFreq,
          recurrenceInterval: program.recurrenceInterval,
          recurrenceDays: program.recurrenceDays,
          recurrenceCount: program.recurrenceCount,
        });
        icsUrl = buildIcsUrl(registration.programSlug);
      }
    }
  } catch (err) {
    console.error(
      "[registrationConfirmation] Failed to build confirmation data:",
      err,
    );
  }

  await sendRegistrationEmail({
    to: registration.email,
    firstName: registration.firstName,
    programTitle: registration.programTitle,
    programSlug: registration.programSlug,
    status: isWaitlisted ? "WAITLISTED" : "REGISTERED",
    waitlistPosition: registration.waitlistPosition,
    dateText: resolvedDateText,
    locationText: resolvedLocationText,
    confirmationMessageHtml,
    confirmationMessageText,
    googleCalendarUrl,
    icsUrl,
  });

  // Notify support@ that a registration just became official (LorieLee request).
  // This rides the same choke point as the registrant's confirmation, so it
  // fires once per real registration and never for an abandoned hold. The
  // internal send catches its own errors and won't break the registrant email.
  await sendRegistrationSupportNotification({
    registrantName:
      `${registration.firstName} ${registration.lastName}`.trim() ||
      registration.firstName,
    registrantEmail: registration.email,
    programTitle: registration.programTitle,
    programSlug: registration.programSlug,
    status: registration.status,
    donationStatus: registration.donationStatus,
  });
}
