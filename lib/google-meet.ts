/**
 * lib/google-meet.ts
 * Google Meet + Calendar integration via Service Account + Domain-Wide Delegation.
 *
 * Architecture: "Virtual Room" model.
 * - A pool of room accounts (GOOGLE_ROOM_EMAILS) each act as a meeting "owner".
 * - The service account impersonates whichever room is free at the requested time.
 * - Room conflict detection checks each room's own primary calendar — any event
 *   in the requested time window blocks that room for that slot.
 * - No volunteer is pre-designated as host. The host team logs into the assigned
 *   room account to gain host controls automatically (they own the meeting).
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  — service account client_email
 *   GOOGLE_PRIVATE_KEY            — service account private_key (raw, with \n newlines)
 *   GOOGLE_ROOM_EMAILS            — comma-separated room account emails
 */

import { google } from "googleapis";
import { JWT } from "google-auth-library";

export interface CreateMeetingParams {
  title: string;
  startDatetime: string; // ISO 8601, e.g. "2026-04-01T19:00:00-05:00"
  endDatetime: string;   // ISO 8601
  programSlug: string;
}

export interface CreateMeetingResult {
  meetLink: string;
  calendarEventId: string;
  roomEmail: string;
}

/** Build a JWT auth client impersonating a given room account via DWD. */
function makeAuth(subject: string, scopes: string[]): JWT {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !privateKey) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY not configured");
  }
  return new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes,
    subject, // DWD: impersonate this user
  });
}

/**
 * Find a room account that has no calendar events overlapping the requested slot.
 * Strategy: check each room's own primary calendar for events in [startDatetime, endDatetime].
 * Returns the first room with no conflicts.
 */
async function findAvailableRoom(
  roomEmails: string[],
  startDatetime: string,
  endDatetime: string
): Promise<string> {
  for (const roomEmail of roomEmails) {
    const auth = makeAuth(roomEmail, ["https://www.googleapis.com/auth/calendar.events"]);
    const calendar = google.calendar({ version: "v3", auth });

    const eventsResponse = await calendar.events.list({
      calendarId: "primary",
      timeMin: startDatetime,
      timeMax: endDatetime,
      singleEvents: true,
      maxResults: 10,
    });

    if ((eventsResponse.data.items ?? []).length === 0) {
      return roomEmail;
    }
  }

  throw new Error(
    `NO_ROOM_AVAILABLE: All ${roomEmails.length} room accounts are booked during ${startDatetime} – ${endDatetime}`
  );
}

/**
 * Create a Google Meet space and add a Google Calendar event on the shared
 * RIM Programs calendar.
 *
 * The assigned room account IS the meeting host — any volunteer who logs into
 * that account and joins will have full host controls. No pre-registration needed.
 *
 * Returns the Meet link and which room account was assigned (for display to the
 * host team in /hosts and in Sanity Studio).
 */
export async function createMeeting({
  title,
  startDatetime,
  endDatetime,
  programSlug,
}: CreateMeetingParams): Promise<CreateMeetingResult> {
  const roomEmails = (process.env.GOOGLE_ROOM_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (roomEmails.length === 0) throw new Error("GOOGLE_ROOM_EMAILS not configured");

  // 1. Find an available room for this time slot
  const roomEmail = await findAvailableRoom(roomEmails, startDatetime, endDatetime);

  // 2. Auth scoped to the chosen room
  const auth = makeAuth(roomEmail, [
    "https://www.googleapis.com/auth/meetings.space.created",
    "https://www.googleapis.com/auth/calendar.events",
  ]);

  const meet = google.meet({ version: "v2", auth });
  const calendar = google.calendar({ version: "v3", auth });

  // 3. Create the Meet space (TRUSTED access — org members join without knocking)
  const spaceRes = await meet.spaces.create({
    requestBody: {
      config: {
        accessType: "TRUSTED",
        entryPointAccess: "ALL",
      },
    },
  });
  const meetLink = spaceRes.data.meetingUri!;

  // 4. Create calendar event on the room's own primary calendar.
  //    Impersonating roomEmail + writing to "primary" avoids any shared-calendar
  //    permission issues. Conflict detection also reads from "primary" per room.
  const eventRes = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: title,
      description:
        `Join on Google Meet: ${meetLink}\n` +
        `Program: https://rim-next.vercel.app/programs/${programSlug}\n` +
        `Host account: ${roomEmail}`,
      start: { dateTime: startDatetime },
      end: { dateTime: endDatetime },
    },
  });

  return {
    meetLink,
    calendarEventId: eventRes.data.id!,
    roomEmail,
  };
}

/**
 * Update the time (and optionally title) of an existing Google Calendar event
 * on a room account's primary calendar. Does NOT touch the Meet space — the
 * link remains stable. Called by the webhook when startDatetime changes.
 */
export async function updateCalendarEvent({
  calendarEventId,
  roomEmail,
  title,
  startDatetime,
  endDatetime,
}: {
  calendarEventId: string;
  roomEmail: string;
  title: string;
  startDatetime: string;
  endDatetime: string;
}): Promise<void> {
  const auth = makeAuth(roomEmail, [
    "https://www.googleapis.com/auth/calendar.events",
  ]);
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.patch({
    calendarId: "primary",
    eventId: calendarEventId,
    requestBody: {
      summary: title,
      start: { dateTime: startDatetime },
      end: { dateTime: endDatetime },
    },
  });
}

/**
 * Delete a Google Calendar event from a room account's primary calendar,
 * freeing that slot for future conflict detection. Called by the webhook when
 * a program is deleted or switched from virtual to in-person.
 */
export async function deleteCalendarEvent({
  calendarEventId,
  roomEmail,
}: {
  calendarEventId: string;
  roomEmail: string;
}): Promise<void> {
  const auth = makeAuth(roomEmail, [
    "https://www.googleapis.com/auth/calendar.events",
  ]);
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.delete({
    calendarId: "primary",
    eventId: calendarEventId,
  });
}
