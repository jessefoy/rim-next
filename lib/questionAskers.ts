/**
 * Who's asking each registration question (2026-10-24, Phase 3 slice 2,
 * "Who's helping, who's asking"). Each item in Program.registrationFields may
 * carry `askedBy`:
 *   - absent or "registration": the registration team (the default; today's
 *     questions stay as they are);
 *   - "teacher": the program's teachers;
 *   - "team:<hubId>": one of the program's supporting teams (greeters, AV),
 *     by the team's id, so renaming a team never detaches its questions.
 *
 * The registration team reads every answer. A question asked by a teacher
 * when the program has none, or by a team no longer on the program (unticked,
 * archived), is read as the registration team's: one rule, at read time, so
 * the form, the update page and the helpers' pages always agree.
 *
 * Pure, no imports. Wording provisional until Jesse's read-aloud.
 */

export const ASKED_BY_REGISTRATION = "registration";
export const ASKED_BY_TEACHER = "teacher";
export const askedByTeam = (hubId: string) => `team:${hubId}`;

export type Asker =
  | { kind: "registration" }
  | { kind: "teacher" }
  | { kind: "team"; hubId: string; name: string };

export interface AskerContext {
  /** The program's teachers, as shown ("Jesse Foy"). */
  teacherNames: string[];
  /** The program's supporting teams that are active. */
  teams: { id: string; name: string }[];
}

/** Who asks a question, with the fallback to the registration team. */
export function askerOf(askedBy: unknown, ctx: AskerContext): Asker {
  if (askedBy === ASKED_BY_TEACHER && ctx.teacherNames.length > 0) return { kind: "teacher" };
  if (typeof askedBy === "string" && askedBy.startsWith("team:")) {
    const hubId = askedBy.slice(5);
    const team = ctx.teams.find((t) => t.id === hubId);
    if (team) return { kind: "team", hubId, name: team.name };
  }
  return { kind: "registration" };
}

/** The stored value for an asker: absent for the registration team. */
export function askedByValue(asker: Asker): string | undefined {
  return asker.kind === "teacher" ? ASKED_BY_TEACHER : asker.kind === "team" ? askedByTeam(asker.hubId) : undefined;
}

function askerKey(a: Asker): string {
  return a.kind === "team" ? `team:${a.hubId}` : a.kind;
}

/** "For the Greeter Team", and who reads the answers. */
export function askerHeading(a: Asker, ctx: AskerContext): { heading: string; readBy: string } {
  if (a.kind === "teacher") {
    const one = ctx.teacherNames.length === 1;
    return {
      heading: one ? `From ${ctx.teacherNames[0]}, your teacher` : "From your teachers",
      readBy: one ? "Read by your teacher and the registration team." : "Read by your teachers and the registration team.",
    };
  }
  if (a.kind === "team") {
    return { heading: `For the ${a.name}`, readBy: `Read by the ${a.name} and the registration team.` };
  }
  return { heading: "For the registration team", readBy: "Read by the registration team." };
}

export interface QuestionGroup<T> {
  key: string;
  asker: Asker;
  heading: string;
  readBy: string;
  /** Each question with its place in the program's list. */
  questions: { field: T; index: number }[];
}

/**
 * The questions grouped by who asks, groups in the order their first
 * question appears, questions in their own order. `showHeadings` is false
 * when every question is the registration team's: the form then looks as it
 * always has.
 */
export function groupQuestions<T extends { askedBy?: unknown }>(
  fields: T[],
  ctx: AskerContext,
): { groups: QuestionGroup<T>[]; showHeadings: boolean } {
  const groups: QuestionGroup<T>[] = [];
  fields.forEach((field, index) => {
    const asker = askerOf(field.askedBy, ctx);
    const key = askerKey(asker);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, asker, ...askerHeading(asker, ctx), questions: [] };
      groups.push(g);
    }
    g.questions.push({ field, index });
  });
  const showHeadings = groups.some((g) => g.asker.kind !== "registration");
  return { groups, showHeadings };
}

/** The context cut to what the questions use, so a page sends the browser
 *  only the teacher and team names a question actually shows. */
export function askersUsedBy(fields: { askedBy?: unknown }[], ctx: AskerContext): AskerContext {
  const used = new Set(fields.map((f) => askerKey(askerOf(f.askedBy, ctx))));
  return {
    teacherNames: used.has("teacher") ? ctx.teacherNames : [],
    teams: ctx.teams.filter((t) => used.has(`team:${t.id}`)),
  };
}

/**
 * The questions as saved: each `askedBy` kept only when it names a teacher or
 * a team the program has; otherwise it's removed (the registration team's).
 * `teamIds` are the supporting teams the program has after this save.
 */
export function withAskers<T extends Record<string, unknown>>(fields: T[], teamIds: Set<string>): T[] {
  return fields.map((f) => {
    const a = f.askedBy;
    const keep =
      a === ASKED_BY_TEACHER ||
      (typeof a === "string" && a.startsWith("team:") && teamIds.has(a.slice(5)));
    if (keep) return f;
    if (!("askedBy" in f)) return f;
    const { askedBy: _drop, ...rest } = f;
    void _drop;
    return rest as T;
  });
}
