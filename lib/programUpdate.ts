/**
 * "Send an update to the N people registered" (2026-10-24, Phase 4 slice 3).
 *
 * People who registered already have the time, the place and the confirmation
 * message as they were; changing the program doesn't reach them. So when a
 * save in the program editor changes one of those, and people have a place,
 * the editor offers an update, drafted here and sent through Registration's
 * Message people (POST /api/programs/[slug]/message), which keeps it in
 * History.
 *
 * What counts: the schedule (start, end, how it repeats), how and where it
 * meets (the format, and the place for an in-person or hybrid program), and
 * the confirmation message. An outside meeting link doesn't: people join
 * through RIM's door, which always opens the current one. Pure, no imports.
 */

export type UpdateKind = "when" | "where" | "told";

/** The most Message people sends at once (app/api/programs/[slug]/message);
 *  a bigger group belongs to the program's Flodesk segment. */
export const MESSAGE_MAX_PEOPLE = 50;

export const UPDATE_KINDS: UpdateKind[] = ["when", "where", "told"];

/** "You changed the time and the place." */
export const KIND_WORDS: Record<UpdateKind, string> = {
  when: "the time",
  where: "the place",
  told: "the confirmation message",
};

export interface UpdateProgram {
  startDatetime: Date | string | null;
  endDatetime: Date | string | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[] | null;
  recurrenceCount: number | null;
  programFormat: string | null;
  /** The place as an email names it (lib/locations.ts emailLocationFor), or null. */
  place: string | null;
  confirmationMessage: unknown;
}

const time = (d: Date | string | null) => (d ? new Date(d).getTime() : null);

/** The editor's text as plain lines: paragraphs and breaks kept, a link as
 *  "words: address", other tags dropped. HTML only; the route turns an older
 *  stored message into HTML first. */
export function plainText(html: unknown): string {
  if (typeof html !== "string") return "";
  return html
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      return text && text !== href ? `${text}: ${href}` : href;
    })
    .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** What changed that people registered would need to hear, in a fixed order. */
export function changedForPeople(before: UpdateProgram, after: UpdateProgram): UpdateKind[] {
  const kinds: UpdateKind[] = [];
  const days = (p: UpdateProgram) => [...(p.recurrenceDays ?? [])].sort().join(",");
  if (
    time(before.startDatetime) !== time(after.startDatetime) ||
    time(before.endDatetime) !== time(after.endDatetime) ||
    (before.recurrenceFreq ?? null) !== (after.recurrenceFreq ?? null) ||
    (before.recurrenceFreq && after.recurrenceFreq &&
      ((before.recurrenceInterval ?? 1) !== (after.recurrenceInterval ?? 1) ||
        days(before) !== days(after) ||
        (before.recurrenceCount ?? null) !== (after.recurrenceCount ?? null)))
  ) kinds.push("when");
  const inPerson = (p: UpdateProgram) => p.programFormat !== "virtual";
  if (
    (before.programFormat ?? "in-person") !== (after.programFormat ?? "in-person") ||
    (inPerson(after) && (before.place ?? "") !== (after.place ?? ""))
  ) kinds.push("where");
  if (plainText(before.confirmationMessage) !== plainText(after.confirmationMessage)) kinds.push("told");
  return kinds;
}

const centralDay = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

/** One line for each change, as the program now is. A repeating program's
 *  words are only its pattern ("Thursdays"), so a moved first session or a
 *  new number of sessions is said too. */
export function updateLines(
  after: UpdateProgram & { dateText: string | null; timeText: string | null },
  kinds: UpdateKind[],
  before?: UpdateProgram,
  now: Date = new Date(),
): Partial<Record<UpdateKind, string>> {
  const lines: Partial<Record<UpdateKind, string>> = {};
  if (kinds.includes("when")) {
    const parts = [after.dateText, after.timeText].filter(Boolean) as string[];
    if (after.recurrenceFreq && after.startDatetime) {
      const start = new Date(after.startDatetime);
      const moved = !before?.startDatetime || centralDay(before.startDatetime) !== centralDay(start);
      if (moved && start > now) {
        parts.push(`starting ${start.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric" })}`);
      }
      if (after.recurrenceCount && after.recurrenceCount !== (before?.recurrenceCount ?? null)) {
        parts.push(`${after.recurrenceCount} sessions`);
      }
    }
    if (parts.length) lines.when = `When: ${parts.join(", ")}`;
  }
  if (kinds.includes("where")) {
    const online = "online. You join from the program’s page, by the button below";
    lines.where =
      after.programFormat === "virtual"
        ? `Where: ${online}.`
        : after.programFormat === "hybrid"
          ? `Where: ${after.place ? `${after.place}, or ` : ""}${online}.`
          : after.place ? `Where: ${after.place}` : undefined;
    if (!lines.where) delete lines.where;
  }
  if (kinds.includes("told")) {
    const text = plainText(after.confirmationMessage);
    if (text) lines.told = text;
  }
  return lines;
}

/** The draft: a subject and a message (the email adds "Hi [name]," and the
 *  program's button). */
export function composeUpdate(programName: string, lines: Partial<Record<UpdateKind, string>>): { subject: string; message: string } {
  const facts = (["when", "where"] as UpdateKind[]).map((k) => lines[k]).filter(Boolean);
  const parts = [`There’s a change to ${programName}.`];
  if (facts.length) parts.push(facts.join("\n"));
  if (lines.told) parts.push(lines.told);
  parts.push("If this changes your plans, reply to this email and let us know.");
  return { subject: `A change to ${programName}`, message: parts.join("\n\n") };
}

/** "the time and the place", "the time, the place and the confirmation message". */
export function kindsInWords(kinds: UpdateKind[]): string {
  const w = kinds.map((k) => KIND_WORDS[k]);
  return w.length <= 1 ? (w[0] ?? "") : `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}`;
}
