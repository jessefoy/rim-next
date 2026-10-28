import "server-only";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { EDITOR_FIELD_LABELS, EDITOR_PROGRAM_INCLUDE, editorFieldValue, programToEditorData } from "@/lib/programEditorData";
import { createProgram, saveProgram, setProgramArchived, type SaveActor } from "@/lib/programSave";
import { canUseProgramManager, canUsePrograms, canUseRegistration, hasToolAccess } from "@/lib/toolAuth";
import { canEditContent } from "@/lib/contentChanges";
import { copyForNew, freeSlug } from "@/lib/programCopy";
import { isShapeCode, SHAPES, shapeStart } from "@/lib/programShapes";
import { helpingTeams } from "@/lib/programHelpers";
import { deriveDayOfWeek, slugify } from "@/lib/programUtils";
import { saveCourse, saveEmailTemplate, saveLesson, saveTeacherProfile } from "@/lib/contentSaves";
import { recordContentChange, type ChangedPart, type ContentKind } from "@/lib/contentChanges";
import { changePageWords, findPageWords, NoGithubError, pageAddress, wordsPattern, type WordsChange } from "@/lib/pageWords";
import { findProgram } from "@/lib/guideData";
import { isBlockNoteJSON } from "@/lib/renderRichContent";

/**
 * What the RIM Guide changes for a person (2026-10-28). It acts as them
 * (phase 1, Jesse: "an alternative interface for the whole RIM Next
 * webapp"): what they may do on the site, through the site's own steps
 * (lib/programSave.ts, lib/contentSaves.ts), so a change does exactly what the
 * button does. A Content editor may also change content in every editor (the
 * content parts, not who may see or reach things) and the words on the pages
 * (lib/pageWords.ts). Every change is recorded and emailed to Jesse
 * (lib/contentChanges.ts). Called by app/api/guide-mcp/[key]/route.ts.
 */

export type EditKind = Exclude<ContentKind, "page">;

/** A change to one part, by finding words in it. */
export type Replacement = { field: string; find: string; replace_with: string };

const owns = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── The parts each editor saves, by the names its save takes ───────────────

const COURSE_FIELDS: Record<string, string> = {
  title: "The title", slug: "The web address", subheading: "The subheading", description: "The description",
  heroImage: "The image", pullQuote: "The quote", pullQuoteSource: "The quote's source", danaText: "The dana words",
  danaMessage: "The dana message", danaMode: "The dana setting", suggestedDana: "The suggested dana",
  danaBaseAmount: "The base amount", danaFixedAmount: "The fixed amount", completionNote: "The completion note",
  accessRestrictionMessage: "The note when someone can't enroll",
  categoryId: "The category", sortOrder: "The sort order", isActive: "Active",
  publishOnPublicCatalog: "On the public courses page", hideFromMemberProfile: "Hidden from member profiles",
  lessonOrder: "The lessons and their order",
};

const LESSON_FIELDS: Record<string, string> = {
  titleDisplayed: "The title", titleInternal: "The internal title", slug: "The web address", body: "The lesson",
  headerQuote: "The quote", quoteSource: "The quote's source", reflectionPrompt: "The reflection",
  heroImageUrl: "The image", heroImageAlt: "The image's description", audioUrl: "The audio",
  videoUrl: "The video", durationMinutes: "The length in minutes", resources: "The resources",
};

// Not on or off: turning an email off is the admins' (review, 2026-10-28).
const EMAIL_FIELDS: Record<string, string> = { subject: "The subject", body: "The email" };

/**
 * Emails a Content editor may not change: the sign-in codes (whoever writes
 * them could send someone's code anywhere) and the email telling Jesse about
 * each change. Read-only through the guide; admins change them on the site.
 */
const emailClosed = (t: { slug: string; group: string }) => t.group === "01-auth" || t.slug === "content-changed";

/**
 * Rich text parts: set only as HTML (cleaned when shown), never as the older
 * raw-HTML object, which is shown as it is (review, 2026-10-28).
 */
const RICH: Record<EditKind, string[]> = {
  program: ["description", "programNotes", "confirmationMessage", "followUpMessage", "reminderMessage"],
  course: ["description", "danaMessage"],
  lesson: ["body"],
  email: [],
  teacher: [],
};

/** The parts that take a list; every other part takes words, a number, on/off or empty. */
const LIST_PARTS = new Set([
  "recurrenceDays", "registrationFields", "lessonOrder", "resources", "teacherIds", "coverageHubSlugs",
  "helperTeams", "teacherFacilitators", "requiredRoles", "dayOfWeek",
]);

/** A short fingerprint of an item as read, so a whole-part change can't overwrite a newer save. */
const versionOf = (v: unknown) => createHash("sha256").update(JSON.stringify(v ?? null)).digest("hex").slice(0, 10);

const TEACHER_FIELDS: Record<string, string> = { bio: "The bio", photoUrl: "The photo", isPublic: "Shown on the teachers page" };

/**
 * Parts that decide who may see or reach something, never changed through
 * the guide (review, 2026-10-28; Jesse: "this is content only"): a program's
 * teachers (who see the people registered), guest and open entry, the teams
 * that host, support or prepare (who see the people), the mailing list; a
 * course's roles, self-enrolment and onboarding; a lesson's access and
 * teachers. Those stay with the editors on the site.
 */
const ACCESS_PARTS = new Set([
  "teacherIds", "isOpenAccess", "openEntry", "hostingHubSlug", "hostingRequired", "coverageHubSlugs",
  "helperTeams", "flodeskSync", "flodeskSegmentId", "dateText", "timeText",
]);

const PROGRAM_FIELDS: Record<string, string> = Object.fromEntries(
  Object.entries(EDITOR_FIELD_LABELS)
    .filter(([k]) => !ACCESS_PARTS.has(k))
    .map(([k, v]) => [k, cap(v)]),
);

export const FIELDS: Record<EditKind, Record<string, string>> = {
  program: PROGRAM_FIELDS,
  course: COURSE_FIELDS,
  lesson: LESSON_FIELDS,
  email: EMAIL_FIELDS,
  teacher: TEACHER_FIELDS,
};

/**
 * Every part an editor sets, for someone who uses that editor on the site:
 * the guide acts as them, so it may set what they may set there (the save
 * still refuses what only the registration roles choose). The mailing list
 * is set in Registration, not the editor.
 */
const FULL_FIELDS: Record<EditKind, Record<string, string>> = {
  program: Object.fromEntries(
    Object.entries(EDITOR_FIELD_LABELS)
      .filter(([k]) => !["dateText", "timeText", "flodeskSync", "flodeskSegmentId"].includes(k))
      .map(([k, v]) => [k, cap(v)]),
  ),
  course: { ...COURSE_FIELDS, allowSelfEnroll: "Self-enroll", isOnboarding: "Onboarding", requiredRoles: "The roles that may see it" },
  lesson: { ...LESSON_FIELDS, accessLevel: "Who may open it", teacherIds: "The teachers" },
  email: EMAIL_FIELDS,
  teacher: TEACHER_FIELDS,
};

/** What this person may do on the site, read now. */
export type Reach = { contentEditor: boolean; programs: boolean; programManager: boolean; learning: boolean; admin: boolean };

export async function reachOf(actor: SaveActor): Promise<Reach> {
  const roles = [...actor.roles];
  return {
    contentEditor: canEditContent(roles),
    programs: await canUsePrograms(actor.id, roles),
    programManager: canUseProgramManager(roles),
    learning: await hasToolAccess(actor.id, roles, ["TEACHER"], "learning"),
    admin: roles.includes("ADMIN"),
  };
}

/**
 * The parts this person may change of this kind: all of them where they use
 * that editor on the site (Programs, the Course Manager, Admin for emails and
 * teacher pages); a Content editor's content parts otherwise; none if neither.
 */
export function fieldsFor(kind: EditKind, r: Reach): Record<string, string> | null {
  const onSite = kind === "program" ? r.programs : kind === "course" || kind === "lesson" ? r.learning : r.admin;
  if (onSite) return FULL_FIELDS[kind];
  return r.contentEditor ? FIELDS[kind] : null;
}

/** Whether this person may change anything through the guide's edit tool. */
export const canEditAny = (r: Reach) => r.contentEditor || r.programs || r.learning || r.admin;

// ─── Finding words inside a value ───────────────────────────────────────────

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Replace words that appear exactly once in a value (plain, HTML or the older block format). */
export function replaceIn(value: unknown, find: string, replaceWith: string): { value: unknown } | { error: string } {
  const re = wordsPattern(find);
  if (!re) return { error: "Give at least a few words to find." };
  if (typeof value === "string") {
    const html = /<[a-z][\s\S]*>/i.test(value);
    // In HTML, only the words a reader sees: never inside a tag (a link's address, say).
    const tags = html ? [...value.matchAll(/<[^>]*>/g)].map((t) => [t.index!, t.index! + t[0].length]) : [];
    const hits = [...value.matchAll(re)].filter((h) => !tags.some(([a, b]) => h.index! < b && h.index! + h[0].length > a));
    if (hits.length !== 1) return { error: hits.length ? `Those words are there ${hits.length} times; include more of the words around them.` : "Those words aren't there now." };
    const i = hits[0].index!;
    return { value: value.slice(0, i) + (html ? escapeHtml(replaceWith) : replaceWith) + value.slice(i + hits[0][0].length) };
  }
  if (isBlockNoteJSON(value)) {
    const copy = JSON.parse(JSON.stringify(value));
    const texts: { item: { text: string } }[] = [];
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (typeof o.text === "string") texts.push({ item: o as { text: string } });
      walk(o.content);
      walk(o.children);
    };
    walk(copy);
    const hits = texts.flatMap((t) => [...t.item.text.matchAll(re)].map((m) => ({ t, m })));
    if (hits.length !== 1) return { error: hits.length ? `Those words are there ${hits.length} times; include more of the words around them.` : "Those words aren't there as one piece (they may cross bold text or a link)." };
    const { t, m } = hits[0];
    t.item.text = t.item.text.slice(0, m.index) + replaceWith + t.item.text.slice(m.index! + m[0].length);
    return { value: copy };
  }
  return { error: "That part isn't words, so it can only be set, not searched." };
}

// ─── Finding the item ───────────────────────────────────────────────────────

/**
 * One item, by its web address or by words from its name: the one match, or
 * the words to say back (none given, none found, or more than one, listed).
 */
async function only<T>(raw: string, strip: RegExp, what: string, bySlug: (q: string) => Promise<T | null>, byName: (q: string) => Promise<T[]>, name: (t: T) => string): Promise<T | string> {
  const q = raw.trim().replace(strip, "").replace(/\/.*$/, "").trim();
  if (q.length < 2) return `Which ${what}? Give its name or web address.`;
  const exact = await bySlug(q.toLowerCase());
  if (exact) return exact;
  const found = await byName(q);
  if (found.length === 1) return found[0];
  if (!found.length) return `No ${what} matches "${raw}".`;
  return `More than one ${what} matches "${raw}":\n${found.map((f) => `- ${name(f)}`).join("\n")}\nAsk again with one of these.`;
}

const findCourse = (raw: string) =>
  only(raw, /^.*\/courses?\//, "course",
    (q) => db.course.findUnique({ where: { slug: q } }),
    (q) => db.course.findMany({ where: { title: { contains: q, mode: "insensitive" } }, take: 8 }),
    (c) => `${c.title} (${c.slug})`);

const findLesson = (raw: string) =>
  only(raw, /^.*\/lessons\//, "lesson",
    (q) => db.lesson.findUnique({ where: { slug: q } }),
    (q) => db.lesson.findMany({ where: { OR: [{ titleDisplayed: { contains: q, mode: "insensitive" } }, { titleInternal: { contains: q, mode: "insensitive" } }] }, take: 8 }),
    (l) => `${l.titleDisplayed} (${l.slug})`);

const TEACHER_INCLUDE = { user: { select: { firstName: true, lastName: true, preferredName: true } } } as const;

const findTeacher = (raw: string) =>
  only(raw, /^.*\/teachers\//, "teacher page",
    (q) => db.teacherProfile.findFirst({ where: { slug: q }, include: TEACHER_INCLUDE }),
    (q) => db.teacherProfile.findMany({
      where: {
        AND: q.split(/\s+/).filter(Boolean).map((w) => ({
          user: { OR: [{ firstName: { contains: w, mode: "insensitive" as const } }, { lastName: { contains: w, mode: "insensitive" as const } }, { preferredName: { contains: w, mode: "insensitive" as const } }] },
        })),
      },
      include: TEACHER_INCLUDE,
      take: 8,
    }),
    (t) => teacherName(t));

const teacherName = (t: { user: { firstName: string | null; lastName: string | null; preferredName: string | null } }) =>
  `${t.user.preferredName || t.user.firstName || ""} ${t.user.lastName ?? ""}`.trim();

// ─── Reading exactly ────────────────────────────────────────────────────────

const show = (v: unknown) => (v === null || v === undefined ? "(empty)" : typeof v === "string" ? v : JSON.stringify(v));

async function loadProgram(slug: string) {
  const p = await db.program.findUnique({ where: { slug }, include: EDITOR_PROGRAM_INCLUDE });
  if (!p) return null;
  const cov = await db.programCoverageHub.findMany({ where: { programSlug: p.slug }, select: { hubSlug: true } });
  return { p, data: programToEditorData(p, cov.map((c) => c.hubSlug)) };
}

const courseLessons = async (courseId: string) =>
  (await db.courseLesson.findMany({ where: { courseId }, orderBy: { sortOrder: "asc" }, select: { lessonId: true, groupLabel: true } }))
    .map((l) => ({ id: l.lessonId, groupLabel: l.groupLabel }));

const lessonTeachers = async (lessonId: string) =>
  (await db.lessonTeacher.findMany({ where: { lessonId }, orderBy: { order: "asc" }, select: { userId: true } })).map((t) => t.userId);

/** Each kind's state as read: what its version fingerprints. */
const courseState = async (c: { id: string }) => ({ row: c, lessons: await courseLessons(c.id) });
const lessonState = async (l: { id: string }) => ({ row: l, teachers: await lessonTeachers(l.id) });

const versionLine = (v: string) => `\nVersion: ${v} (give it to edit_content when setting whole parts with changes).`;

/** Items exactly as stored, so a change keeps everything it doesn't touch. */
export async function readContent(actor: SaveActor, kind: string, item?: string, field?: string): Promise<string> {
  if (!["program", "course", "lesson", "email", "teacher"].includes(kind)) return "Read a program, course, lesson, email or teacher.";
  const allowed = fieldsFor(kind as EditKind, await reachOf(actor));
  if (!allowed) return "That isn't something your account changes on the site, so the guide reads it with the other tools instead.";
  switch (kind) {
    case "program": {
      if (!item) return "Which program? Use list_programs to find it.";
      const found = await findProgram(item);
      if (typeof found === "string") return found;
      const loaded = await loadProgram(found.slug);
      if (!loaded) return "That program isn't there any more.";
      const { p, data } = loaded;
      const version = versionLine(versionOf(data));
      if (!field || !owns(allowed, field)) return `${p.name} (${p.slug}). Give one of these parts to read it exactly: ${Object.keys(allowed).join(", ")}. program_settings shows them all as words.${version}`;
      return `${p.name} (${p.slug}), ${allowed[field].toLowerCase()} [${field}], exactly as stored (rich text is HTML):\n\n${show(editorFieldValue(data, field))}\n${version}`;
    }
    case "course": {
      if (!item) {
        const all = await db.course.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { title: true, slug: true, isActive: true } });
        return `The courses:\n${all.map((c) => `- ${c.title} (${c.slug})${c.isActive ? "" : ", not active"}`).join("\n")}`;
      }
      const c = await findCourse(item);
      if (typeof c === "string") return c;
      const state = await courseState(c);
      const titles = new Map((await db.lesson.findMany({ where: { id: { in: state.lessons.map((l) => l.id) } }, select: { id: true, slug: true, titleDisplayed: true } })).map((l) => [l.id, l]));
      const parts = Object.keys(allowed).filter((k) => k !== "lessonOrder").map((k) => `- ${allowed[k]} [${k}]: ${show((c as Record<string, unknown>)[k])}`);
      return `${c.title} (${c.slug}), exactly as stored (rich text is HTML):\n${parts.join("\n")}\n\nIts lessons in order (lessonOrder takes [{ id, groupLabel }] in this order):\n${state.lessons.map((l, i) => `${i + 1}. ${titles.get(l.id)?.titleDisplayed ?? "?"} (${titles.get(l.id)?.slug ?? "?"}) id ${l.id}${l.groupLabel ? `, under "${l.groupLabel}"` : ""}`).join("\n")}\n${versionLine(versionOf(state))}`;
    }
    case "lesson": {
      if (!item) return "Which lesson? Read its course to find it.";
      const l = await findLesson(item);
      if (typeof l === "string") return l;
      const state = await lessonState(l);
      const parts = Object.keys(allowed).map((k) => `- ${allowed[k]} [${k}]: ${show(k === "teacherIds" ? state.teachers : (l as Record<string, unknown>)[k])}`);
      return `${l.titleDisplayed} (${l.slug}), exactly as stored (rich text is HTML):\n${parts.join("\n")}\n${versionLine(versionOf(state))}`;
    }
    case "email": {
      if (!item) return "Which email? email_templates lists them.";
      const t = await db.emailTemplate.findUnique({ where: { slug: item.trim() } });
      if (!t) return `There's no email "${item}". email_templates lists them.`;
      const closed = emailClosed(t) ? "\nThis email can't be changed through the guide; admins change it on the site." : "";
      return `${t.name} (${t.slug}), exactly as stored:\n- The subject [subject]: ${t.subject}\n- The email [body] (Markdown; {{name}} fills in a variable):\n${t.body}\n${closed || versionLine(versionOf(t))}`;
    }
    case "teacher": {
      if (!item) {
        const all = await db.teacherProfile.findMany({ include: TEACHER_INCLUDE });
        return `The teacher pages:\n${all.map((t) => `- ${teacherName(t)}${t.slug ? ` (/teachers/${t.slug})` : ""}${t.isPublic ? "" : ", not shown"}`).join("\n")}`;
      }
      const t = await findTeacher(item);
      if (typeof t === "string") return t;
      return `${teacherName(t)}'s teacher page, exactly as stored:\n- The bio [bio]: ${show(t.bio)}\n- The photo [photoUrl]: ${show(t.photoUrl)}\n- Shown on the teachers page [isPublic]: ${t.isPublic ? "yes" : "no"}\n${versionLine(versionOf(t))}`;
    }
    default:
      return "Read a program, course, lesson, email or teacher.";
  }
}

// ─── Changing ───────────────────────────────────────────────────────────────

type Actor = SaveActor & { name: string };

/** The parts as given, after any finding of words; or why not. */
function applyEdits(
  kind: EditKind,
  allowed: Record<string, string>,
  current: (key: string) => unknown,
  changes: Record<string, unknown> | undefined,
  replace: Replacement[] | undefined,
): { body: Record<string, unknown> } | { error: string } {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes ?? {})) {
    if (!owns(allowed, k)) return { error: `"${k}" isn't something the ${kind} editor saves. The parts are: ${Object.keys(allowed).join(", ")}.` };
    // A value is words, a number, on/off, a list, or empty: never an object
    // (the older raw-HTML format is shown without cleaning).
    if (v !== null && typeof v === "object" && !(Array.isArray(v) && LIST_PARTS.has(k))) return { error: `${allowed[k]} takes words, a number, on or off${LIST_PARTS.has(k) ? ", or a list" : ""}.` };
    if (RICH[kind].includes(k) && v !== null && typeof v !== "string") return { error: `${allowed[k]} takes HTML, as read_content shows it.` };
    body[k] = v;
  }
  for (const r of replace ?? []) {
    if (!owns(allowed, r.field)) return { error: `"${r.field}" isn't something the ${kind} editor saves.` };
    const from = r.field in body ? body[r.field] : current(r.field);
    const done = replaceIn(from, String(r.find ?? ""), String(r.replace_with ?? ""));
    if ("error" in done) return { error: `${allowed[r.field]}: ${done.error}` };
    body[r.field] = done.value;
  }
  if (!Object.keys(body).length) return { error: "Nothing to change: give the changes, or words to find and replace." };
  return { body };
}

const refused = (status: number, body: Record<string, unknown>) =>
  `Nothing was saved. The editor said: ${typeof body.error === "string" ? body.error : `it couldn't save (${status}).`}`;

/**
 * Whole parts set with `changes` were written from a reading; refuse them if
 * the item changed since (review, 2026-10-28: someone may have saved in the
 * editor meanwhile). Finding words in a part (`replace`) works on the part as
 * it is now, so it needs no version.
 */
function stale(changes: Record<string, unknown> | undefined, given: string | undefined, now: string): string | null {
  if (!changes || !Object.keys(changes).length) return null;
  if (!given) return "Nothing was saved. Read it first with read_content and give its version, so nothing newer is overwritten.";
  if (given !== now) return "Nothing was saved: it changed since you read it (someone may have saved it on the site). Read it again with read_content, check, and make the change from that.";
  return null;
}

/** Change one item through its editor's own save, and record what changed. */
export async function editContent(
  actor: Actor,
  kind: string,
  item: string,
  changes: Record<string, unknown> | undefined,
  replace: Replacement[] | undefined,
  version?: string,
): Promise<string> {
  if (!["program", "course", "lesson", "email", "teacher"].includes(kind)) return "Change a program, course, lesson, email or teacher.";
  const k = kind as EditKind;
  const allowed = fieldsFor(k, await reachOf(actor));
  if (!allowed) return `You can't change ${k === "teacher" ? "teacher pages" : `${k}s`} on the site with your account, so the guide can't either. If you think you should, ask Jesse.`;
  let parts: ChangedPart[] = [];
  let label = "";
  let key = "";
  let href: string | null = null;
  const notes: string[] = [];

  if (k === "program") {
    const found = await findProgram(item);
    if (typeof found === "string") return found;
    const before = await loadProgram(found.slug);
    if (!before) return "That program isn't there any more.";
    const edits = applyEdits(k, allowed, (f) => editorFieldValue(before.data, f), changes, replace);
    if ("error" in edits) return `Nothing was saved. ${edits.error}`;
    const bad = await checkParts(edits.body);
    if (bad) return `Nothing was saved. ${bad}`;
    const old = stale(changes, version, versionOf(before.data));
    if (old) return old;
    // The editor's own check too: refused if someone changed these parts meanwhile.
    const _base = Object.fromEntries(Object.keys(edits.body).map((f) => [f, editorFieldValue(before.data, f)]));
    const result = await saveProgram(actor, found.slug, { ...edits.body, _base });
    if (result.status !== 200) return refused(result.status, result.body);
    const slugNow = (result.body.slug as string) ?? found.slug;
    const afterData = (result.body.editorData as typeof before.data | null) ?? (await loadProgram(slugNow))?.data ?? null;
    parts = Object.keys(edits.body)
      .map((f) => ({ label: allowed[f], before: editorFieldValue(before.data, f), after: afterData ? editorFieldValue(afterData, f) : edits.body[f] }))
      .filter((c) => !same(c.before, c.after));
    label = (result.body.name as string) ?? before.p.name;
    key = slugNow;
    href = `/programs/${slugNow}`;
    // What the editor says beside Save after the same change.
    const sc = result.body.scheduleCleared as { sessions: number; rotations: number } | null;
    if (sc?.sessions) notes.push(`${sc.sessions} upcoming session(s) on days it no longer meets were cleared, and the people scheduled for them are emailed.`);
    if (sc?.rotations) notes.push(`${sc.rotations} rotation(s) that no longer fit were removed; the new days are set up in the Scheduler's Rotations tab.`);
    const conflicts = result.body.seatConflicts as { message: string }[] | undefined;
    if (conflicts?.length) notes.push(`Zoom: ${conflicts.map((c) => c.message).join(" ")}`);
    if (typeof result.body.meetingsNotRenamed === "number" && result.body.meetingsNotRenamed > 0) notes.push("Zoom didn't take the new name yet for a session already set up; it's given the new name when the session opens.");
    if (result.body.updateOffer) notes.push("The time, place or confirmation message changed, and the people registered haven't been told. Sending them an update is done in Registration (Message people).");
  } else if (k === "course") {
    const c = await findCourse(item);
    if (typeof c === "string") return c;
    const state = await courseState(c);
    const before = c as Record<string, unknown>;
    const edits = applyEdits(k, allowed, (f) => before[f], changes, replace);
    if ("error" in edits) return `Nothing was saved. ${edits.error}`;
    const bad = await checkParts(edits.body);
    if (bad) return `Nothing was saved. ${bad}`;
    const old = stale(changes, version, versionOf(state));
    if (old) return old;
    const result = await saveCourse(c.slug, edits.body);
    if (result.status !== 200) return refused(result.status, result.body);
    const now = (await db.course.findUnique({ where: { id: c.id } })) as Record<string, unknown> | null;
    const orderNow = await courseLessons(c.id);
    parts = Object.keys(edits.body)
      .map((f) => ({ label: allowed[f], before: f === "lessonOrder" ? state.lessons : before[f], after: f === "lessonOrder" ? orderNow : now?.[f] }))
      .filter((p) => !same(p.before, p.after));
    label = (now?.title as string) ?? c.title;
    key = (now?.slug as string) ?? c.slug;
    href = `/course/${key}`;
  } else if (k === "lesson") {
    const l = await findLesson(item);
    if (typeof l === "string") return l;
    const state = await lessonState(l);
    const before = l as Record<string, unknown>;
    const edits = applyEdits(k, allowed, (f) => (f === "teacherIds" ? state.teachers : before[f]), changes, replace);
    if ("error" in edits) return `Nothing was saved. ${edits.error}`;
    const bad = await checkParts(edits.body);
    if (bad) return `Nothing was saved. ${bad}`;
    const old = stale(changes, version, versionOf(state));
    if (old) return old;
    const result = await saveLesson(l.slug, edits.body);
    if (result.status !== 200) return refused(result.status, result.body);
    const now = (await db.lesson.findUnique({ where: { id: l.id } })) as Record<string, unknown> | null;
    const teachersNow = await lessonTeachers(l.id);
    parts = Object.keys(edits.body)
      .map((f) => ({ label: allowed[f], before: f === "teacherIds" ? state.teachers : before[f], after: f === "teacherIds" ? teachersNow : now?.[f] }))
      .filter((p) => !same(p.before, p.after));
    label = (now?.titleDisplayed as string) ?? l.titleDisplayed;
    key = (now?.slug as string) ?? l.slug;
    href = `/lessons/${key}`;
  } else if (k === "email") {
    const t = await db.emailTemplate.findUnique({ where: { slug: item.trim() } });
    if (!t) return `There's no email "${item}". email_templates lists them.`;
    if (emailClosed(t)) return "Nothing was saved. The sign-in emails and the email about content changes can't be changed through the guide; admins change them on the site.";
    const before = t as Record<string, unknown>;
    const edits = applyEdits(k, allowed, (f) => before[f], changes, replace);
    if ("error" in edits) return `Nothing was saved. ${edits.error}`;
    const old = stale(changes, version, versionOf(t));
    if (old) return old;
    const b = edits.body;
    const result = await saveEmailTemplate(t.slug, {
      subject: typeof b.subject === "string" ? b.subject : undefined,
      body: typeof b.body === "string" ? b.body : undefined,
      updatedById: actor.id,
    });
    if (result.status !== 200) return refused(result.status, result.body);
    parts = Object.keys(b).map((f) => ({ label: allowed[f], before: before[f], after: result.body[f] })).filter((p) => !same(p.before, p.after));
    label = t.name;
    key = t.slug;
    href = `/admin/emails/${t.slug}`;
  } else {
    const t = await findTeacher(item);
    if (typeof t === "string") return t;
    const before = t as unknown as Record<string, unknown>;
    const edits = applyEdits(k, allowed, (f) => before[f], changes, replace);
    if ("error" in edits) return `Nothing was saved. ${edits.error}`;
    const old = stale(changes, version, versionOf(t));
    if (old) return old;
    const result = await saveTeacherProfile(t.userId, edits.body);
    if (result.status !== 200) return refused(result.status, result.body);
    parts = Object.keys(edits.body).map((f) => ({ label: allowed[f], before: before[f], after: result.body[f] })).filter((p) => !same(p.before, p.after));
    label = teacherName(t);
    key = t.userId;
    href = t.slug ? `/teachers/${t.slug}` : null;
  }

  if (!parts.length) return "Saved, but nothing was different from before, so there was nothing to record.";
  const recorded = await keep({ userId: actor.id, userName: actor.name, kind: k, itemKey: key, itemLabel: label, itemHref: href, changes: parts });
  return [
    `Saved: ${parts.map((p) => p.label.toLowerCase()).join(", ")} of ${label}. It's on the site now${href ? ` (${href})` : ""}${recorded ? ", and Jesse has been sent the change." : "."}`,
    ...(recorded ? [] : [NOT_RECORDED]),
    ...notes,
  ].join("\n");
}

const NOT_RECORDED = "The change was made, but its record didn't save, so Jesse hasn't been told. Tell him what changed.";

/** Keep the change and tell Jesse; false if the record couldn't be written. */
async function keep(input: Parameters<typeof recordContentChange>[0]): Promise<boolean> {
  try {
    await recordContentChange(input);
    return true;
  } catch (e) {
    console.error("[guideEdits] recording a change failed", e);
    return false;
  }
}

/** Where words are in the site's pages. */
export async function findWords(words: string): Promise<string> {
  const found = await findPageWords(words);
  if (!found) return "Give at least a few words to find.";
  if (!found.length) return `"${words}" isn't in the site's pages as written. It may be in a program, course, lesson, email or teacher page instead (those are changed with edit_content), or the words may differ slightly; try fewer of them.`;
  return found
    .map((f) => `${f.file} line ${f.line}${pageAddress(f.file) ? ` (the page ${pageAddress(f.file)})` : ""}:\n${f.context}`)
    .join("\n\n");
}

/** Change words on the pages: words only, all of them in one commit to the site. */
export async function changeWords(actor: Actor, changes: WordsChange[]): Promise<string> {
  let r;
  try {
    r = await changePageWords(changes);
  } catch (e) {
    if (e instanceof NoGithubError) return "Changing page words isn't set up yet (the site needs its GitHub key). Nothing changed. Tell Jesse.";
    throw e;
  }
  if (!r.ok) return r.error;
  const pages = [...new Set(r.changes.map((c) => c.page ?? c.file))];
  const recorded = await keep({
    userId: actor.id,
    userName: actor.name,
    kind: "page",
    itemKey: [...new Set(r.changes.map((c) => c.file))].join(", "),
    itemLabel: pages.length === 1 ? pages[0] : `${pages.slice(0, -1).join(", ")} and ${pages[pages.length - 1]}`,
    itemHref: r.changes.find((c) => c.page)?.page ?? null,
    changes: r.changes.map((c) => ({ label: `Words on ${c.page ?? c.file}`, before: c.before, after: c.after })),
    commitUrl: r.commitUrl,
  });
  return [
    `Changed ${r.changes.length === 1 ? "it" : `all ${r.changes.length}`} in one go. The new words are on ${pages.join(", ")} in about two minutes, once the site has rebuilt${recorded ? ", and Jesse has been sent the change." : `. ${NOT_RECORDED}`}`,
    "Once it has rebuilt, read the page back with page_words to check it reads as intended.",
  ].join("\n");
}

// ─── Starting and archiving programs ────────────────────────────────────────

/**
 * Parts checked before anything is written (review, 2026-10-28): teachers
 * given by name or id become the ids the editor's picker would give (active
 * members marked as teachers, as /api/members/search), each once; dates are
 * the editor's "YYYY-MM-DDTHH:MM" in Central time; numbers are numbers. An
 * unknown teacher used to fail after the old teachers were removed.
 */
async function checkParts(body: Record<string, unknown>): Promise<string | null> {
  if (body.teacherIds !== undefined) {
    if (!Array.isArray(body.teacherIds)) return "The teachers take a list of names.";
    const ids: string[] = [];
    for (const raw of body.teacherIds) {
      const q = String(raw ?? "").trim();
      const pickable = { archivedAt: null, agreedToTerms: true, isTeacher: true, isLegacyUnclaimed: false };
      const byId = q ? await db.user.findFirst({ where: { id: q, ...pickable }, select: { id: true } }) : null;
      const found = byId
        ? [byId]
        : await db.user.findMany({
            where: {
              ...pickable,
              AND: q.split(/\s+/).filter(Boolean).map((w) => ({
                OR: [{ firstName: { contains: w, mode: "insensitive" as const } }, { lastName: { contains: w, mode: "insensitive" as const } }, { preferredName: { contains: w, mode: "insensitive" as const } }],
              })),
            },
            select: { id: true, firstName: true, lastName: true, preferredName: true },
            take: 6,
          });
      if (!q || found.length === 0) return `No teacher matches "${q}". Teachers are members marked as teachers in the Member Registry.`;
      if (found.length > 1) return `More than one teacher matches "${q}"; give the full name.`;
      if (ids.includes(found[0].id)) return `"${q}" is in the teachers twice.`;
      ids.push(found[0].id);
    }
    body.teacherIds = ids;
  }
  // A course's lessons in order: lessons that exist, each once (the save
  // removes the old order before writing the new).
  if (body.lessonOrder !== undefined) {
    if (!Array.isArray(body.lessonOrder)) return "The lessons take a list.";
    const ids = body.lessonOrder.map((x) => (typeof x === "string" ? x : String((x as { id?: unknown })?.id ?? "")));
    if (new Set(ids).size !== ids.length) return "A lesson is in the list twice.";
    const known = await db.lesson.count({ where: { id: { in: ids } } });
    if (known !== ids.length) return "Some of those lessons aren't known. Read the course again with read_content and use the ids it lists.";
  }
  for (const k of DATE_PARTS) {
    const v = body[k];
    if (v !== undefined && v !== null && v !== "" && !(typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))) {
      return `${k} takes a date and time as YYYY-MM-DDTHH:MM in Central time, such as 2026-11-05T19:00.`;
    }
  }
  for (const k of NUMBER_PARTS) {
    const v = body[k];
    if (v !== undefined && v !== null && v !== "" && !Number.isFinite(Number(v))) return `${k} takes a number.`;
  }
  return null;
}

/** The editor's numbers and dates, as its create sends them (ProgramEditor buildPayload). */
const NUMBER_PARTS = ["recurrenceInterval", "recurrenceCount", "registrationCapacity", "reminderDaysBefore", "suggestedDana", "danaBaseAmount", "danaFixedAmount", "sortOrder"];
const DATE_PARTS = ["startDatetime", "endDatetime", "registrationDeadline", "registrationOpensAt", "reminderDate", "dashboardShowAt"];

/** A program as the editor holds it, turned into what the editor's Save sends for a new one. */
function createPayload(data: Record<string, unknown>, name: string, slug: string): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data, name, slug };
  for (const k of ["id", "archived", "offeringFromLegacy", "flodeskSegmentName", "dateText", "timeText", "guestAccessKey", "programTeachers"]) delete out[k];
  if (Array.isArray(data.programTeachers) && out.teacherIds === undefined) out.teacherIds = (data.programTeachers as { id: string }[]).map((t) => t.id);
  for (const k of NUMBER_PARTS) {
    const v = out[k];
    out[k] = v === "" || v === null || v === undefined ? null : Number(v);
  }
  for (const k of DATE_PARTS) if (out[k] === "") out[k] = null;
  if (Array.isArray(out.registrationFields) && out.registrationFields.length === 0) out.registrationFields = null;
  out.dayOfWeek = deriveDayOfWeek(String(out.recurrenceFreq ?? ""), (out.recurrenceDays as string[]) ?? [], String(out.startDatetime ?? ""));
  return out;
}

/**
 * Start a new program as the editor does: blank, from a shape, or as a copy,
 * with any parts set at once, through the editor's own create. For someone
 * who uses Programs on the site, or a Content editor (who sets the content
 * parts only; a copy keeps no teachers or teams for them).
 */
export async function startProgram(
  actor: SaveActor & { name: string },
  input: { name: string; start?: string; copy?: string; changes?: Record<string, unknown> },
): Promise<string> {
  const reach = await reachOf(actor);
  const allowed = fieldsFor("program", reach);
  if (!allowed) return "You can't start programs on the site with your account, so the guide can't either. If you think you should, ask Jesse.";
  const name = input.name.trim();
  if (name.length < 2) return "What is the program called?";
  const canDecideAskers = canUseRegistration(actor.roles);
  const prepTeams = await helpingTeams();

  let draft: Record<string, unknown> = {};
  let from = "blank";
  if (input.copy?.trim()) {
    const found = await findProgram(input.copy);
    if (typeof found === "string") return found;
    const source = await loadProgram(found.slug);
    if (!source) return "That program isn't there any more.";
    draft = copyForNew(source.data, { slug: "", canDecideAskers }) as unknown as Record<string, unknown>;
    draft.helperTeams = ((draft.helperTeams as { hubId: string }[]) ?? []).filter((h) => prepTeams.some((t) => t.id === h.hubId));
    from = `a copy of ${source.p.name}`;
  } else if (input.start && input.start !== "blank") {
    const code = input.start.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (!isShapeCode(code)) return `Start from one of these shapes, or blank: ${SHAPES.map((s) => `${s.code} (${s.name}: ${s.sets})`).join("; ")}.`;
    draft = shapeStart(code, { prepTeams, canDecideAskers }) as unknown as Record<string, unknown>;
    from = `the ${SHAPES.find((s) => s.code === code)!.name} shape`;
  }
  // A Content editor who doesn't use Programs sets content only: a copy
  // brings no teachers, guest access or teams.
  // (The original's hosting team and "No host needed" stay: they are its own
  // arrangement, not a choice, and dropping them would send the copy to the
  // Hosting Team. Review, 2026-10-28.)
  if (!reach.programs) {
    for (const k of [...ACCESS_PARTS, "programTeachers"]) if (k !== "hostingHubSlug" && k !== "hostingRequired") delete draft[k];
  }
  const edits = input.changes && Object.keys(input.changes).length ? applyEdits("program", allowed, (f) => draft[f], input.changes, undefined) : { body: {} };
  if ("error" in edits) return `Nothing was made. ${edits.error}`;
  const bad = await checkParts(edits.body);
  if (bad) return `Nothing was made. ${bad}`;

  const taken = new Set((await db.program.findMany({ where: { slug: { startsWith: slugify(name) || "program" } }, select: { slug: true } })).map((p) => p.slug));
  const base = slugify(name) || "program";
  const slug = typeof edits.body.slug === "string" && edits.body.slug ? String(edits.body.slug) : taken.has(base) ? freeSlug(base, taken) : base;
  const result = await createProgram(actor, createPayload({ ...draft, ...edits.body }, name, slug));
  if (result.status !== 201) return `Nothing was made. The editor said: ${typeof result.body.error === "string" ? result.body.error : `it couldn't save (${result.status}).`}`;

  const made = result.body as { slug: string; name: string };
  const parts: ChangedPart[] = [
    { label: "A new program", before: null, after: `${made.name}, started from ${from}` },
    ...Object.keys(edits.body).map((f) => ({ label: allowed[f] ?? f, before: null, after: edits.body[f] })),
  ];
  const recorded = await keep({ userId: actor.id, userName: actor.name, kind: "program", itemKey: made.slug, itemLabel: made.name, itemHref: `/tools/programs/${made.slug}/edit`, changes: parts });
  const conflicts = (result.body.seatConflicts as { message: string }[] | undefined) ?? [];
  return [
    `Made ${made.name}, started from ${from}. Its address is /programs/${made.slug}; it opens in the editor at /tools/programs/${made.slug}/edit${recorded ? ", and Jesse has been sent the change." : "."}`,
    ...(recorded ? [] : [NOT_RECORDED]),
    ...(conflicts.length ? [`Zoom: ${conflicts.map((c) => c.message).join(" ")}`] : []),
    "Read it back with program_settings, and show them what's still to fill in (Ready to be seen in the editor lists what a program needs before it shows).",
  ].join("\n");
}

/** Archive or restore a program, as Programs' Archive does (the three roles). */
export async function archiveProgram(actor: SaveActor & { name: string }, item: string, archive: boolean): Promise<string> {
  if (!canUseProgramManager(actor.roles)) return "Archiving is for the registrar, admins and the guiding teacher on the site, so the guide can't do it for you.";
  const found = await findProgram(item);
  if (typeof found === "string") return found;
  const p = await db.program.findUnique({ where: { slug: found.slug }, select: { name: true, archivedAt: true } });
  if (!p) return "That program isn't there any more.";
  if (!!p.archivedAt === archive) return `${p.name} is already ${archive ? "archived" : "not archived"}.`;
  const result = await setProgramArchived(found.slug, archive);
  if (result.status !== 200) return `Nothing changed. ${typeof result.body.error === "string" ? result.body.error : ""}`;
  const recorded = await keep({
    userId: actor.id,
    userName: actor.name,
    kind: "program",
    itemKey: found.slug,
    itemLabel: p.name,
    itemHref: `/tools/programs/${found.slug}/edit`,
    changes: [{ label: "Archived", before: !archive, after: archive }],
  });
  return `${p.name} is ${archive ? "archived (it can be restored)" : "restored"}${recorded ? ", and Jesse has been sent the change." : `. ${NOT_RECORDED}`}`;
}
