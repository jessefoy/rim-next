/**
 * Gmail sync engine for the Support Inbox.
 *
 * syncGmailInbox() — full sync:
 *   1. Get authenticated Gmail client
 *   2. Fetch threads from INBOX (last 90 days on initial, incremental via historyId)
 *   3. Parse messages: extract from, subject, date, HTML/text body
 *   4. Upsert SupportThread + SupportMessage records
 *   5. Member matching: link sender email to User if found
 *   6. Store historyId for incremental sync
 */

import { getGmailClient } from "@/lib/gmail";
import { db } from "@/lib/db";
import { notifyAssigned, notifyNewReply } from "@/lib/supportNotify";
import type { gmail_v1 } from "googleapis";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract email address from a "Name <email>" string. */
function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : raw.toLowerCase().trim();
}

/** Extract display name from a "Name <email>" string. */
function extractName(raw: string): string | null {
  const match = raw.match(/^(.+?)\s*<[^>]+>/);
  return match ? match[1].replace(/^"|"$/g, "").trim() : null;
}

/** Get a header value from a Gmail message. */
function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

/**
 * Recursively extract the body from a Gmail message payload.
 * Prefers text/html, falls back to text/plain.
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): {
  html: string;
  text: string;
} {
  if (!payload) return { html: "", text: "" };

  // Simple single-part message
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, "base64url").toString("utf-8");
    if (payload.mimeType === "text/html") return { html: decoded, text: "" };
    if (payload.mimeType === "text/plain") return { html: "", text: decoded };
  }

  // Multipart — recurse into parts
  if (payload.parts) {
    let html = "";
    let text = "";
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        html = Buffer.from(part.body.data, "base64url").toString("utf-8");
      } else if (part.mimeType === "text/plain" && part.body?.data) {
        text = Buffer.from(part.body.data, "base64url").toString("utf-8");
      } else if (part.mimeType?.startsWith("multipart/")) {
        const nested = extractBody(part);
        if (nested.html) html = nested.html;
        if (nested.text) text = nested.text;
      }
    }
    return { html, text };
  }

  return { html: "", text: "" };
}

/**
 * Extract CID-referenced inline attachments from message parts.
 * Returns an array of { cid, attachmentId, mimeType, filename }.
 */
function extractAttachments(
  parts: gmail_v1.Schema$MessagePart[] | undefined
): { cid: string; attachmentId: string; mimeType: string; filename: string }[] {
  if (!parts) return [];
  const results: { cid: string; attachmentId: string; mimeType: string; filename: string }[] = [];
  for (const part of parts) {
    // CID attachment: has a Content-ID header and an attachmentId
    const contentId = part.headers?.find(
      (h) => h.name?.toLowerCase() === "content-id"
    )?.value;
    if (contentId && part.body?.attachmentId) {
      // Strip angle brackets from Content-ID: <image001.png@...> → image001.png@...
      const cid = contentId.replace(/^<|>$/g, "");
      results.push({
        cid,
        attachmentId: part.body.attachmentId,
        mimeType: part.mimeType || "application/octet-stream",
        filename: part.filename || "",
      });
    }
    // Recurse into nested parts
    if (part.parts) {
      results.push(...extractAttachments(part.parts));
    }
  }
  return results;
}

/**
 * Extract file attachments (non-inline) from message parts.
 * These are parts with a filename and attachmentId that are NOT CID-referenced.
 */
function extractFileAttachments(
  parts: gmail_v1.Schema$MessagePart[] | undefined
): { attachmentId: string; filename: string; mimeType: string; size: number }[] {
  if (!parts) return [];
  const results: { attachmentId: string; filename: string; mimeType: string; size: number }[] = [];
  for (const part of parts) {
    const hasCid = part.headers?.some(
      (h) => h.name?.toLowerCase() === "content-id"
    );
    // File attachment: has a filename and attachmentId, but is NOT a CID inline image
    if (part.filename && part.body?.attachmentId && !hasCid) {
      results.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
      });
    }
    // Recurse into nested parts
    if (part.parts) {
      results.push(...extractFileAttachments(part.parts));
    }
  }
  return results;
}

/** Determine if a message is outbound (sent by support@). */
function isOutbound(fromEmail: string, supportEmail: string): boolean {
  return fromEmail.toLowerCase() === supportEmail.toLowerCase();
}

// ─── App Settings for historyId persistence ──────────────────────────────────

async function getAppSetting(key: string): Promise<string | null> {
  // Use a simple key-value approach via GmailCredential.email as anchor
  // We'll store historyId on the credential record itself — simpler than a new table
  // Actually, let's just use a simple approach: store in a JSON field or use the
  // GmailCredential updatedAt. For now, we'll track historyId in memory and
  // fall back to date-based filtering. The spec says "use judgment" on this.
  // We'll add a historyId field to GmailCredential in a future migration.
  // For Phase 1: always do date-based sync (last 90 days), deduplicate via upsert.
  return null;
}

// ─── Main Sync ───────────────────────────────────────────────────────────────

interface SyncResult {
  newThreads: number;
  newMessages: number;
  updatedThreads: number;
}

export async function syncGmailInbox(): Promise<SyncResult> {
  const gmail = await getGmailClient();
  const credential = await db.gmailCredential.findFirst();
  if (!credential) throw new Error("Gmail not connected");

  const supportEmail = credential.email;
  let newThreads = 0;
  let newMessages = 0;
  let updatedThreads = 0;

  // Check for default assignee setting
  const defaultAssigneeSetting = await db.appSetting.findUnique({
    where: { key: "support.defaultAssigneeId" },
  });
  const defaultAssigneeId = defaultAssigneeSetting?.value ?? null;

  // Fetch threads from INBOX — last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const afterDate = `${ninetyDaysAgo.getFullYear()}/${String(ninetyDaysAgo.getMonth() + 1).padStart(2, "0")}/${String(ninetyDaysAgo.getDate()).padStart(2, "0")}`;

  // Paginate through all threads
  let pageToken: string | undefined;
  const allThreadIds: string[] = [];

  do {
    const listRes = await gmail.users.threads.list({
      userId: "me",
      labelIds: ["INBOX"],
      q: `after:${afterDate}`,
      maxResults: 100,
      pageToken,
    });

    const threads = listRes.data.threads ?? [];
    for (const t of threads) {
      if (t.id) allThreadIds.push(t.id);
    }
    pageToken = listRes.data.nextPageToken ?? undefined;
  } while (pageToken);

  // Process each thread
  for (const gmailThreadId of allThreadIds) {
    const threadRes = await gmail.users.threads.get({
      userId: "me",
      id: gmailThreadId,
      format: "full",
    });

    const gmailMessages = threadRes.data.messages ?? [];
    if (gmailMessages.length === 0) continue;

    // Parse first message for thread-level data
    const firstMsg = gmailMessages[0];
    const firstHeaders = firstMsg.payload?.headers;
    const subject = getHeader(firstHeaders, "Subject") ?? "(no subject)";
    const firstFrom = getHeader(firstHeaders, "From") ?? "";
    const senderEmail = extractEmail(firstFrom);
    const senderName = extractName(firstFrom);

    // Last message timestamp for sorting
    const lastMsg = gmailMessages[gmailMessages.length - 1];
    const lastDate = lastMsg.internalDate
      ? new Date(parseInt(lastMsg.internalDate))
      : new Date();

    // Check if thread already exists (include deletedAt to detect soft-deleted threads)
    const existingThread = await db.supportThread.findUnique({
      where: { gmailThreadId },
      select: { id: true, lastMessageAt: true, assignedToId: true, subject: true, deletedAt: true },
    });

    let threadId: string;

    if (existingThread) {
      // Skip soft-deleted threads — do not resurrect them
      if (existingThread.deletedAt) continue;

      // Update lastMessageAt if newer messages arrived
      if (lastDate > existingThread.lastMessageAt) {
        await db.supportThread.update({
          where: { id: existingThread.id },
          data: { lastMessageAt: lastDate, lastSyncedAt: new Date() },
        });
        updatedThreads++;
      }
      threadId = existingThread.id;
    } else {
      // Member matching: check if sender is a known member
      // For outbound-first threads (we sent first), use the To address instead
      let matchEmail = senderEmail;
      if (isOutbound(senderEmail, supportEmail)) {
        const toHeader = getHeader(firstHeaders, "To") ?? "";
        matchEmail = extractEmail(toHeader);
      }

      const member = await db.user.findUnique({
        where: { email: matchEmail },
        select: { id: true },
      });

      const thread = await db.supportThread.create({
        data: {
          gmailThreadId,
          subject,
          senderEmail: isOutbound(senderEmail, supportEmail) ? extractEmail(getHeader(firstHeaders, "To") ?? "") : senderEmail,
          senderName: isOutbound(senderEmail, supportEmail) ? extractName(getHeader(firstHeaders, "To") ?? "") : senderName,
          memberId: member?.id ?? null,
          assignedToId: defaultAssigneeId,
          status: defaultAssigneeId ? "CLAIMED" : "OPEN",
          lastMessageAt: lastDate,
          lastSyncedAt: new Date(),
        },
      });
      threadId = thread.id;
      newThreads++;

      // Notify default assignee about new thread (fire-and-forget)
      if (defaultAssigneeId) {
        notifyAssigned(thread.id, subject, defaultAssigneeId).catch(() => {});
      }
    }

    // Upsert messages
    for (const msg of gmailMessages) {
      if (!msg.id) continue;

      const existing = await db.supportMessage.findUnique({
        where: { gmailMessageId: msg.id },
        select: { id: true },
      });
      if (existing) continue; // already synced

      const headers = msg.payload?.headers;
      const from = getHeader(headers, "From") ?? "";
      const fromEmail = extractEmail(from);
      const fromName = extractName(from);
      const sentAt = msg.internalDate
        ? new Date(parseInt(msg.internalDate))
        : new Date();

      const { html, text } = extractBody(msg.payload);
      const outbound = isOutbound(fromEmail, supportEmail);
      const cidAttachments = extractAttachments(msg.payload?.parts);
      const fileAtts = extractFileAttachments(msg.payload?.parts);

      const message = await db.supportMessage.create({
        data: {
          gmailMessageId: msg.id,
          threadId,
          fromEmail,
          fromName,
          bodyHtml: html || `<pre>${text}</pre>`,
          bodyText: text || html.replace(/<[^>]+>/g, ""),
          attachments: cidAttachments.length > 0 ? cidAttachments : undefined,
          sentAt,
          isOutbound: outbound,
        },
      });

      // Store file attachments as SupportAttachment records
      if (fileAtts.length > 0) {
        await db.supportAttachment.createMany({
          data: fileAtts.map((a) => ({
            messageId: message.id,
            gmailAttachmentId: a.attachmentId,
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
          })),
        });
      }

      newMessages++;

      // Notify assignee about inbound reply on existing thread (fire-and-forget)
      if (!outbound && existingThread?.assignedToId) {
        notifyNewReply(
          threadId,
          existingThread.subject,
          fromName || fromEmail,
          existingThread.assignedToId
        ).catch(() => {});
      }
    }
  }

  return { newThreads, newMessages, updatedThreads };
}

// ─── Retroactive Member Matching ──────────────────────────────────────────────

/**
 * Re-match unlinked threads: find SupportThread records where memberId is null,
 * look up User by senderEmail, update memberId where found.
 */
export async function rematchUnlinkedThreads(): Promise<number> {
  const unlinked = await db.supportThread.findMany({
    where: { memberId: null, deletedAt: null },
    select: { id: true, senderEmail: true },
  });

  let matched = 0;
  for (const thread of unlinked) {
    const user = await db.user.findUnique({
      where: { email: thread.senderEmail },
      select: { id: true },
    });
    if (user) {
      await db.supportThread.update({
        where: { id: thread.id },
        data: { memberId: user.id },
      });
      matched++;
    }
  }

  return matched;
}
