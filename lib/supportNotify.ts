/**
 * Support inbox notification helpers.
 *
 * Creates in-app Alert records and sends email notifications
 * for support thread events (assignment, new reply, new note).
 *
 * Email body is rendered via the template manager — slug "support-notification".
 * Alert-creation + 5-minute dedup logic stays here.
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
  type: "SUPPORT_ASSIGNED" | "SUPPORT_NEW_REPLY" | "SUPPORT_NEW_NOTE";
  /** Short message for the in-app alert and email body. */
  message: string;
}

/**
 * Create an in-app alert + optionally send email notification.
 * Deduplicates: won't create if same type+thread alert exists within 5 minutes.
 * Never throws — fire-and-forget safe.
 */
export async function notifySupport(opts: NotifyOpts): Promise<void> {
  try {
    const { threadId, threadSubject, recipientId, actorId, type, message } = opts;

    // Don't notify the actor about their own action
    if (actorId && recipientId === actorId) return;

    // Dedup: suppress duplicate alerts for the same thread+type within 5 minutes.
    // Note: in high-volume scenarios (many emails arriving rapidly) some alerts
    // may be suppressed — acceptable trade-off to prevent notification spam.
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await db.alert.findFirst({
      where: {
        userId: recipientId,
        type,
        linkUrl: { contains: threadId },
        createdAt: { gte: fiveMinAgo },
      },
    });
    if (existing) return;

    const linkUrl = `/tools/inbox?thread=${threadId}`;

    // Create in-app alert
    await db.alert.create({
      data: {
        userId: recipientId,
        type,
        message,
        linkUrl,
      },
    });

    // Check if user wants email notifications
    const user = await db.user.findUnique({
      where: { id: recipientId },
      select: { email: true, supportEmailNotifications: true, firstName: true },
    });

    if (!user || !user.supportEmailNotifications) return;

    // Send email notification — body, subject, and chrome live in the
    // "support-notification" template at /admin/emails.
    await sendTemplatedEmail("support-notification", user.email, {
      firstName:     user.firstName,
      message,
      threadSubject,
      threadUrl:     `${BASE_URL}${linkUrl}`,
    });
  } catch (err: any) {
    // Never throw — fire-and-forget
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
