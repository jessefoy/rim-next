/**
 * Support inbox notification helpers.
 *
 * Sends email notifications for support thread events (assignment, new
 * reply, new note). Email body is rendered via the template manager —
 * slug "support-notification".
 *
 * Previously also wrote in-app Alert records for a bell UI that was never
 * built. The alert system was removed; email now carries all signal.
 */

import { db } from "@/lib/db";
import { sendTemplatedEmail } from "@/lib/email";

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://rim-next.vercel.app";

interface NotifyOpts {
  threadId: string;
  threadSubject: string;
  /** The user who should receive the notification. */
  recipientId: string;
  /** The user who performed the action (do NOT notify them about their own action). */
  actorId?: string;
  /** Event type — informational only now that alerts are gone. */
  type: "SUPPORT_ASSIGNED" | "SUPPORT_NEW_REPLY" | "SUPPORT_NEW_NOTE";
  /** Short message describing the event. Renders into the email body. */
  message: string;
}

/**
 * Send a support thread notification email. Never throws — fire-and-forget.
 */
export async function notifySupport(opts: NotifyOpts): Promise<void> {
  try {
    const { threadId, threadSubject, recipientId, actorId, message } = opts;

    // Don't notify the actor about their own action
    if (actorId && recipientId === actorId) return;

    const user = await db.user.findUnique({
      where: { id: recipientId },
      select: { email: true, supportEmailNotifications: true, firstName: true },
    });

    if (!user || !user.supportEmailNotifications) return;

    await sendTemplatedEmail("support-notification", user.email, {
      firstName:     user.firstName,
      message,
      threadSubject,
      threadUrl:     `${BASE_URL}/tools/inbox?thread=${threadId}`,
    });
  } catch (err: any) {
    console.error("[supportNotify]", err.message);
  }
}

/**
 * Notify the assigned user about a new inbound reply on their thread.
 */
export async function notifyNewReply(
  threadId: string,
  threadSubject: string,
  senderName: string,
  assignedToId: string | null,
  actorId?: string
): Promise<void> {
  if (!assignedToId) return;
  await notifySupport({
    threadId,
    threadSubject,
    recipientId: assignedToId,
    actorId,
    type: "SUPPORT_NEW_REPLY",
    message: `New reply from ${senderName} on "${threadSubject}"`,
  });
}

/**
 * Notify the assigned user about an internal note added to their thread.
 */
export async function notifyNewNote(
  threadId: string,
  threadSubject: string,
  authorName: string,
  assignedToId: string | null,
  actorId: string
): Promise<void> {
  if (!assignedToId) return;
  await notifySupport({
    threadId,
    threadSubject,
    recipientId: assignedToId,
    actorId,
    type: "SUPPORT_NEW_NOTE",
    message: `${authorName} added an internal note on "${threadSubject}"`,
  });
}

/**
 * Notify a user that a thread has been assigned to them.
 */
export async function notifyAssigned(
  threadId: string,
  threadSubject: string,
  assignedToId: string,
  actorId?: string
): Promise<void> {
  await notifySupport({
    threadId,
    threadSubject,
    recipientId: assignedToId,
    actorId,
    type: "SUPPORT_ASSIGNED",
    message: `You've been assigned to "${threadSubject}"`,
  });
}
