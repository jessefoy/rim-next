import "server-only";
import { db } from "@/lib/db";
import { canSeeDanaAmounts, canUsePrograms, canUseRegistration } from "@/lib/toolAuth";
import { canAccessHub, canAccessHubScheduler, effectiveCoordinator, getHubMembership } from "@/lib/hubAuth";
import { buildHubMonthSessions } from "@/lib/scheduleSessions";
import { EDITOR_FIELD_LABELS, EDITOR_PROGRAM_INCLUDE, programToEditorData } from "@/lib/programEditorData";
import { describeRegistrationEvent, SELF_EVENT_KINDS, staffName } from "@/lib/registrationEvents";
import { answerFor, oldAnswers } from "@/lib/registrationAnswers";
import { fmtDay, fmtWhen, placesLine, programWhen, registrationState, type DeskCounts } from "@/lib/registrationDesk";
import { extractBlockNoteText, isHtmlString } from "@/lib/renderRichContent";
import { redactPrivate } from "@/lib/guideContent";
import { inListingOrder } from "@/lib/programOrder";

/**
 * What the signed-in RIM Guide reads from RIM's data (2026-10-27), as the
 * person who connected it: every tool asks the same gate the page asks
 * (lib/toolAuth.ts, lib/hubAuth.ts, the admin pages' checks), with roles read
 * fresh for each call, and returns words, never ids or keys. Read-only: nothing
 * here writes. Called by app/api/guide-mcp/[key]/route.ts.
 */

export type GuideViewer = { userId: string; firstName: string; roles: string[]; sectionGrants: string[] };

const isAdmin = (v: GuideViewer) => v.roles.includes("ADMIN");
// A Content editor may change every program and email (lib/guideEdits.ts),
// so the guide shows them every program's settings and every email too.
const isContentEditor = (v: GuideViewer) => v.roles.includes("CONTENT_EDITOR");
const canReadPrograms = async (v: GuideViewer) => isContentEditor(v) || (await canUsePrograms(v.userId, v.roles));
const canReadEmails = (v: GuideViewer) => isAdmin(v) || isContentEditor(v);
const canUseRegistry = (v: GuideViewer) => v.roles.includes("ADMIN") || v.roles.includes("REGISTRAR");

const NO_ACCESS = (what: string) =>
  `You can't see ${what} on RIM with your account, so the guide can't either. If you think you should, ask Jesse.`;

/** Rich content (BlockNote JSON or HTML) as plain text. */
export function plain(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string" && !isHtmlString(v)) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return extractBlockNoteText(parsed).trim();
    } catch {
      return v;
    }
  }
  if (typeof v === "string") {
    return v
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|h\d|blockquote)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;|&rsquo;/g, "’")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  if (Array.isArray(v)) return extractBlockNoteText(v).trim();
  return JSON.stringify(v);
}

const cents = (c: number | null | undefined) => (typeof c === "number" ? `$${(c / 100).toFixed(2).replace(/\.00$/, "")}` : "");

// ─── Programs ───────────────────────────────────────────────────────────────

const PROGRAM_FIND_SELECT = { slug: true, name: true, archivedAt: true } as const;

/** A program by its web address or by words from its name. */
export async function findProgram(raw: string): Promise<{ slug: string } | string> {
  const q = raw.trim().replace(/^.*\/(programs|registration)\//, "").replace(/\/.*$/, "");
  if (!q) return "Which program? Give its name or its web address.";
  const exact = await db.program.findUnique({ where: { slug: q.toLowerCase() }, select: PROGRAM_FIND_SELECT });
  if (exact) return { slug: exact.slug };
  const found = await db.program.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: PROGRAM_FIND_SELECT,
    orderBy: [{ archivedAt: { sort: "desc", nulls: "first" } }, { name: "asc" }],
    take: 12,
  });
  const live = found.filter((p) => !p.archivedAt);
  if (live.length === 1) return { slug: live[0].slug };
  if (!live.length && found.length === 1) return { slug: found[0].slug };
  if (!found.length) return `No program's name has "${raw}" in it. List the programs to find it.`;
  return `More than one program matches "${raw}":\n${found.map((p) => `- ${p.name} (${p.slug})${p.archivedAt ? ", archived" : ""}`).join("\n")}\nAsk again with one of these addresses.`;
}

const DESK_SELECT = {
  slug: true, name: true, dateText: true, startDatetime: true, endDatetime: true, recurrenceFreq: true,
  recurrenceInterval: true, recurrenceDays: true, registrationEnabled: true, registrationClosed: true,
  registrationCapacity: true, registrationDeadline: true, registrationOpensAt: true, reminderDate: true,
  reminderDaysBefore: true, archivedAt: true,
} as const;

/** Programs as the Programs list shows them; counts only for Registration's people. */
export async function listPrograms(v: GuideViewer, includeArchived: boolean): Promise<string> {
  if (!(await canReadPrograms(v))) return NO_ACCESS("Programs");
  const programs = await db.program.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { name: "asc" },
    select: { ...DESK_SELECT, programFormat: true, offeringCategory: true, offeringFormat: true, recurrenceCount: true, recurrenceUntil: true, listFirst: true },
  }).then(inListingOrder);
  const seePeople = canUseRegistration(v.roles);
  const counts = seePeople
    ? await db.registration.groupBy({
        by: ["programSlug", "status"],
        where: { status: { in: ["REGISTERED", "APPROVED", "WAITLISTED"] } },
        _count: true,
      })
    : [];
  const lines = programs.map((p) => {
    const c: DeskCounts = {
      registered: counts.filter((r) => r.programSlug === p.slug && r.status !== "WAITLISTED").reduce((n, r) => n + r._count, 0),
      waiting: counts.filter((r) => r.programSlug === p.slug && r.status === "WAITLISTED").reduce((n, r) => n + r._count, 0),
      danaNotFinished: 0,
      reminderUnsent: 0,
    };
    const bits = [
      programWhen(p),
      p.programFormat,
      [p.offeringCategory, p.offeringFormat].filter(Boolean).join(" / ") || null,
      p.registrationEnabled ? `${registrationState(p)}${seePeople ? `, ${placesLine(p, c)}` : ""}` : "no registration",
      p.archivedAt ? "archived" : null,
    ].filter(Boolean);
    return `- ${p.name} (${p.slug}): ${bits.join(" · ")}`;
  });
  return `${programs.length} programs${includeArchived ? ", archived ones included" : ""}:\n${lines.join("\n")}`;
}

/** Every setting of one program, as the program editor holds it, by its name in the editor. */
export async function programSettings(v: GuideViewer, raw: string): Promise<string> {
  if (!(await canReadPrograms(v))) return NO_ACCESS("Programs");
  const found = await findProgram(raw);
  if (typeof found === "string") return found;
  const [program, coverage] = await Promise.all([
    db.program.findUnique({ where: { slug: found.slug }, include: EDITOR_PROGRAM_INCLUDE }),
    db.programCoverageHub.findMany({ where: { programSlug: found.slug }, select: { hubSlug: true } }),
  ]);
  if (!program) return "That program isn't there any more.";
  const data = programToEditorData(program, coverage.map((c) => c.hubSlug)) as unknown as Record<string, unknown>;
  const hubIds = (program.helpers ?? []).map((h) => h.hubId);
  const hubs = hubIds.length ? await db.hub.findMany({ where: { id: { in: hubIds } }, select: { id: true, name: true } }) : [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "id") continue;
    const label = EDITOR_FIELD_LABELS[key] ?? key;
    let shown: string;
    if (key === "programTeachers" && Array.isArray(value)) {
      shown = value.map((t) => staffName(t as Parameters<typeof staffName>[0])).join(", ");
    } else if (key === "registrationFields" && Array.isArray(value)) {
      shown = value
        .map((f, i) => {
          const q = f as { label?: string; type?: string; required?: boolean; options?: string[] };
          return `\n  ${i + 1}. ${q.label ?? "(no wording)"} [${q.type ?? "text"}${q.required ? ", required" : ""}${q.options?.length ? `: ${q.options.join(" / ")}` : ""}]`;
        })
        .join("");
    } else if (key === "helperTeams" && Array.isArray(value)) {
      shown = value
        .map((h) => {
          const t = h as { hubId?: string; canReach?: boolean };
          return `${hubs.find((x) => x.id === t.hubId)?.name ?? "a team"}${t.canReach ? " (can reach people)" : ""}`;
        })
        .join(", ");
    } else if (typeof value === "string") {
      shown = plain(value);
    } else if (value === null || value === undefined) {
      shown = "";
    } else if (typeof value === "object" && !Array.isArray(value)) {
      shown = plain(value);
    } else {
      shown = Array.isArray(value) ? value.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : String(value);
    }
    lines.push(`- ${label} [${key}]: ${shown === "" ? "(empty)" : shown}`);
  }
  return redactPrivate(
    `${program.name} (${program.slug}), as the program editor holds it now. Each line is the editor's name for the setting, its field name, and its value.\n\n${lines.join("\n")}`,
  );
}

// ─── Registration ───────────────────────────────────────────────────────────

/** One program's people as the Registration app shows them, or one person in full. */
export async function programPeople(v: GuideViewer, raw: string, person?: string): Promise<string> {
  if (!canUseRegistration(v.roles)) return NO_ACCESS("Registration");
  const found = await findProgram(raw);
  if (typeof found === "string") return found;
  const program = await db.program.findUnique({
    where: { slug: found.slug },
    select: { ...DESK_SELECT, registrationFields: true, danaMode: true },
  });
  if (!program) return "That program isn't there any more.";
  const seeAmounts = canSeeDanaAmounts(v.roles);
  const registrations = await db.registration.findMany({
    where: { programSlug: program.slug, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, status: true, waitlistPosition: true,
      donationStatus: true, donationAmount: true, customFields: true, notes: true, reminderSentAt: true,
      followUpSentAt: true, createdAt: true,
    },
  });
  const counts: DeskCounts = {
    registered: registrations.filter((r) => r.status === "REGISTERED" || r.status === "APPROVED").length,
    waiting: registrations.filter((r) => r.status === "WAITLISTED").length,
    danaNotFinished: 0,
    reminderUnsent: 0,
  };
  const head = `${program.name} (${program.slug}): ${program.archivedAt ? "archived" : registrationState(program)} · ${placesLine(program, counts)} · dana: ${program.danaMode}`;
  const name = (r: { firstName: string; lastName: string }) => `${r.firstName} ${r.lastName}`.trim();
  const statusWords = (r: (typeof registrations)[number]) =>
    r.status === "WAITLISTED" ? `waiting${r.waitlistPosition ? ` (number ${r.waitlistPosition})` : ""}` : r.status.toLowerCase();
  const danaWords = (r: (typeof registrations)[number]) =>
    `dana ${r.donationStatus.toLowerCase()}${seeAmounts && r.donationAmount ? ` ${cents(r.donationAmount)}` : ""}`;

  if (!person?.trim()) {
    const events = await db.registrationEvent.findMany({ where: { programSlug: program.slug }, orderBy: { createdAt: "desc" }, take: 25 });
    const people = registrations.map(
      (r) => `- ${name(r)}: ${statusWords(r)} · ${danaWords(r)} · registered ${fmtDay(r.createdAt)} · ${r.email}${r.phone ? ` · ${r.phone}` : ""}`,
    );
    const nameById = new Map(registrations.map((r) => [r.id, name(r)]));
    const staff = await staffNames(events.map((e) => e.actorId));
    const history = events.map((e) => {
      const who = e.registrationId ? nameById.get(e.registrationId) : null;
      const what = SELF_EVENT_KINDS.includes(e.kind)
        ? describeRegistrationEvent(e.kind, e.detail)
        : `${staff(e.actorId)} ${describeRegistrationEvent(e.kind, e.detail)}`;
      return `- ${fmtWhen(e.createdAt)}${who ? `, ${who}` : ""}: ${what}`;
    });
    return `${head}\n\nPeople (${registrations.length}):\n${people.join("\n") || "(no one yet)"}\n\nLatest history:\n${history.join("\n") || "(none)"}\n\nAsk with a person's name to see their answers, notes and history.`;
  }

  const want = person.trim().toLowerCase();
  const matches = registrations.filter((r) => name(r).toLowerCase().includes(want) || r.email.toLowerCase().includes(want));
  if (!matches.length) return `${head}\n\nNo one registered for it matches "${person}".`;
  if (matches.length > 3) return `${head}\n\n${matches.length} people match "${person}": ${matches.map(name).join(", ")}. Ask with more of the name.`;
  const ids = matches.map((r) => r.id);
  const [notes, events] = await Promise.all([
    db.registrationNote.findMany({ where: { registrationId: { in: ids } }, orderBy: { createdAt: "asc" } }),
    db.registrationEvent.findMany({ where: { registrationId: { in: ids } }, orderBy: { createdAt: "asc" } }),
  ]);
  const staff = await staffNames([...notes.map((n) => n.authorId), ...events.map((e) => e.actorId)]);
  const questions = ((program.registrationFields as { id?: string; label?: string }[] | null) ?? []).filter((q) => q.label) as {
    id?: string;
    label: string;
  }[];
  const blocks = matches.map((r) => {
    const answers = [
      ...questions.map((q) => `  - ${q.label}: ${answerFor(r.customFields, q) || "(not answered)"}`),
      ...oldAnswers(r.customFields, questions).map((o) => `  - ${o.label} (an earlier question): ${o.value}`),
    ];
    const earlier = plain(r.notes);
    return [
      `${name(r)}: ${statusWords(r)} · ${danaWords(r)} · ${r.email}${r.phone ? ` · ${r.phone}` : ""}`,
      `Registered ${fmtWhen(r.createdAt)}. Reminder ${r.reminderSentAt ? `sent ${fmtDay(r.reminderSentAt)}` : "not sent"}. Note after ${r.followUpSentAt ? `sent ${fmtDay(r.followUpSentAt)}` : "not sent"}.`,
      `Answers:\n${answers.join("\n") || "  (no questions)"}`,
      `Notes:\n${[
        ...(earlier ? [`  - (earlier note) ${earlier}`] : []),
        ...notes.filter((n) => n.registrationId === r.id).map((n) => `  - ${fmtWhen(n.createdAt)}, ${staff(n.authorId)}${n.forTeacher ? " (for the teacher)" : ""}: ${n.body}`),
      ].join("\n") || "  (none)"}`,
      `History:\n${events
        .filter((e) => e.registrationId === r.id)
        .map((e) => `  - ${fmtWhen(e.createdAt)}: ${SELF_EVENT_KINDS.includes(e.kind) ? "" : `${staff(e.actorId)} `}${describeRegistrationEvent(e.kind, e.detail)}`)
        .join("\n") || "  (none beyond registering)"}`,
    ].join("\n");
  });
  return `${head}\n\n${blocks.join("\n\n")}`;
}

async function staffNames(ids: (string | null)[]): Promise<(id: string | null) => string> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const staff = unique.length
    ? await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true, preferredName: true } })
    : [];
  return (id) => (id ? staffName(staff.find((s) => s.id === id)) : "RIM");
}

// ─── Emails ─────────────────────────────────────────────────────────────────

/** The email templates (/admin/emails), for Admin: the list, or one in full. */
export async function emailTemplates(v: GuideViewer, slug?: string): Promise<string> {
  if (!canReadEmails(v)) return NO_ACCESS("the email templates");
  if (!slug?.trim()) {
    const all = await db.emailTemplate.findMany({
      orderBy: [{ group: "asc" }, { name: "asc" }],
      select: { slug: true, name: true, description: true, enabled: true, groupLabel: true },
    });
    let group = "";
    const lines: string[] = [];
    for (const t of all) {
      if (t.groupLabel !== group) {
        group = t.groupLabel;
        lines.push(`\n${group}`);
      }
      lines.push(`- ${t.name} (${t.slug})${t.enabled ? "" : ", turned off"}: ${t.description}`);
    }
    return `The emails RIM sends, by group. Read one by its name in brackets.${lines.join("\n")}`;
  }
  const t = await db.emailTemplate.findUnique({
    where: { slug: slug.trim() },
    select: { slug: true, name: true, description: true, subject: true, body: true, textBody: true, enabled: true, variables: true, helpText: true, groupLabel: true, updatedAt: true },
  });
  if (!t) return `There's no email "${slug}". List the emails to find it.`;
  return redactPrivate(
    [
      `${t.name} (${t.slug}), in ${t.groupLabel}${t.enabled ? "" : ". Turned off: it doesn't send"}. Last changed ${fmtDay(t.updatedAt)}.`,
      `When it goes: ${t.description}`,
      t.helpText ? `Notes for whoever edits it: ${t.helpText}` : "",
      `Subject: ${t.subject}`,
      `Body (Markdown; {{name}} is filled in for each person):\n${t.body}`,
      t.textBody ? `Plain-text version:\n${t.textBody}` : "",
      `Fill-ins: ${t.variables.join(", ") || "none"}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
}

// ─── Members ────────────────────────────────────────────────────────────────

/** Members whose name or email has the words, as the Member Registry finds them. */
export async function findMembers(v: GuideViewer, query: string): Promise<string> {
  if (!canUseRegistry(v)) return NO_ACCESS("the Member Registry");
  const q = query.trim();
  if (q.length < 2) return "Give at least two letters of a name or email.";
  const parts = q.split(/\s+/).slice(0, 3);
  const users = await db.user.findMany({
    where: {
      // As the registry lists them: claimed accounts, and pre-staged ones
      // given a role or a team; the untouched legacy pool stays out.
      OR: [{ isLegacyUnclaimed: false }, { roles: { isEmpty: false } }, { hubMemberships: { some: {} } }],
      AND: parts.map((p) => ({
        OR: [
          { firstName: { contains: p, mode: "insensitive" as const } },
          { lastName: { contains: p, mode: "insensitive" as const } },
          { preferredName: { contains: p, mode: "insensitive" as const } },
          { email: { contains: p, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 15,
    select: {
      firstName: true, lastName: true, preferredName: true, email: true, roles: true, archivedAt: true,
      hubMemberships: { where: { hub: { status: "ACTIVE" } }, select: { status: true, isCoordinator: true, hub: { select: { name: true } } } },
    },
  });
  if (!users.length) return `No member matches "${q}".`;
  return users
    .map((u) => {
      const teams = u.hubMemberships.map((m) => `${m.hub.name}${m.isCoordinator ? " (lead)" : ""}${m.status !== "ACTIVE" ? ` (${m.status.toLowerCase()})` : ""}`);
      return `- ${staffName(u)}${u.preferredName ? ` (${u.firstName})` : ""} · ${u.email}${u.roles.length ? ` · roles: ${u.roles.join(", ")}` : ""}${teams.length ? ` · teams: ${teams.join(", ")}` : ""}${u.archivedAt ? " · archived" : ""}`;
    })
    .join("\n");
}

/** One member's record, section by section as the Member Registry shows this viewer. */
export async function memberRecord(v: GuideViewer, email: string): Promise<string> {
  if (!canUseRegistry(v)) return NO_ACCESS("the Member Registry");
  const { MEMBER_SECTIONS } = await import("@/lib/memberSectionRegistry");
  const sees = (id: string) => {
    const s = MEMBER_SECTIONS.find((x) => x.id === id);
    return !!s && (s.allowedRoles.some((r) => v.roles.includes(r)) || v.sectionGrants.includes(id));
  };
  const u = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      firstName: true, lastName: true, preferredName: true, title: true, email: true, phone: true, roles: true,
      createdAt: true, archivedAt: true, agreedToTerms: true, emailVerified: true, memberStatus: true, adminNotes: true, bio: true,
      addressLine1: true, addressCity: true, addressState: true, addressZip: true,
      hubMemberships: { select: { status: true, isCoordinator: true, position: true, joinedAt: true, hub: { select: { name: true, status: true } } } },
      registrations: { orderBy: { createdAt: "desc" }, take: 40, select: { programTitle: true, status: true, donationStatus: true, createdAt: true } },
      courseAccess: { select: { courseSlug: true } },
      household: { select: { household: { select: { name: true, members: { select: { user: { select: { firstName: true, lastName: true, preferredName: true } } } } } } } },
    },
  });
  if (!u) return `No member has the email ${email}. Find them by name first.`;
  const out: string[] = [];
  if (sees("core-record")) {
    out.push(
      `${staffName(u)}${u.title ? `, ${u.title}` : ""} · ${u.email}${u.phone ? ` · ${u.phone}` : ""}`,
      `Joined ${fmtDay(u.createdAt)} · ${u.emailVerified ? "has signed in" : "hasn't signed in yet"} · ${u.agreedToTerms ? "agreed to the community agreements" : "hasn't agreed to the community agreements"}${u.archivedAt ? ` · archived ${fmtDay(u.archivedAt)}` : ""}`,
      [u.addressLine1, u.addressCity, u.addressState, u.addressZip].some(Boolean)
        ? `Address: ${[u.addressLine1, u.addressCity, u.addressState, u.addressZip].filter(Boolean).join(", ")}`
        : "",
    );
  } else {
    out.push(staffName(u));
  }
  if (sees("household") && u.household) {
    out.push(`Household: ${u.household.household.name}: ${u.household.household.members.map((m) => staffName(m.user)).join(", ")}`);
  }
  if (sees("admin-notes") && u.adminNotes) out.push(`Admin notes: ${plain(u.adminNotes)}`);
  if (sees("bio") && u.bio) out.push(`Bio: ${plain(u.bio)}`);
  if (sees("roles")) out.push(`Roles: ${u.roles.join(", ") || "none"}`);
  if (sees("hub-memberships")) {
    out.push(
      `Teams: ${u.hubMemberships.map((m) => `${m.hub.name}${m.isCoordinator ? " (lead)" : ""}${m.position ? `, ${m.position}` : ""}${m.status !== "ACTIVE" ? ` (${m.status.toLowerCase()})` : ""}`).join("; ") || "none"}`,
    );
  }
  if (sees("course-access")) out.push(`Courses: ${u.courseAccess.map((c) => c.courseSlug).join(", ") || "none"}`);
  if (sees("registrations")) {
    out.push(
      `Registrations:\n${u.registrations.map((r) => `  - ${fmtDay(r.createdAt)}, ${r.programTitle}: ${r.status.toLowerCase()} · dana ${r.donationStatus.toLowerCase()}`).join("\n") || "  none"}`,
    );
  }
  return out.filter(Boolean).join("\n");
}

// ─── Teams ──────────────────────────────────────────────────────────────────

/** The teams this person belongs to (and every team for a Guiding Teacher). */
export async function myTeams(v: GuideViewer): Promise<string> {
  const all = v.roles.includes("GUIDING_TEACHER");
  const hubs = await db.hub.findMany({
    where: { status: "ACTIVE", ...(all ? {} : { members: { some: { userId: v.userId } } }) },
    orderBy: { name: "asc" },
    select: { slug: true, name: true, description: true, members: { where: { userId: v.userId }, select: { isCoordinator: true, status: true } } },
  });
  if (!hubs.length) return "You aren't on a team yet.";
  return `Teams you can open:\n${hubs
    .map((h) => `- ${h.name} (${h.slug})${h.members[0]?.isCoordinator ? ", you lead it" : ""}${h.members[0] && h.members[0].status !== "ACTIVE" ? ` (${h.members[0].status.toLowerCase()})` : ""}${h.description ? `: ${plain(h.description)}` : ""}`)
    .join("\n")}`;
}

async function openTeam(v: GuideViewer, slug: string) {
  const { hub, member } = await getHubMembership(slug.trim().toLowerCase(), v.userId, v.roles);
  if (!hub || hub.status !== "ACTIVE") return { error: `There's no team "${slug}". List your teams to find it.` };
  if (!canAccessHub(member, v.roles)) return { error: NO_ACCESS(`the ${hub.name} team`) };
  return { hub, member };
}

/** A team's members, as its Members page shows this person. */
export async function teamMembers(v: GuideViewer, slug: string): Promise<string> {
  const t = await openTeam(v, slug);
  if ("error" in t) return t.error as string;
  // As the Members page decides it: an ACTIVE lead, Admin or Guiding Teacher.
  const lead = effectiveCoordinator(t.member, v.roles);
  const rows = await db.hubMember.findMany({
    where: { hubId: t.hub.id },
    orderBy: [{ isCoordinator: "desc" }, { joinedAt: "asc" }],
    select: { isCoordinator: true, position: true, status: true, coordinatorNote: true, joinedAt: true, user: { select: { firstName: true, lastName: true, preferredName: true, email: true, emailVerified: true } } },
  });
  return `${t.hub.name}: ${rows.length} members${lead ? " (as its lead, you see emails and notes)" : ""}.\n${rows
    .map(
      (m) =>
        `- ${staffName(m.user)}${m.isCoordinator ? ", lead" : ""}${m.position ? `, ${m.position}` : ""}${m.status !== "ACTIVE" ? ` (${m.status.toLowerCase()})` : ""} · joined ${fmtDay(m.joinedAt)}${lead ? ` · ${m.user.email}${m.user.emailVerified ? "" : " · hasn't signed in yet"}${m.coordinatorNote ? ` · note: ${m.coordinatorNote}` : ""}` : ""}`,
    )
    .join("\n")}`;
}

/** A team's conversations, latest first, or one conversation in full. */
export async function teamConversations(v: GuideViewer, slug: string, title?: string): Promise<string> {
  const t = await openTeam(v, slug);
  if ("error" in t) return t.error as string;
  // Both conversations pages close when a team turns them off.
  if (!t.hub.conversationsEnabled) return `${t.hub.name} doesn't use Conversations.`;
  const where = { hubId: t.hub.id, deletedAt: null, archivedAt: null };
  if (!title?.trim()) {
    const threads = await db.hubConversationThread.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      take: 25,
      select: { title: true, category: true, isPinned: true, createdAt: true, updatedAt: true, authorId: true, _count: { select: { replies: true } } },
    });
    const names = await staffNames(threads.map((x) => x.authorId));
    return `${t.hub.name}'s conversations, latest first:\n${threads
      .map((x) => `- ${x.title}${x.isPinned ? " (pinned)" : ""} · ${x.category} · ${names(x.authorId)}, ${fmtDay(x.createdAt)} · ${x._count.replies} replies, last ${fmtDay(x.updatedAt)}`)
      .join("\n") || "(none)"}\n\nAsk with words from a title to read one.`;
  }
  const thread = await db.hubConversationThread.findFirst({
    where: { ...where, title: { contains: title.trim(), mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
    select: { title: true, body: true, createdAt: true, authorId: true, replies: { orderBy: { createdAt: "asc" }, select: { body: true, createdAt: true, authorId: true } } },
  });
  if (!thread) return `No conversation in ${t.hub.name} has "${title}" in its title.`;
  const names = await staffNames([thread.authorId, ...thread.replies.map((r) => r.authorId)]);
  return redactPrivate(
    `${thread.title}, in ${t.hub.name}\n\n${names(thread.authorId)}, ${fmtWhen(thread.createdAt)}:\n${plain(thread.body)}\n\n${thread.replies
      .map((r) => `${names(r.authorId)}, ${fmtWhen(r.createdAt)}:\n${plain(r.body)}`)
      .join("\n\n")}`,
  );
}

/** The team's sessions in the coming weeks, who has each and which need someone, as the Scheduler builds them. */
export async function teamSchedule(v: GuideViewer, slug: string, weeksAsked = 4): Promise<string> {
  const hubSlug = slug.trim().toLowerCase();
  const hub = await db.hub.findUnique({ where: { slug: hubSlug }, select: { name: true, coverageNoun: true, status: true } });
  if (!hub || hub.status !== "ACTIVE") return `There's no team "${slug}". List your teams to find it.`;
  if (!(await canAccessHubScheduler(v.userId, v.roles, hubSlug))) return NO_ACCESS(`${hub.name}'s schedule`);
  const weeks = Math.min(Math.max(Math.round(weeksAsked), 1), 12);
  const now = new Date();
  const until = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  // The Scheduler's own months (lib/scheduleSessions.ts), so sessions no one
  // has yet show as open, as they do on the page.
  const months: { y: number; m: number }[] = [];
  for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d <= until; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    months.push({ y: d.getFullYear(), m: d.getMonth() });
  }
  const built = await Promise.all(months.map(({ y, m }) => buildHubMonthSessions(hubSlug, y, m)));
  const sessions = built
    .flatMap((b) => b.sessions)
    .filter((x) => x.sessionDate && new Date(x.sessionDate) >= now && new Date(x.sessionDate) <= until)
    .sort((a, b) => (a.sessionDate! < b.sessionDate! ? -1 : 1));
  const who = (x: (typeof sessions)[number]) =>
    x.claimants?.length
      ? x.claimants.map((c) => c.userName ?? "someone").join(", ")
      : x.status === "unclaimed"
        ? "open, no one yet"
        : `${x.hostName ?? "someone"}${x.status === "sub_needed" ? ", asking for a sub" : ""}`;
  const open = sessions.filter((x) => x.status === "unclaimed" && !x.claimants?.length).length;
  const subs = sessions.filter((x) => x.status === "sub_needed").length;
  return `${hub.name}'s ${hub.coverageNoun.toLowerCase()} schedule for the next ${weeks} weeks: ${sessions.length} sessions, ${open} open, ${subs} asking for a sub.\n${sessions
    .map((x) => `- ${fmtWhen(new Date(x.sessionDate!))}, ${x.programName}: ${who(x)}`)
    .join("\n") || "(no sessions)"}`;
}

export const viewerCan = {
  programs: canReadPrograms,
  registration: (v: GuideViewer) => canUseRegistration(v.roles),
  emails: canReadEmails,
  registry: canUseRegistry,
};
