import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { accountForFormerEmail } from "@/lib/formerEmail";
import { MESSAGE_MAX_PEOPLE } from "@/lib/programUpdate";
import type { SaveActor, SaveReply } from "@/lib/programSave";
import { canUseRegistration } from "@/lib/toolAuth";
import { countPlacesTaken } from "@/lib/registrationPlaces";
import { recordContentChange, type ChangedPart } from "@/lib/contentChanges";
import { findProgram } from "@/lib/guideData";
import {
  addPerson,
  addRegistrationNote,
  changeRegistration,
  deleteRegistration,
  messagePeople,
  saveRegistrationSettings,
  sendReminderNow,
} from "@/lib/registrationActions";

/**
 * The Registration app's actions through the RIM Guide (2026-10-28, phase 2):
 * for people who may open Registration on the site (canUseRegistration), each
 * through the app's own step (lib/registrationActions.ts), so the same emails
 * go and the same History line is written, under their name.
 *
 * Ask first (Jesse: "we should definitely warn if it's going to send out
 * emails to people"): an action that would email anyone does nothing on its
 * first call. It says who would be emailed and what, with a signed slip
 * (confirmOrAsk) for this person, this tool, these details and exactly that
 * description, good for 15 minutes. Only the second call that hands the slip
 * back goes ahead, and only if the description, worked out again, is still the
 * same: if the last place filled or the address changed meanwhile, it asks
 * again (review, 2026-10-28: `confirm: true` could be sent on a first call).
 */

type Actor = SaveActor & { name: string };

const NOT_ALLOWED = "Registration is for the registrar, admins and the guiding teacher on the site, so the guide can't do this for you.";

const SLIP_MS = 15 * 60 * 1000;

function slipKey(): Buffer | null {
  const secret = process.env.AUTH_SECRET;
  return secret ? createHmac("sha256", secret).update("rim-guide-confirm-v1").digest() : null;
}

/** The details as given, in a fixed order, without the slip itself. */
function canon(inputs: Record<string, unknown>): string {
  const sorted = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])])) : v;
  const { confirm: _c, ...rest } = inputs;
  void _c;
  return JSON.stringify(sorted(rest));
}

function sign(key: Buffer, parts: unknown[]): string {
  return createHmac("sha256", key).update(JSON.stringify(parts)).digest("base64url");
}

/**
 * The ask-first rule. Null: the slip given matches this person, tool, these
 * details and this exact description, and is fresh, so go ahead. Otherwise the
 * words to show the person, with a new slip for their yes.
 */
export function confirmOrAsk(actorId: string, tool: string, inputs: Record<string, unknown>, what: string[], given?: string): string | null {
  const key = slipKey();
  if (!key) return "Nothing was done: the guide's confirmations aren't set up (AUTH_SECRET). Tell Jesse.";
  const parts = (exp: number) => [actorId, tool, canon(inputs), what, exp];
  if (given) {
    const [expRaw, sig] = given.split(".");
    const exp = Number(expRaw);
    if (Number.isFinite(exp) && exp > Date.now() && sig) {
      const a = Buffer.from(sig);
      const b = Buffer.from(sign(key, parts(exp)));
      if (a.length === b.length && timingSafeEqual(a, b)) return null;
    }
  }
  const exp = Date.now() + SLIP_MS;
  return [
    `Nothing has been done yet.${given ? " (The yes given no longer matches: something changed, or it was more than 15 minutes ago. Here is what would happen now.)" : ""} ${what.join(" ")}`,
    `Tell them exactly this and ask whether to go ahead. Only after a clear yes, call the same tool again with the same details and confirm: "${exp}.${sign(key, parts(exp))}".`,
  ].join("\n");
}

const said = (r: SaveReply, fallback: string) => (typeof r.body.error === "string" ? r.body.error : fallback);

async function keep(actor: Actor, program: { slug: string; name: string }, parts: ChangedPart[]): Promise<string> {
  try {
    await recordContentChange({
      userId: actor.id,
      userName: actor.name,
      kind: "registration",
      itemKey: program.slug,
      itemLabel: program.name,
      itemHref: `/tools/registration/${program.slug}`,
      changes: parts,
    });
    return " It's in the program's History, and Jesse has been sent the change.";
  } catch (e) {
    console.error("[guideRegistration] recording a change failed", e);
    return " It's in the program's History. Its record for Jesse didn't save, so tell him what changed.";
  }
}

async function theProgram(raw: string) {
  const found = await findProgram(raw);
  if (typeof found === "string") return found;
  const p = await db.program.findUnique({
    where: { slug: found.slug },
    select: { id: true, slug: true, name: true, updatedAt: true, archivedAt: true, registrationEnabled: true, registrationCapacity: true, danaMode: true, danaFixedAmount: true, danaBaseAmount: true },
  });
  return p ?? "That program isn't there any more.";
}

const STATUS_WORDS: Record<string, string> = {
  REGISTERED: "registered",
  APPROVED: "registered",
  WAITLISTED: "on the waiting list",
  CANCELLED: "cancelled",
  PENDING_PAYMENT: "holding a place while paying online",
};

/** One person's registration in this program, by name or email: the one match, or what to say. */
async function thePerson(programId: string, raw: string) {
  const q = raw.trim();
  if (q.length < 2) return "Who? Give their name or email.";
  const select = { id: true, firstName: true, lastName: true, email: true, status: true, donationStatus: true } as const;
  const byEmail = await db.registration.findMany({ where: { programId, email: { equals: q, mode: "insensitive" } }, select });
  if (byEmail.length === 1) return byEmail[0];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const near = await db.registration.findMany({
    where: {
      programId,
      AND: words.map((w) => ({ OR: [{ firstName: { contains: w, mode: "insensitive" as const } }, { lastName: { contains: w, mode: "insensitive" as const } }] })),
    },
    select,
    take: 8,
  });
  // Only whole names count (review, 2026-10-28: "Lee" picked Ashlee): every
  // word given is their first or last name.
  const whole = near.filter((p) => words.every((w) => [p.firstName, p.lastName].some((n) => (n ?? "").toLowerCase() === w)));
  const list = (xs: typeof near) => xs.map((p) => `- ${p.firstName} ${p.lastName} (${STATUS_WORDS[p.status] ?? p.status})`).join("\n");
  if (whole.length === 1) return whole[0];
  if (whole.length > 1) return `More than one person matches "${q}":\n${list(whole)}\nAsk again with the full name or their email.`;
  if (near.length) return `No one is called exactly "${q}". Did they mean:\n${list(near)}\nAsk again with the full name or their email.`;
  return `No one called "${q}" is in this program's registrations.`;
}

const nameOf = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();

// ─── Add someone ────────────────────────────────────────────────────────────

export async function registrationAdd(
  actor: Actor,
  input: { program: string; firstName: string; lastName: string; email: string; phone?: string; dana?: string; sendConfirmation?: boolean; answers?: Record<string, unknown>; confirm?: string },
): Promise<string> {
  if (!canUseRegistration(actor.roles)) return NOT_ALLOWED;
  const program = await theProgram(input.program);
  if (typeof program === "string") return program;
  if (program.archivedAt || !program.registrationEnabled) return "This program isn't taking registrations (it's archived, or registration is off in the editor).";
  const name = `${input.firstName} ${input.lastName}`.trim();
  const hasPlace = program.registrationCapacity == null || (await countPlacesTaken(program.id)) < program.registrationCapacity;
  const requiresPayment =
    (program.danaMode === "fixed" && (program.danaFixedAmount ?? 0) > 0) ||
    (program.danaMode === "base_plus_dana" && (program.danaBaseAmount ?? 0) > 0);
  const asksDana = program.danaMode === "voluntary" || requiresPayment;
  if (hasPlace && asksDana && !["given", "none", "online"].includes(input.dana ?? "")) {
    return `Ask how ${input.firstName || "they"} will give dana: given another way (cash or check), no dana, or online (they're emailed the link).`;
  }
  // Where the email goes: an existing account's address, or the account an
  // old address now belongs to (as addPerson links them), else what was typed.
  const typed = input.email.trim().toLowerCase();
  const account = (await db.user.findUnique({ where: { email: typed }, select: { email: true } })) ?? (await accountForFormerEmail(typed));
  const sendTo = account && "email" in account && account.email ? account.email : typed;
  input = { ...input, email: typed };
  // What the app's step will send (lib/registrationActions.ts addPerson).
  const emails: string[] = [];
  if (hasPlace && asksDana && input.dana === "online") emails.push(`This will register ${name} and email them (${sendTo}) the link to give dana online; their confirmation follows when they give.`);
  else if (input.sendConfirmation !== false) {
    emails.push(hasPlace
      ? `This will register ${name} and email them (${sendTo}) their confirmation; the registrar's inbox is told too.`
      : `The program is full, so this will put ${name} on the waiting list and email them (${sendTo}) to say so; the registrar's inbox is told too.`);
  }
  const ask = emails.length ? confirmOrAsk(actor.id, "registration_add", input, emails, input.confirm) : null;
  if (ask) return ask;

  const r = await addPerson(actor, program.slug, {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    dana: input.dana,
    sendConfirmation: input.sendConfirmation !== false,
    expectPlace: hasPlace,
    customFields: input.answers,
  });
  if (r.status !== 200) return `Nothing was done. ${said(r, "It couldn't be saved.")}`;
  const where = r.body.status === "WAITLISTED" ? "on the waiting list" : "registered";
  const kept = await keep(actor, program, [{ label: `Added ${r.body.name as string}`, before: null, after: `${where}${emails.length ? ", emailed" : ", not emailed"}` }]);
  return `${r.body.name as string} is ${where} for ${program.name}.${emails.length ? " Their email is on its way." : " No email went to them."}${kept}`;
}

// ─── Change someone's registration ──────────────────────────────────────────

export const CHANGES = [
  "move_off_waiting_list", "cancel", "restore", "dana_given", "dana_none",
  "resend_confirmation", "send_dana_link", "send_edit_link", "send_reminder", "answers",
] as const;
type Change = (typeof CHANGES)[number];

export async function registrationChange(
  actor: Actor,
  input: { program: string; person: string; change: string; emailThem?: boolean; answers?: Record<string, unknown>; confirm?: string },
): Promise<string> {
  if (!canUseRegistration(actor.roles)) return NOT_ALLOWED;
  if (!(CHANGES as readonly string[]).includes(input.change)) return `Choose one change: ${CHANGES.join(", ")}.`;
  const change = input.change as Change;
  const program = await theProgram(input.program);
  if (typeof program === "string") return program;
  const p = await thePerson(program.id, input.person);
  if (typeof p === "string") return p;
  const who = nameOf(p);
  const placed = p.status === "REGISTERED" || p.status === "APPROVED";
  const emailThem = input.emailThem !== false;

  // The app's request for this change, and what it will email (registrationActions changeRegistration).
  let body: Record<string, unknown>;
  let emails: string[] = [];
  let after = "";
  switch (change) {
    case "move_off_waiting_list":
      if (p.status !== "WAITLISTED") return `${who} isn't on the waiting list (they're ${STATUS_WORDS[p.status] ?? p.status}).`;
      body = { status: "REGISTERED" };
      emails = [`This will give ${who} a place and email them (${p.email}) to say so, with how to give dana if the program asks for it.`];
      after = "registered";
      break;
    case "cancel":
      if (p.status === "CANCELLED") return `${who} is already cancelled.`;
      body = { status: "CANCELLED", notifyPerson: emailThem };
      emails = [`This will cancel ${who}'s place. ${emailThem ? `They'll be emailed (${p.email}) to say so, and` : "They won't be emailed;"} the registrar's inbox is told.`];
      after = "cancelled";
      break;
    case "restore":
      if (p.status !== "CANCELLED") return `${who} isn't cancelled.`;
      body = { status: "REGISTERED" };
      // Their dana still open: a day later the cleanup marks it no dana and
      // sends their confirmation (review, 2026-10-28).
      if (p.donationStatus === "PENDING") emails = [`This will give ${who} their place back. Their dana is still open, so if they haven't given within a day, it's marked no dana and their confirmation is emailed to them (${p.email}).`];
      after = "registered again";
      break;
    case "dana_given":
    case "dana_none":
      if (p.donationStatus !== "PENDING") return `${who}'s dana isn't open (it's already settled), so there's nothing to settle.`;
      body = { donationStatus: change === "dana_given" ? "COMPLETED" : "WAIVED" };
      if (placed) emails = [`This will mark ${who}'s dana as ${change === "dana_given" ? "given another way" : "no dana"}, and send the confirmation they've been waiting for (${p.email}); the registrar's inbox is told too.`];
      after = change === "dana_given" ? "dana given another way" : "no dana";
      break;
    case "resend_confirmation":
      if (p.status === "CANCELLED") return `${who} is cancelled, so there's no confirmation to send.`;
      if (p.status === "PENDING_PAYMENT") return `${who} is paying online right now; their confirmation comes when that finishes.`;
      if (p.donationStatus === "PENDING" && placed) return `${who}'s dana is still open, so their confirmation is held until it's settled (as in the app).`;
      body = { action: "resendConfirmation" };
      emails = [`This will email ${who} (${p.email}) their ${p.status === "WAITLISTED" ? "waiting-list email" : "confirmation"} again.`];
      after = "confirmation sent again";
      break;
    case "send_dana_link":
      if (p.donationStatus !== "PENDING") return `${who}'s dana isn't open, so there's no link to send.`;
      body = { action: "sendDanaReminder" };
      emails = [`This will email ${who} (${p.email}) the link to give dana online.`];
      after = "dana link sent";
      break;
    case "send_edit_link":
      if (p.status === "CANCELLED") return `${who} is cancelled.`;
      body = { action: "sendEditRequest" };
      emails = [`This will email ${who} (${p.email}) a link to change their answers, good for a week.`];
      after = "edit link sent";
      break;
    case "send_reminder":
      if (p.status === "CANCELLED") return `${who} is cancelled.`;
      body = { action: "sendReminder" };
      emails = [`This will email ${who} (${p.email}) the program's reminder now.`];
      after = "reminder sent";
      break;
    case "answers":
      if (!input.answers || typeof input.answers !== "object") return "Give their answers by each question's wording, as program_people shows them.";
      body = { customFields: input.answers };
      after = "answers changed";
      break;
  }
  const ask = emails.length ? confirmOrAsk(actor.id, "registration_change", input, emails, input.confirm) : null;
  if (ask) return ask;

  const r = await changeRegistration(actor, p.id, body);
  if (r.status !== 200) return `Nothing was done. ${said(r, "It couldn't be saved.")}`;
  const kept = await keep(actor, program, [{ label: who, before: STATUS_WORDS[p.status] ?? p.status, after }]);
  return `Done: ${who}, ${after}.${emails.length ? " The email is on its way." : ""}${kept}`;
}

/** Remove a cancelled registration for good, as the app's Delete does (its history stays). */
export async function registrationRemove(actor: Actor, input: { program: string; person: string; confirm?: string }): Promise<string> {
  if (!canUseRegistration(actor.roles)) return NOT_ALLOWED;
  const program = await theProgram(input.program);
  if (typeof program === "string") return program;
  const p = await thePerson(program.id, input.person);
  if (typeof p === "string") return p;
  if (p.status !== "CANCELLED") return `Only a cancelled registration can be removed; ${nameOf(p)} is ${STATUS_WORDS[p.status] ?? p.status}. Cancel it first.`;
  // Can't be undone: asked first too, though it emails no one.
  const ask = confirmOrAsk(actor.id, "registration_remove", input, [`This will remove ${nameOf(p)}'s cancelled registration for good, with its notes; it can't be undone. Its History stays. No one is emailed.`], input.confirm);
  if (ask) return ask;
  const r = await deleteRegistration(actor, p.id);
  if (r.status !== 200) return `Nothing was done. ${said(r, "It couldn't be removed.")}`;
  const kept = await keep(actor, program, [{ label: nameOf(p), before: "cancelled", after: "removed" }]);
  return `Removed ${nameOf(p)}'s cancelled registration.${kept}`;
}

/** Add a note to someone's registration. Emails no one. */
export async function registrationNote(actor: Actor, input: { program: string; person: string; note: string }): Promise<string> {
  if (!canUseRegistration(actor.roles)) return NOT_ALLOWED;
  const program = await theProgram(input.program);
  if (typeof program === "string") return program;
  const p = await thePerson(program.id, input.person);
  if (typeof p === "string") return p;
  const r = await addRegistrationNote(actor, p.id, { body: input.note });
  if (r.status !== 200) return `Nothing was saved. ${said(r, "The note couldn't be saved.")}`;
  const kept = await keep(actor, program, [{ label: `A note on ${nameOf(p)}`, before: null, after: input.note.trim() }]);
  return `Added the note to ${nameOf(p)}'s registration.${kept}`;
}

// ─── Messages and the reminder ──────────────────────────────────────────────

export async function registrationMessage(
  actor: Actor,
  input: { program: string; to?: string; subject: string; message: string; test?: boolean; confirm?: string },
): Promise<string> {
  if (!canUseRegistration(actor.roles)) return NOT_ALLOWED;
  const program = await theProgram(input.program);
  if (typeof program === "string") return program;
  const to = input.to === "waiting" || input.to === "both" ? input.to : "registered";
  if (input.test === true) {
    // A test copy goes only to the person writing.
    const r = await messagePeople(actor, program.slug, { to, subject: input.subject, message: input.message, test: true });
    return r.status === 200 ? `A test copy went to you (${r.body.email as string}). Nothing went to anyone else.` : `Nothing was sent. ${said(r, "It couldn't be sent.")}`;
  }
  const statuses = to === "registered" ? ["REGISTERED", "APPROVED"] : to === "waiting" ? ["WAITLISTED"] : ["REGISTERED", "APPROVED", "WAITLISTED"];
  // Counted as messagePeople sends: by the program's address, one email per address.
  const rows = await db.registration.findMany({ where: { programSlug: program.slug, status: { in: statuses as ("REGISTERED" | "APPROVED" | "WAITLISTED")[] } }, select: { email: true } });
  const count = new Set(rows.map((r) => r.email.trim().toLowerCase())).size;
  if (count === 0) return "No one is in that group, so there's no one to message.";
  if (count > MESSAGE_MAX_PEOPLE) return `That's ${count} people, more than ${MESSAGE_MAX_PEOPLE} can be sent here. The program's Flodesk segment is for a group this size.`;
  const group = to === "registered" ? "registered" : to === "waiting" ? "on the waiting list" : "registered or on the waiting list";
  {
    const ask = confirmOrAsk(actor.id, "message_people", input, [
      `This will email ${count} ${count === 1 ? "person" : "people"} ${group} for ${program.name}, one email each, with replies going to the registrar's inbox:`,
      `\nSubject: ${input.subject.trim()}\nMessage:\n${input.message.trim()}\n`,
      "A test copy to themselves first is offered with test: true.",
    ], input.confirm);
    if (ask) return ask;
  }
  const r = await messagePeople(actor, program.slug, { to, subject: input.subject, message: input.message });
  if (r.status !== 200) return `Nothing was sent. ${said(r, "It couldn't be sent.")}`;
  const kept = await keep(actor, program, [{ label: `A message to ${r.body.count as number} people`, before: null, after: `${input.subject.trim()}\n\n${input.message.trim()}` }]);
  return `Sending to ${r.body.count as number} people now, one at a time.${kept}`;
}

export async function registrationReminder(actor: Actor, input: { program: string; confirm?: string }): Promise<string> {
  if (!canUseRegistration(actor.roles)) return NOT_ALLOWED;
  const program = await theProgram(input.program);
  if (typeof program === "string") return program;
  const waiting = await db.registration.count({ where: { programSlug: program.slug, status: { in: ["REGISTERED", "APPROVED"] }, reminderSentAt: null } });
  if (waiting === 0) return "Everyone registered has had the reminder already.";
  const ask = confirmOrAsk(actor.id, "send_reminder", input, [`This will email the program's reminder now to the ${waiting} ${waiting === 1 ? "person" : "people"} registered for ${program.name} who haven't had it.`], input.confirm);
  if (ask) return ask;
  const r = await sendReminderNow(actor, program.slug);
  if (r.status !== 200) return `Nothing was sent. ${said(r, "It couldn't be sent.")}`;
  const kept = await keep(actor, program, [{ label: "The reminder", before: null, after: `sent to ${r.body.sent as number}` }]);
  return `The reminder went to ${r.body.sent as number} ${r.body.sent === 1 ? "person" : "people"}.${kept}`;
}

// ─── Registration settings ──────────────────────────────────────────────────

/** Open, close or schedule registration and set the places, as the app's settings do. Emails no one. */
export async function registrationSettings(
  actor: Actor,
  input: { program: string; state?: string; opensAt?: string; closesAt?: string | null; places?: number | null; mailingList?: string },
): Promise<string> {
  if (!canUseRegistration(actor.roles)) return NOT_ALLOWED;
  const program = await theProgram(input.program);
  if (typeof program === "string") return program;
  const body: Record<string, unknown> = { updatedAt: program.updatedAt.toISOString() };
  const parts: ChangedPart[] = [];
  const when = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (input.state) {
    if (input.state === "open") Object.assign(body, { registrationClosed: false, registrationOpensAt: null });
    else if (input.state === "closed") Object.assign(body, { registrationClosed: true });
    else if (input.state === "not_yet") {
      if (!input.opensAt || !when.test(input.opensAt)) return "Not open yet needs the date and time it opens, as YYYY-MM-DDTHH:MM in Central time.";
      Object.assign(body, { registrationClosed: false, registrationOpensAt: input.opensAt });
    } else return "Registration is open, not_yet (with when it opens) or closed.";
    parts.push({ label: "Registration", before: null, after: input.state === "not_yet" ? `opens ${input.opensAt}` : input.state });
  }
  if (input.closesAt !== undefined) {
    if (input.closesAt !== null && input.closesAt !== "" && !when.test(input.closesAt)) return "The closing date is YYYY-MM-DDTHH:MM in Central time, or empty for none.";
    body.registrationDeadline = input.closesAt || null;
    parts.push({ label: "Closes", before: null, after: input.closesAt || "no closing date" });
  }
  if (input.places !== undefined) {
    body.registrationCapacity = input.places;
    parts.push({ label: "Places", before: program.registrationCapacity, after: input.places ?? "no limit" });
  }
  if (input.mailingList !== undefined) {
    const map: Record<string, boolean | null> = { automatic: null, on: true, off: false };
    if (!(input.mailingList in map)) return "The mailing list is automatic, on or off.";
    body.flodeskSync = map[input.mailingList];
    parts.push({ label: "Mailing list", before: null, after: input.mailingList });
  }
  if (!parts.length) return "Nothing to change: give the state, the closing date, the places or the mailing list.";
  const r = await saveRegistrationSettings(actor, program.slug, body);
  if (r.status !== 200) return `Nothing was saved. ${said(r, "It couldn't be saved.")}`;
  if (r.body.unchanged) return "That's how it is already, so nothing changed.";
  const kept = await keep(actor, program, parts);
  return `Saved for ${program.name}: ${parts.map((p) => `${p.label.toLowerCase()} ${String(p.after)}`).join("; ")}.${kept}`;
}
