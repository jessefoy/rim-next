import "server-only";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { emailButtonHtml, sendTemplatedEmail } from "@/lib/email";
import { plain } from "@/lib/guideData";

/**
 * The record of every change made to the site's content through the RIM Guide
 * (2026-10-28, Jesse: "we should store the history, and I should be
 * notified"). Content editors (the CONTENT_EDITOR role, given by hand) need no
 * approval; each change is kept in content_changes, listed newest first at
 * /admin/content-changes with a page for each, and emailed to Jesse right
 * after it is made (the content-changed template).
 */

export const CONTENT_EDITOR = "CONTENT_EDITOR";

/** Whether this person may change the site's content through the guide. */
export const canEditContent = (roles: readonly string[] | null | undefined) => !!roles?.includes(CONTENT_EDITOR);

export type ContentKind = "program" | "course" | "lesson" | "email" | "teacher" | "page";

export const CONTENT_KIND_LABEL: Record<ContentKind, string> = {
  program: "Program",
  course: "Course",
  lesson: "Lesson",
  email: "Email",
  teacher: "Teacher page",
  page: "Page words",
};

/** How the email's subject names a change: "LoriLee changed the program Qigong". */
const KIND_PHRASE: Record<ContentKind, string> = {
  program: "the program",
  course: "the course",
  lesson: "the lesson",
  email: "the email",
  teacher: "the teacher page for",
  page: "the words on",
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
 * Keep a change and email Jesse about it. Called after the change is saved;
 * the record is written first, so a failed email still leaves it in the
 * history. Returns the change's id.
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
    },
  });

  const changeUrl = `${BASE_URL}/admin/content-changes/${row.id}`;
  const itemUrl = input.itemHref ? (input.itemHref.startsWith("http") ? input.itemHref : `${BASE_URL}${input.itemHref}`) : changeUrl;
  // Each part in order: its name, then before and after as plain words.
  const changesList = input.changes
    .map(
      (c) =>
        `<p><strong>${escape(c.label)}</strong></p>` +
        `<blockquote><p>Before: ${escape(clip(shownValue(c.before))).replace(/\n/g, "<br>")}</p>` +
        `<p>After: ${escape(clip(shownValue(c.after))).replace(/\n/g, "<br>")}</p></blockquote>`,
    )
    .join("");
  after(() =>
    sendTemplatedEmail(
      "content-changed",
      notifyTo(),
      {
        editorName: input.userName,
        itemLabel: `${KIND_PHRASE[input.kind]} ${input.itemLabel}`,
        changedAt: when.format(row.createdAt),
        changesList,
        itemUrl,
        changeUrl,
        changeButton: emailButtonHtml("See this change", changeUrl),
        historyUrl: `${BASE_URL}/admin/content-changes`,
      },
      { memberText: ["editorName", "itemLabel"] },
    ),
  );
  return row.id;
}
