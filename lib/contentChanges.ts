import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { emailButtonHtml, sendTemplatedEmail } from "@/lib/email";
import { plain } from "@/lib/guideData";

/**
 * The record of every change made to the site's content through the RIM Guide
 * (2026-10-28, Jesse: "we should store the history, and I should be
 * notified"). Content editors (the CONTENT_EDITOR role, given by hand) need no
 * approval; each change is kept in content_changes, listed newest first at
 * /admin/content-changes with a page for each. The ones that shape the site
 * go in Jesse's email each evening (sendDailyChanges, the
 * content-changes-daily template).
 */

export const CONTENT_EDITOR = "CONTENT_EDITOR";

/** Whether this person may change the site's content through the guide. */
export const canEditContent = (roles: readonly string[] | null | undefined) => !!roles?.includes(CONTENT_EDITOR);

export type ContentKind = "program" | "course" | "lesson" | "email" | "teacher" | "page" | "registration" | "schedule" | "conversation";

export const CONTENT_KIND_LABEL: Record<ContentKind, string> = {
  program: "Program",
  course: "Course",
  lesson: "Lesson",
  email: "Email",
  teacher: "Teacher page",
  page: "Page words",
  registration: "Registration",
  schedule: "Schedule",
  conversation: "Conversation",
};

/** How the email's subject names a change: "LoriLee changed the program Qigong". */
const KIND_PHRASE: Record<ContentKind, string> = {
  program: "the program",
  course: "the course",
  lesson: "the lesson",
  email: "the email",
  teacher: "the teacher page for",
  page: "the words on",
  registration: "the registration for",
  schedule: "the schedule for",
  conversation: "a conversation in",
};

/** One part that changed, as it was and as it is now (stored as given). */
export type ChangedPart = { label: string; before: unknown; after: unknown };

const BASE_URL = (process.env.NEXTAUTH_URL ?? "https://rim-next.vercel.app").trim().replace(/\/$/, "");

/** Where the email goes: CONTENT_CHANGES_EMAIL, else Jesse. */
const notifyTo = () => process.env.CONTENT_CHANGES_EMAIL?.trim() || "jesse@rootedinmindfulness.org";

/** A stored value as words a person reads: rich text as plain text, lists and settings spelled out. */
export function shownValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (typeof v === "boolean") return v ? "On" : "Off";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return plain(v) || "(empty)";
  if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) return v.join(", ") || "(empty)";
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] && "type" in (v[0] as object)) return plain(v) || "(empty)";
  return JSON.stringify(v, null, 2);
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s: string, n = 700) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

const when = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Keep a change. `inDaily` (the default) puts it in Jesse's evening email
 * of the day's changes (sendDailyChanges); the everyday actions people do in
 * the apps pass false and stay in the list only (Jesse, 2026-10-28: "an email
 * once a day, and we can skip the small changes"). Returns the change's id.
 */
export async function recordContentChange(input: {
  userId: string;
  userName: string;
  kind: ContentKind;
  itemKey: string;
  itemLabel: string;
  itemHref?: string | null;
  changes: ChangedPart[];
  commitUrl?: string | null;
  inDaily?: boolean;
}): Promise<string> {
  const row = await db.contentChange.create({
    data: {
      userId: input.userId,
      userName: input.userName,
      kind: input.kind,
      itemKey: input.itemKey,
      itemLabel: input.itemLabel,
      itemHref: input.itemHref ?? null,
      changes: input.changes.map((c) => ({ label: c.label, before: c.before ?? null, after: c.after ?? null })) as Prisma.InputJsonValue,
      commitUrl: input.commitUrl ?? null,
      inDaily: input.inDaily !== false,
    },
  });
  return row.id;
}

/** What a guide answer says about the record, so the person knows where it went. */
export const RECORDED_DAILY = " It's in the Content changes list and on Jesse's email of today's changes.";
export const RECORDED_ONLY = " It's in the Content changes list.";

/**
 * The evening email (the content-changes-daily template, from
 * /api/cron/content-changes-daily): every change for the daily email not yet
 * sent, in the order made. Marked sent only after the email is accepted, so a
 * failed send is tried the next evening. Returns how many it listed.
 */
export async function sendDailyChanges(): Promise<number> {
  const rows = await db.contentChange.findMany({
    where: { inDaily: true, sentAt: null },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  if (!rows.length) return 0;
  const changesList = rows
    .map((r) => {
      const parts = Array.isArray(r.changes) ? (r.changes as { label?: string }[]).map((p) => p.label).filter(Boolean) : [];
      const url = `${BASE_URL}/admin/content-changes/${r.id}`;
      return (
        `<p><strong>${escape(when.format(r.createdAt))}</strong>: ${escape(r.userName)} changed ${escape(KIND_PHRASE[r.kind as ContentKind] ?? r.kind)} ${escape(r.itemLabel)}` +
        `${parts.length ? ` (${escape(clip(parts.join(", "), 200))})` : ""}. <a href="${url}">See the change</a></p>`
      );
    })
    .join("");
  const historyUrl = `${BASE_URL}/admin/content-changes`;
  await sendTemplatedEmail(
    "content-changes-daily",
    notifyTo(),
    {
      // "today", unless an evening was missed and older ones waited.
      summaryLine: `${rows.length} ${rows.length === 1 ? "change" : "changes"} made through the RIM Guide ${Date.now() - rows[0].createdAt.getTime() < 26 * 60 * 60 * 1000 ? "today" : "since the last email"}`,
      changesList,
      historyUrl,
      historyButton: emailButtonHtml("See every change", historyUrl),
    },
    { throwOnFailure: true },
  );
  await db.contentChange.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { sentAt: new Date() } });
  return rows.length;
}
