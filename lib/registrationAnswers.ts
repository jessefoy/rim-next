/**
 * Answers to a program's questions, by the question's id (2026-10-24, Phase
 * 3 slice 1). Until now `Registration.customFields` stored each answer under
 * the question's wording, so rewording a question cut it off from its
 * answers. New answers are stored under the question's id (`_key`, given by
 * lib/registrationFields.ts on save); a question saved before ids existed has
 * none, and keeps its wording as its key until the program is next saved.
 *
 * Each answer stored by id also keeps the question's wording at the time, in
 * the reserved `_labels` entry ({ id: wording }), so an answer to a question
 * later removed still shows under its words, never a raw id.
 *
 * Old answers are never rewritten: an answer stored by wording is still read
 * (`answerFor` tries the id, then the wording). Saving writes only answers
 * that actually changed, merged over what's stored. Answers that match no
 * current question (removed or reworded) stay, shown under their wording.
 *
 * Pure, no imports: used by the public form, the update page, the routes,
 * the Registration app and the spreadsheet.
 */

export interface QuestionLike {
  _key?: string;
  label: string;
}

type Answers = Record<string, unknown>;

/** The reserved entry holding each id's wording. Never an answer. */
export const LABELS_KEY = "_labels";

function asAnswers(value: unknown): Answers {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Answers) : {};
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function labelsOf(a: Answers): Record<string, string> {
  const l = a[LABELS_KEY];
  return l && typeof l === "object" && !Array.isArray(l) ? (l as Record<string, string>) : {};
}

/** Where a question's answer is stored: its id, or its wording when it has none. */
export function questionKey(q: QuestionLike): string {
  return q._key && q._key.trim() ? q._key : q.label;
}

/** The answer to a question: stored by its id, or (older) by its wording. */
export function answerFor(stored: unknown, q: QuestionLike): string {
  const a = asAnswers(stored);
  const key = questionKey(q);
  if (key in a && key !== LABELS_KEY) return text(a[key]);
  return text(a[q.label]);
}

/** Whether they answered it at all (an empty answer they cleared counts). */
export function hasAnswer(stored: unknown, q: QuestionLike): boolean {
  const a = asAnswers(stored);
  return questionKey(q) in a || q.label in a;
}

/** Stored answers that belong to no current question: their stored key, the
 *  wording to show (the question's words when it was answered), and the value. */
export function oldAnswers(stored: unknown, questions: QuestionLike[]): { key: string; label: string; value: string }[] {
  const a = asAnswers(stored);
  const labels = labelsOf(a);
  const known = new Set<string>([LABELS_KEY]);
  for (const q of questions) {
    known.add(questionKey(q));
    known.add(q.label);
  }
  return Object.entries(a)
    .filter(([k]) => !known.has(k))
    .map(([key, value]) => ({ key, label: labels[key] || (key.startsWith("q_") ? "An earlier question" : key), value: text(value) }));
}

/**
 * A new registration's answers: only the program's questions, each under its
 * id (with its wording in `_labels`). The form sends them by id; an older
 * form (or one left open across a save) may send them by wording, which is
 * accepted too. Empty answers are left out, as before.
 */
export function answersForNewRegistration(incoming: unknown, questions: QuestionLike[]): Answers | null {
  const a = asAnswers(incoming);
  const out: Answers = {};
  const labels: Record<string, string> = {};
  for (const q of questions) {
    const key = questionKey(q);
    const raw = key in a ? a[key] : a[q.label];
    const value = text(raw).trim();
    if (!value) continue;
    out[key] = value;
    if (key !== q.label) labels[key] = q.label;
  }
  if (Object.keys(out).length === 0) return null;
  if (Object.keys(labels).length > 0) out[LABELS_KEY] = labels;
  return out;
}

/**
 * Changed answers merged over the stored ones. Only an answer whose value
 * actually changed is written: under the question's id (with its wording in
 * `_labels`), while an old answer stored by wording stays as it was (the id
 * now wins when reading). An old answer that matches no current question may
 * be changed under its own key. Nothing else is added, so saving with nothing
 * changed returns the stored answers exactly.
 */
export function mergeAnswers(stored: unknown, incoming: unknown, questions: QuestionLike[]): Answers {
  const before = asAnswers(stored);
  const a = asAnswers(incoming);
  const out: Answers = { ...before };
  const labels = { ...labelsOf(before) };
  let labelsChanged = false;
  for (const q of questions) {
    const key = questionKey(q);
    const given = key in a ? a[key] : q.label in a ? a[q.label] : undefined;
    if (given === undefined) continue;
    const value = text(given).trim();
    if (value === answerFor(before, q).trim()) continue;
    out[key] = value;
    if (key !== q.label && labels[key] !== q.label) {
      labels[key] = q.label;
      labelsChanged = true;
    }
  }
  for (const { key } of oldAnswers(before, questions)) {
    if (!(key in a)) continue;
    const value = text(a[key]).trim();
    if (value !== text(before[key]).trim()) out[key] = value;
  }
  if (labelsChanged) out[LABELS_KEY] = labels;
  return out;
}
