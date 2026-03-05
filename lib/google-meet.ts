/**
 * lib/google-meet.ts
 * Google Meet + Calendar integration via Service Account + Domain-Wide Delegation.
 *
 * Architecture: "Virtual Room" model.
 * - A pool of room accounts (GOOGLE_ROOM_EMAILS) each act as a meeting "owner".
 * - The service account impersonates whichever room is free at the requested time.
 * - The volunteer's email is assigned as COHOST via the Meet REST API so they
 *   join with full host controls from their own account — no account switching.
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  — service account client_email
 *   GOOGLE_PRIVATE_KEY            — service account private_key (raw, with \n newlines)
 *   GOOGLE_CALENDAR_ID            — shared "RIM Programs" calendar ID
 *   GOOGLE_ROOM_EMAILS            — comma-separated room account emails
 */

import { google } from "googleapis";
import { JWT } from "google-auth-library";

export interface CreateMeetingParams {
  title: string;
  startDatetime: string; // ISO 8601, e.g. "2026-04-01T19:00:00-05:00"
  endDatetime: string;   // ISO 8601
  volunteerEmail: string;
  programSlug: string;
}

export interface CreateMeetingResult {
  meetLink: string;
  calendarEventId: string;
  roomEmail: string;
  moderationEnabled: boolean;
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
 * Strategy: query the shared calendar for events in [startDatetime, endDatetime],
 * collect which room emails already appear as organizers, return the first free one.
 */
async function findAvailableRoom(
  roomEmails: string[],
  startDatetime: string,
  endDatetime: string
): Promise<string> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  // Use the first room to perform the read query (any room can read the shared calendar)
  const auth = makeAuth(roomEmails[0], ["https://www.googleapis.com/auth/calendar.events"]);
  const calendar = google.calendar({ version: "v3", auth });

  const eventsResponse = await calendar.events.list({
    calendarId,
    timeMin: startDatetime,
    timeMax: endDatetime,
    singleEvents: true,
    maxResults: 100,
  });

  // Collect organizer emails from existing events in this window
  const bookedRooms = new Set<string>();
  for (const event of eventsResponse.data.items ?? []) {
    const org = event.organizer?.email;
    if (org) bookedRooms.add(org.toLowerCase());
  }

  const freeRoom = roomEmails.find((r) => !bookedRooms.has(r.toLowerCase()));
  if (!freeRoom) {
    throw new Error(
      `NO_ROOM_AVAILABLE: All ${roomEmails.length} room accounts are booked during ${startDatetime} – ${endDatetime}`
    );
  }

  return freeRoom;
}

/**
 * Create a Google Meet space, assign a volunteer as COHOST, and add a
 * Google Calendar event on the shared RIM Programs calendar.
 *
 * Returns the Meet link (from the Meet REST API, not the calendar conferenceData)
 * and the calendar event ID for reference.
 */
export async function createMeeting({
  title,
  startDatetime,
  endDatetime,
  volunteerEmail,
  programSlug,
}: CreateMeetingParams): Promise<CreateMeetingResult> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const roomEmails = (process.env.GOOGLE_ROOM_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID not configured");
  if (roomEmails.length === 0) throw new Error("GOOGLE_ROOM_EMAILS not configured");

  // 1. Find an available room for this time slot
  const roomEmail = await findAvailableRoom(roomEmails, startDatetime, endDatetime);

  // 2. Auth scoped to the chosen room (both Meet + Calendar)
  const auth = makeAuth(roomEmail, [
    "https://www.googleapis.com/auth/meetings.space.settings",
    "https://www.googleapis.com/auth/calendar.events",
  ]);

  const meet = google.meet({ version: "v2", auth });
  const calendar = google.calendar({ version: "v3", auth });

  let spaceName = "";
  let meetLink = "";
  let moderationEnabled = false;

  try {
    // 3a. Create a moderated Meet space (required for COHOST role)
    const spaceRes = await meet.spaces.create({
      requestBody: {
        config: {
          accessType: "TRUSTED",
          entryPointAccess: "ALL",
          moderation: "ON",
        },
      },
    });
    spaceName = spaceRes.data.name!;
    meetLink = spaceRes.data.meetingUri!;
    moderationEnabled = true;

    // 3b. Assign volunteer as COHOST (note required "users/" prefix).
    // The googleapis TypeScript types for Meet v2 are incomplete — spaces.members
    // is not typed, so we call the REST endpoint directly with an auth token.
    const tokenRes = await auth.getAccessToken();
    const accessToken = tokenRes.token;
    const membersRes = await fetch(
      `https://meet.googleapis.com/v2/${spaceName}/members`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: `users/${volunteerEmail}`,
          role: "COHOST",
        }),
      }
    );
    if (!membersRes.ok) {
      const errText = await membersRes.text();
      console.warn(`[google-meet] spaces.members.create failed (${membersRes.status}): ${errText}`);
      // Non-fatal: meeting is still usable without COHOST assignment
    }
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 403) {
      // Free tier fallback: moderation/COHOST not available.
      // Volunteer still enters without friction via Trusted access type.
      console.warn(
        "[google-meet] Moderation/COHOST returned 403 (free tier). " +
          "Falling back to standard space. Volunteer will join as trusted participant."
      );
      const fallback = await meet.spaces.create({});
      spaceName = fallback.data.name!;
      meetLink = fallback.data.meetingUri!;
    } else {
      throw err;
    }
  }

  // 4. Create calendar event on the shared RIM Programs calendar.
  //    Impersonating roomEmail means it appears as the event organizer —
  //    this is how we track room assignment for future availability checks.
  const eventRes = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: title,
      description:
        `Join on Google Meet: ${meetLink}\n` +
        `Volunteer host: ${volunteerEmail}\n` +
        `Program: https://rim-next.vercel.app/programs/${programSlug}`,
      start: { dateTime: startDatetime },
      end: { dateTime: endDatetime },
      attendees: [{ email: volunteerEmail }],
    },
  });

  return {
    meetLink,
    calendarEventId: eventRes.data.id!,
    roomEmail,
    moderationEnabled,
  };
}
