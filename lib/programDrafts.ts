/**
 * Programs being set up (2026-10-28, Phase 2): a draft holds the walk-
 * through's answers (lib/programSetup.ts) until Publish makes it a program
 * through createProgram, which is when the teams are told. A draft isn't a
 * program, so nothing that lists, schedules, reminds or emails programs sees
 * it. Anyone who may use Programs may start, open, continue or discard one
 * (programs are set up together); Publish acts as the person publishing, so
 * the parts only the registration roles choose follow their roles then.
 */
import "server-only";
import { db } from "@/lib/db";
import { createProgram, type SaveActor } from "@/lib/programSave";
import { blankSetup, choicesFrom, setupToBody, slugFor, type SetupData } from "@/lib/programSetup";
import { isShapeCode, shapeStart } from "@/lib/programShapes";
import { helpingTeams } from "@/lib/programHelpers";
import { canUseRegistration } from "@/lib/toolAuth";
import { EDITOR_PROGRAM_INCLUDE, programToEditorData } from "@/lib/programEditorData";
import { copyForNew, freeSlug } from "@/lib/programCopy";
import { toCentralDatetime } from "@/lib/timezone";
import type { ProgramData } from "@/lib/programTypes";

/** The teams a program's setup can offer, by what each does. */
export async function setupTeams() {
  const [hubs, prepTeams] = await Promise.all([
    db.hub.findMany({
      where: { status: "ACTIVE", appLinks: { some: { toolSlug: "schedule", isEnabled: true } } },
      select: { id: true, slug: true, name: true, hasSchedule: true, appliesToFormats: true },
      orderBy: { name: "asc" },
    }),
    helpingTeams(),
  ]);
  return {
    /** Teams that run sessions (a program's hosting team). */
    hosting: hubs.filter((h) => h.hasSchedule).map((h) => ({ slug: h.slug, name: h.name, formats: h.appliesToFormats })),
    /** Teams layered on a session (greeters, AV). */
    supporting: hubs.filter((h) => !h.hasSchedule).map((h) => ({ slug: h.slug, name: h.name, formats: h.appliesToFormats })),
    prepare: prepTeams,
  };
}

/** The answers a new draft starts with: a shape, a copy, or nothing. */
export async function startingSetup(
  actor: SaveActor,
  from: { shape?: string | null; copy?: string | null },
): Promise<{ data: SetupData; shape: string | null; copiedFrom: string | null } | { error: string }> {
  const canDecideAskers = canUseRegistration(actor.roles);
  const blank = blankSetup();
  if (from.copy) {
    const source = await db.program.findUnique({ where: { slug: from.copy }, include: EDITOR_PROGRAM_INCLUDE });
    if (!source) return { error: "That program wasn't found to copy. Choose another." };
    const [coverage, taken, prepTeams] = await Promise.all([
      db.programCoverageHub.findMany({ where: { programSlug: source.slug }, select: { hubSlug: true } }),
      db.program.findMany({ where: { slug: { startsWith: source.slug.replace(/-\d$/, "") } }, select: { slug: true } }),
      helpingTeams(),
    ]);
    const copied = copyForNew(programToEditorData(source, coverage.map((r) => r.hubSlug)), {
      slug: freeSlug(source.slug, new Set(taken.map((t) => t.slug))),
      canDecideAskers,
    });
    copied.helperTeams = (copied.helperTeams ?? []).filter((h) => prepTeams.some((t) => t.id === h.hubId));
    // A copy keeps the original's time of day; the walk-through asks for the dates.
    const keepTime = (iso: Date | null) => (iso ? toCentralDatetime(iso).slice(11, 16) : "");
    const data: SetupData = {
      ...blank,
      ...copied,
      slug: "",
      recurrenceUntil: "",
      listFirst: false,
      // Its address follows its name, as the editor's did: the suggested
      // free one while the name is still the original's.
      setup: { ...choicesFrom({ ...copied, startDatetime: "", endDatetime: "" }), ends: null, copySlug: copied.slug, copyName: copied.name },
    };
    // Its pattern, without dates: the days carry over; the first session is asked again.
    const freq = (source.recurrenceFreq ?? "").toUpperCase();
    data.setup.often = freq === "WEEKLY" ? ((source.recurrenceInterval ?? 1) === 2 ? "biweekly" : "weekly") : freq === "MONTHLY" ? "monthly" : null;
    data.setup.timeFrom = keepTime(source.startDatetime) || data.setup.timeFrom;
    data.setup.timeTo = keepTime(source.endDatetime) || data.setup.timeTo;
    return { data, shape: null, copiedFrom: source.name };
  }
  if (isShapeCode(from.shape)) {
    const prepTeams = await helpingTeams();
    const start = shapeStart(from.shape, { prepTeams, canDecideAskers }) as unknown as Partial<ProgramData>;
    const merged = { ...blank, ...start } as SetupData;
    merged.setup = { ...choicesFrom(merged), seen: [], at: "name" };
    // A shape says how often, but not on which day: that is asked.
    if (merged.recurrenceFreq === "WEEKLY") merged.setup.often = "weekly";
    else if (!merged.recurrenceFreq && from.shape === "RETREAT") merged.setup.often = "days";
    else if (!merged.recurrenceFreq && from.shape !== "DROP_IN") merged.setup.often = "once";
    return { data: merged, shape: from.shape, copiedFrom: null };
  }
  return { data: blank, shape: null, copiedFrom: null };
}

/** Publish a draft: make the program, then let the draft go. The answers on
 *  screen come with the request and are saved first, so what's published is
 *  what the review showed. The draft is claimed before the program is made,
 *  so two people publishing at once can't make two programs. */
export async function publishDraft(actor: SaveActor, id: string, latest?: SetupData): Promise<{ status: number; body: Record<string, unknown> }> {
  const draft = await db.programDraft.findUnique({ where: { id } });
  if (!draft) return { status: 404, body: { error: "This draft isn't here any more. It may have been published or discarded." } };
  const data = latest ?? (draft.data as unknown as SetupData);
  const claimed = await db.programDraft.deleteMany({ where: { id } });
  if (claimed.count === 0) return { status: 409, body: { error: "Someone else is publishing this draft right now. Look for it in the Programs list." } };
  const putBack = () =>
    db.programDraft.create({ data: { id, createdById: draft.createdById, data: data as object, shape: draft.shape, copiedFrom: draft.copiedFrom, createdAt: draft.createdAt } }).catch(() => {});
  try {
    const teams = await setupTeams();
    const supportingTeams = teams.supporting.filter((t) => t.formats.includes(data.programFormat)).map((t) => t.slug);
    const hostingTeams = teams.hosting.filter((t) => t.formats.includes(data.programFormat)).map((t) => t.slug);
    const body = setupToBody(data, { supportingTeams, hostingTeams });
    // The address from the name, made free if another program has it
    // (counting from the address's root, as a copy's address is).
    const wanted = slugFor(data);
    const taken = await db.program.findMany({ where: { slug: { startsWith: wanted.replace(/-\d$/, "") } }, select: { slug: true } });
    const takenSet = new Set(taken.map((t) => t.slug));
    body.slug = takenSet.has(wanted) ? freeSlug(wanted, takenSet) : wanted;
    const result = await createProgram(actor, body);
    if (result.status >= 300) {
      // Not made (or made and then refused a part): the draft stays, with
      // what was on screen, unless the program exists now.
      const made = await db.program.findUnique({ where: { slug: String(body.slug) }, select: { id: true } });
      if (!made) await putBack();
      return result;
    }
    return result;
  } catch (e) {
    await putBack();
    throw e;
  }
}
