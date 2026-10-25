/**
 * Start from a shape (2026-10-24, Phase 4 slice 4): a new program begins with
 * "What are you offering?" Each shape is keyed by the Format (the program's
 * `offeringFormat`) and fills sensible starting settings in the editor: who
 * joins how, questions, reminders, the note after. Everything it fills can be
 * changed before the first save, and nothing is decided by the Format after
 * that: open entry stays its own setting (a label never decides access).
 *
 * The questions are the mockup's (mockups/registration-2026-10-23). The
 * dietary questions are asked by a team that prepares meals when one has
 * Helping with (ticking it emails no one); otherwise, like the question about
 * arriving, by the registration team. The greeters aren't ticked: adding a
 * scheduled team emails all of it, which a first save of a draft shouldn't
 * do (review, 2026-10-24). Nor is the note after turned on: it needs its
 * words. Wording provisional until Jesse's read-aloud. Pure, no imports.
 */

export type ShapeCode = "DROP_IN" | "CLASS" | "COURSE" | "WORKSHOP" | "DAY_OF_MINDFULNESS" | "RETREAT";

export interface Shape {
  code: ShapeCode;
  name: string;
  /** What it fills in, in a line. Teams aren't named: the meals team is
   *  ticked only when one is set up to help (see shapeStart). */
  sets: string;
}

export const SHAPES: Shape[] = [
  { code: "DROP_IN", name: "Drop-in", sets: "Open entry: people come as they are, with no registration and no questions." },
  { code: "CLASS", name: "Class", sets: "Open entry, meeting weekly, with no registration." },
  { code: "COURSE", name: "Course", sets: "Registration for the whole series, meeting weekly, the teacher’s two questions, dana invited, a reminder 2 days before." },
  { code: "WORKSHOP", name: "Workshop", sets: "Registration, the teacher’s two questions, dana invited, a reminder 2 days before." },
  { code: "DAY_OF_MINDFULNESS", name: "Day of mindfulness", sets: "Registration, in person, questions about arriving and dietary needs, dana invited, a reminder 2 days before." },
  { code: "RETREAT", name: "Retreat", sets: "Registration, in person, the teacher’s two questions and questions about arriving and dietary needs, dana invited, a reminder 2 days before." },
];

export function isShapeCode(code: unknown): code is ShapeCode {
  return typeof code === "string" && SHAPES.some((s) => s.code === code);
}

interface Question {
  askedBy?: string;
  label: string;
  fieldType: "shortText" | "longText" | "yesNo" | "select";
  required: boolean;
  options: string[];
}

/** The teams a shape may tick: the teams that prepare (Helping with). */
export interface ShapeTeams {
  prepTeams: { id: string; slug: string; name: string }[];
  /** May choose who asks and which teams prepare (the registration roles,
   *  canUseRegistration): without it every question is the registration
   *  team's and no team prepares, as the save route requires. */
  canDecideAskers: boolean;
}

/** The starting settings, as the editor's initial values. */
export interface ShapeStart {
  offeringFormat: ShapeCode;
  openEntry: boolean;
  registrationEnabled: boolean;
  programFormat?: string;
  recurrenceFreq?: string;
  recurrenceInterval?: string;
  registrationFields: Question[];
  reminderDaysBefore: string;
  danaMode: string;
  followUpEnabled: boolean;
  coverageHubSlugs: string[];
  helperTeams: { hubId: string; canReach: boolean }[];
}

const practice: Question = {
  askedBy: "teacher",
  label: "Have you practiced meditation before?",
  fieldType: "select",
  required: true,
  options: ["New to it", "Some", "Regular practice"],
};
const toKnow: Question = {
  askedBy: "teacher",
  label: "Is there anything I should know before we sit together?",
  fieldType: "longText",
  required: false,
  options: [],
};
const arriving: Question = {
  label: "Would anything make arriving easier? The stairs, a chair, a quiet arrival.",
  fieldType: "shortText",
  required: false,
  options: [],
};
const meals: Question = {
  label: "Any dietary needs?",
  fieldType: "select",
  required: true,
  options: ["No special needs", "Vegetarian", "Vegan", "Gluten-free"],
};
const allergy: Question = {
  label: "Any food allergy we should know about?",
  fieldType: "shortText",
  required: false,
  options: [],
};

export function shapeStart(code: ShapeCode, teams: ShapeTeams): ShapeStart {
  const start = fill(code, teams);
  if (teams.canDecideAskers) return start;
  return {
    ...start,
    helperTeams: [],
    registrationFields: start.registrationFields.map((q) => {
      const { askedBy: _drop, ...rest } = q;
      void _drop;
      return rest;
    }),
  };
}

function fill(code: ShapeCode, teams: ShapeTeams): ShapeStart {
  const base: ShapeStart = {
    offeringFormat: code,
    openEntry: false,
    registrationEnabled: true,
    registrationFields: [],
    reminderDaysBefore: "2",
    danaMode: "voluntary",
    followUpEnabled: false,
    coverageHubSlugs: [],
    helperTeams: [],
  };
  // A team that prepares meals, if one has Helping with.
  const kitchen = teams.prepTeams.find((t) => /kitchen|meal/i.test(`${t.slug} ${t.name}`));
  const by = (q: Question, teamId: string | undefined): Question => {
    if (teamId) return { ...q, askedBy: `team:${teamId}` };
    const { askedBy: _drop, ...rest } = q;
    void _drop;
    return rest;
  };

  switch (code) {
    case "DROP_IN":
      return { ...base, openEntry: true, registrationEnabled: false, reminderDaysBefore: "", danaMode: "none" };
    case "CLASS":
      return { ...base, openEntry: true, registrationEnabled: false, reminderDaysBefore: "", danaMode: "none", recurrenceFreq: "WEEKLY", recurrenceInterval: "1" };
    case "COURSE":
      return { ...base, recurrenceFreq: "WEEKLY", recurrenceInterval: "1", registrationFields: [practice, toKnow] };
    case "WORKSHOP":
      return { ...base, registrationFields: [practice, toKnow] };
    case "DAY_OF_MINDFULNESS":
      return {
        ...base,
        programFormat: "in-person",
        registrationFields: [arriving, by(meals, kitchen?.id), by(allergy, kitchen?.id)],
        helperTeams: kitchen ? [{ hubId: kitchen.id, canReach: false }] : [],
      };
    case "RETREAT":
      return {
        ...base,
        programFormat: "in-person",
        registrationFields: [practice, toKnow, arriving, by(meals, kitchen?.id), by(allergy, kitchen?.id)],
        helperTeams: kitchen ? [{ hubId: kitchen.id, canReach: false }] : [],
      };
  }
}
