"use client";

/**
 * One program's people in the Registration app (2026-10-23): what needs a
 * person, the people (filter, search, each person's card), and the
 * program's history. Every change goes through the same APIs as the
 * Program Manager's roster (/api/registrations/[id], send-reminder), then
 * re-reads the page, so what shows is always what is stored.
 *
 * Anything that emails someone asks first, naming who will get it
 * (2026-10-13). Amounts given show only when the server sent them
 * (canSeeDanaAmounts). CSS: reg- plus the roster's vol- table and buttons.
 */

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionNotice, useActionNotice } from "@/components/FormDone";
import { FilterPills, SectionTabs } from "@/components/FilterBar";
import type { RegistrationField } from "@/components/RegistrationForm";
import type { DeskNeed } from "@/lib/registrationDesk";

export interface PeopleRow {
  id: string;
  name: string;
  firstName: string;
  email: string;
  phone: string | null;
  status: string;
  waitlistPosition: number | null;
  donationStatus: string;
  /** Null unless this viewer may see amounts. */
  donationCents: number | null;
  answers: { label: string; value: string }[];
  /** The labels they actually answered (stored), as against questions shown empty. */
  answered: string[];
  earlierNote: string | null;
  notes: { id: string; body: string; authorName: string; when: string }[];
  reminderSentOn: string | null;
  registeredOn: string;
}

export interface HistoryRow {
  id: string;
  at: string;
  when: string;
  registrationId: string | null;
  person: string | null;
  text: string;
}

type Filter = "all" | "registered" | "waiting" | "dana" | "cancelled";
type Tab = "people" | "history";
type Confirm =
  | "offer" | "cancel" | "restore" | "delete" | "dana-reminder" | "dana-received" | "dana-none"
  | "edit-link" | "reminder" | "resend";

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: "Registered",
  APPROVED: "Registered",
  WAITLISTED: "Waiting",
  CANCELLED: "Cancelled",
};

const DANA_LABELS: Record<string, string> = {
  NOT_REQUIRED: "Not asked",
  PENDING: "Not finished",
  COMPLETED: "Received",
  WAIVED: "No dana",
};

const isRegistered = (s: string) => s === "REGISTERED" || s === "APPROVED";

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);

/** The day the Registration app began keeping history. */
const HISTORY_SINCE = "Oct 23, 2026";

function ConfirmBox({
  text,
  yes,
  busy,
  onYes,
  onNo,
}: {
  text: string;
  yes: string;
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="reg-confirm" role="group" aria-label="Confirm">
      <p className="reg-confirm__text">{text}</p>
      <div className="reg-actions">
        <button type="button" className="vol-save-btn" disabled={busy} onClick={onYes}>
          {busy ? "Working…" : yes}
        </button>
        <button type="button" className="vol-action-btn" onClick={onNo}>
          Never mind
        </button>
      </div>
    </div>
  );
}

export default function RegistrationPeople({
  programSlug,
  people: rows,
  history,
  needs,
  registrationFields,
  danaMode,
  reminderDay,
  seeAmounts,
  initialShow,
}: {
  programSlug: string;
  people: PeopleRow[];
  history: HistoryRow[];
  needs: DeskNeed[];
  registrationFields: RegistrationField[];
  danaMode: string | null;
  reminderDay: string | null;
  seeAmounts: boolean;
  initialShow: string | null;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const { notice, say } = useActionNotice();

  const startFilter: Filter =
    initialShow === "waiting" || initialShow === "dana" || initialShow === "registered" || initialShow === "cancelled"
      ? initialShow
      : "all";
  const [tab, setTab] = useState<Tab>("people");
  const [filter, setFilter] = useState<Filter>(startFilter);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: Confirm } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; values: Record<string, string> } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const refresh = () => startRefresh(() => router.refresh());

  const danaShown = rows.some((r) => r.donationStatus !== "NOT_REQUIRED");
  const count = (f: Filter) => rows.filter((r) => matches(r, f)).length;
  function matches(r: PeopleRow, f: Filter): boolean {
    switch (f) {
      case "all": return true;
      case "registered": return isRegistered(r.status);
      case "waiting": return r.status === "WAITLISTED";
      case "dana": return r.donationStatus === "PENDING" && isRegistered(r.status);
      case "cancelled": return r.status === "CANCELLED";
    }
  }
  const q = search.trim().toLowerCase();
  const visible = rows
    .filter((r) => matches(r, filter))
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
    // Cancelled people sink to the bottom of "All".
    .sort((a, b) => Number(a.status === "CANCELLED") - Number(b.status === "CANCELLED"));
  const unsent = rows.filter((r) => isRegistered(r.status) && !r.reminderSentOn);

  // ── Calls ─────────────────────────────────────────────────────────────────
  async function patch(id: string, body: Record<string, unknown>, ok: string, fail: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      say(ok);
      setConfirm(null);
      refresh();
      return true;
    } catch {
      say(fail, "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: PeopleRow) {
    setBusy(p.id);
    try {
      const res = await fetch(`/api/registrations/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      say(`${p.name}'s record is deleted.`);
      setConfirm(null);
      setOpenId(null);
      refresh();
    } catch {
      say("The record wasn't deleted. Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function sendReminderToUnsent() {
    setBusy("bulk");
    try {
      const res = await fetch(`/api/programs/${programSlug}/send-reminder`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      say(`The reminder went to ${people(json.sent ?? 0)}.`);
      setBulkConfirm(false);
      refresh();
    } catch {
      say("The reminder wasn't sent. Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function addNote(p: PeopleRow) {
    const body = (drafts[p.id] ?? "").trim();
    if (!body) {
      say("Write the note first.", "error");
      return;
    }
    setBusy(`note-${p.id}`);
    try {
      const res = await fetch(`/api/registrations/${p.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "");
      setDrafts((d) => ({ ...d, [p.id]: "" }));
      say("Note added.");
      refresh();
    } catch (err) {
      say(err instanceof Error && err.message ? err.message : "The note wasn't saved. Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function saveAnswers(p: PeopleRow) {
    if (!editing || editing.id !== p.id) return;
    const values = Object.fromEntries(
      Object.entries(editing.values).filter(([label, v]) => v !== "" || p.answered.includes(label)),
    );
    const ok = await patch(p.id, { customFields: values }, "Their answers are saved.", "Their answers weren't saved. Please try again.");
    if (ok) setEditing(null);
  }

  function showFilter(f: Filter) {
    setTab("people");
    setFilter(f);
    setOpenId(null);
  }

  // ── Pieces ────────────────────────────────────────────────────────────────
  const ask = (p: PeopleRow, kind: Confirm, label: string, className = "vol-action-btn") =>
    confirm?.id === p.id && confirm.kind === kind ? null : (
      <button type="button" className={className} disabled={busy === p.id} onClick={() => setConfirm({ id: p.id, kind })}>
        {label}
      </button>
    );
  const confirmFor = (p: PeopleRow, kind: Confirm, text: string, yes: string, onYes: () => void) =>
    confirm?.id === p.id && confirm.kind === kind ? (
      <ConfirmBox text={text} yes={yes} busy={busy === p.id} onYes={onYes} onNo={() => setConfirm(null)} />
    ) : null;

  function answerInput(label: string, value: string, onChange: (v: string) => void, id: string) {
    const def = registrationFields.find((f) => f.label === label);
    if (def?.fieldType === "longText") {
      return <textarea id={id} className="vol-field-edit__input vol-field-edit__textarea" value={value} onChange={(e) => onChange(e.target.value)} />;
    }
    const options = def?.fieldType === "yesNo" ? ["Yes", "No"] : def?.fieldType === "select" ? def.options ?? [] : null;
    if (options && options.length) {
      return (
        <select id={id} className="vol-field-edit__select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Not answered</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
          {value && !options.includes(value) && <option value={value}>{value}</option>}
        </select>
      );
    }
    return <input id={id} className="vol-field-edit__input" value={value} onChange={(e) => onChange(e.target.value)} />;
  }

  function personCard(p: PeopleRow) {
    const mine = history.filter((h) => h.registrationId === p.id);
    const active = p.status !== "CANCELLED";
    return (
      <div className="reg-person">
        <section className="reg-person__part" aria-label="Contact">
          <h3 className="reg-person__title">Contact</h3>
          <a href={`mailto:${p.email}`} className="reg-link">{p.email}</a>
          {p.phone && <a href={`tel:${p.phone}`} className="reg-link">{formatPhone(p.phone)}</a>}
          <p className="reg-meta">Registered {p.registeredOn}</p>
        </section>

        <section className="reg-person__part" aria-label="Their place">
          <h3 className="reg-person__title">Their place</h3>
          <p className="reg-person__status">
            {STATUS_LABELS[p.status] ?? p.status}
            {p.status === "WAITLISTED" && p.waitlistPosition ? `, number ${p.waitlistPosition} in line` : ""}
          </p>
          <div className="reg-actions">
            {p.status === "WAITLISTED" && ask(p, "offer", "Offer them a place", "vol-save-btn")}
            {confirmFor(p, "offer", `Move ${p.name} from waiting to registered? This emails ${p.firstName} at ${p.email} to say their place is confirmed.`, "Yes, register and email them",
              () => patch(p.id, { status: "REGISTERED", danaMode: danaMode ?? "none" }, `${p.name} is registered. ${p.firstName} will get an email saying their place is confirmed.`, "They weren't moved. Please try again."))}

            {isRegistered(p.status) && ask(p, "resend", "Send the confirmation again")}
            {confirmFor(p, "resend", `Email the confirmation to ${p.firstName} at ${p.email} again?`, "Yes, send it",
              () => patch(p.id, { action: "resendConfirmation" }, "The confirmation went out again.", "The confirmation wasn't sent. Please try again."))}

            {isRegistered(p.status) && ask(p, "reminder", p.reminderSentOn ? "Send the reminder again" : "Send the reminder")}
            {confirmFor(p, "reminder", `Email the program's reminder to ${p.firstName} at ${p.email}?`, "Yes, send it",
              () => patch(p.id, { action: "sendReminder" }, "The reminder went out.", "The reminder wasn't sent. Please try again."))}
            {isRegistered(p.status) && p.reminderSentOn && <p className="reg-meta">Reminder sent {p.reminderSentOn}</p>}

            {active && ask(p, "cancel", "Cancel their registration", "vol-action-btn")}
            {confirmFor(p, "cancel", `Cancel ${p.name}'s registration? They won't be emailed.`, "Yes, cancel it",
              () => patch(p.id, { status: "CANCELLED" }, `${p.name}'s registration is cancelled.`, "It wasn't cancelled. Please try again."))}

            {!active && ask(p, "restore", "Restore their registration", "vol-save-btn")}
            {confirmFor(p, "restore", `Restore ${p.name} as registered? They won't be emailed.`, "Yes, restore it",
              () => patch(p.id, { status: "REGISTERED" }, `${p.name} is registered again.`, "It wasn't restored. Please try again."))}

            {!active && ask(p, "delete", "Delete the record", "vol-action-btn vol-action-btn--danger")}
            {confirmFor(p, "delete", `Delete ${p.name}'s record for good? Their answers and notes go with it.`, "Yes, delete it", () => remove(p))}
          </div>
        </section>

        {p.donationStatus !== "NOT_REQUIRED" && (
          <section className="reg-person__part" aria-label="Dana">
            <h3 className="reg-person__title">Dana</h3>
            <p className="reg-person__status">
              {DANA_LABELS[p.donationStatus] ?? p.donationStatus}
              {seeAmounts && p.donationCents ? `, ${dollars(p.donationCents)}` : ""}
            </p>
            {p.donationStatus === "PENDING" && (
              <div className="reg-actions">
                {ask(p, "dana-reminder", "Send a dana reminder", "vol-save-btn")}
                {confirmFor(p, "dana-reminder", `Email a dana reminder to ${p.firstName} at ${p.email}?`, "Yes, send it",
                  () => patch(p.id, { action: "sendDanaReminder" }, "The dana reminder went out.", "The dana reminder wasn't sent. Please try again."))}
                {ask(p, "dana-received", "Given another way")}
                {confirmFor(p, "dana-received", `Mark ${p.name}'s dana as received, given by cash or check? They won't be emailed.`, "Yes, mark it received",
                  () => patch(p.id, { donationStatus: "COMPLETED" }, "Dana marked received.", "It wasn't changed. Please try again."))}
                {ask(p, "dana-none", "No dana for them")}
                {confirmFor(p, "dana-none", `Mark ${p.name} as giving no dana? They won't be emailed.`, "Yes, no dana",
                  () => patch(p.id, { donationStatus: "WAIVED" }, "Marked no dana.", "It wasn't changed. Please try again."))}
              </div>
            )}
          </section>
        )}

        <section className="reg-person__part reg-person__part--wide" aria-label="Their answers">
          <h3 className="reg-person__title">Their answers</h3>
          {p.answers.length === 0 ? (
            <p className="reg-quiet">No answers to the program's questions.</p>
          ) : editing?.id === p.id ? (
            <div className="vol-fields-edit">
              {Object.entries(editing.values).map(([label, value], i) => (
                <div key={label}>
                  <label className="vol-field-edit__label" htmlFor={`ans-${p.id}-${i}`}>{label}</label>
                  {answerInput(label, value, (v) => setEditing((e) => (e ? { ...e, values: { ...e.values, [label]: v } } : e)), `ans-${p.id}-${i}`)}
                </div>
              ))}
              <div className="vol-field-edit__actions">
                <button type="button" className="vol-save-btn" disabled={busy === p.id} onClick={() => saveAnswers(p)}>
                  {busy === p.id ? "Saving…" : "Save their answers"}
                </button>
                <button type="button" className="vol-action-btn" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <dl className="reg-answers">
                {p.answers.map((a) => (
                  <div key={a.label} className="reg-answers__row">
                    <dt>{a.label}</dt>
                    <dd>{a.value || <span className="reg-quiet">Not answered</span>}</dd>
                  </div>
                ))}
              </dl>
              <div className="reg-actions">
                <button type="button" className="vol-action-btn"
                  onClick={() => setEditing({ id: p.id, values: Object.fromEntries(p.answers.map((a) => [a.label, a.value])) })}>
                  Change their answers
                </button>
                {active && ask(p, "edit-link", "Send them a link to change their answers")}
                {confirmFor(p, "edit-link", `Email ${p.firstName} at ${p.email} a link to change their answers? It works for seven days.`, "Yes, send it",
                  () => patch(p.id, { action: "sendEditRequest" }, "The link went out. They can change their answers from the email.", "The link wasn't sent. Please try again."))}
              </div>
            </>
          )}
        </section>

        <section className="reg-person__part reg-person__part--wide" aria-label="Notes">
          <h3 className="reg-person__title">Notes</h3>
          {(p.notes.length > 0 || p.earlierNote) && (
            <ul className="reg-notes">
              {p.earlierNote && (
                <li>
                  <span className="reg-notes__by">An earlier note</span>
                  <p className="reg-notes__body">{p.earlierNote}</p>
                </li>
              )}
              {p.notes.map((n) => (
                <li key={n.id}>
                  <span className="reg-notes__by">{n.authorName} · {n.when}</span>
                  <p className="reg-notes__body">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
          <label className="vol-field-edit__label" htmlFor={`note-${p.id}`}>Add a note for the registration team</label>
          <textarea
            id={`note-${p.id}`}
            className="vol-field-edit__input vol-field-edit__textarea"
            value={drafts[p.id] ?? ""}
            maxLength={4000}
            onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
          />
          <div className="reg-actions">
            <button type="button" className="vol-save-btn" disabled={busy === `note-${p.id}`} onClick={() => addNote(p)}>
              {busy === `note-${p.id}` ? "Saving…" : "Add note"}
            </button>
          </div>
        </section>

        <section className="reg-person__part reg-person__part--wide" aria-label="History">
          <h3 className="reg-person__title">History</h3>
          <ul className="reg-history reg-history--person">
            {mine.map((h) => (
              <li key={h.id}>
                <span className="reg-history__when">{h.when}</span>
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  // ── Page ──────────────────────────────────────────────────────────────────
  return (
    <div className="reg-people">
      <h2 className="reg-sectitle">Needs you</h2>
      {needs.length === 0 ? (
        <p className="reg-quiet">Nothing needs you for this program.</p>
      ) : (
        <ul className="reg-list">
          {needs.map((n) => (
            <li key={n.kind} className="reg-item">
              <div className="reg-item__text">
                <strong>{n.text}</strong>
                {n.kind === "reminder" && bulkConfirm && (
                  <span className="reg-meta">{unsent.map((r) => r.name).join(", ")}</span>
                )}
              </div>
              {n.kind === "place" && (
                <button type="button" className="vol-action-btn" onClick={() => showFilter("waiting")}>See who&rsquo;s waiting</button>
              )}
              {n.kind === "dana" && (
                <button type="button" className="vol-action-btn" onClick={() => showFilter("dana")}>See who</button>
              )}
              {n.kind === "reminder" && (bulkConfirm ? (
                <ConfirmBox
                  text={`Email the reminder now to ${unsent.length === 1 ? "this person" : `these ${unsent.length} people`}?`}
                  yes="Yes, send the reminder"
                  busy={busy === "bulk"}
                  onYes={sendReminderToUnsent}
                  onNo={() => setBulkConfirm(false)}
                />
              ) : (
                <button type="button" className="vol-save-btn" onClick={() => setBulkConfirm(true)}>
                  Send it to them
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}

      <div className="reg-toolbar">
        <SectionTabs<Tab>
          label="This program"
          value={tab}
          onChange={setTab}
          options={[
            { key: "people", label: "People" },
            { key: "history", label: "History" },
          ]}
        />
        <a
          href={`/api/programs/${programSlug}/registrations?format=csv`}
          className="vol-csv-btn"
          download={`${programSlug}-registrations.csv`}
          onClick={() => setTimeout(refresh, 1500)}
        >
          Download a spreadsheet
        </a>
      </div>

      {tab === "people" ? (
        <div role="tabpanel" aria-label="People">
          <div className="reg-filterrow">
            <FilterPills<Filter>
              label="Show people"
              value={filter}
              onChange={(f) => { setFilter(f); setOpenId(null); }}
              options={[
                { key: "all", label: "All", count: count("all") },
                { key: "registered", label: "Registered", count: count("registered") },
                { key: "waiting", label: "Waiting", count: count("waiting") },
                ...(danaShown ? [{ key: "dana" as const, label: "Dana not finished", count: count("dana"), alert: count("dana") > 0 }] : []),
                { key: "cancelled", label: "Cancelled", count: count("cancelled") },
              ]}
            />
            <input
              type="search"
              className="vol-search reg-search"
              aria-label="Search people by name or email"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {reminderDay && <p className="reg-meta">The program&rsquo;s reminder email is set for {reminderDay}.</p>}
          {seeAmounts && danaShown && (
            <p className="reg-meta">Amounts given are seen only by registrars, the guiding teacher and admins.</p>
          )}

          {visible.length === 0 ? (
            <p className="vol-empty">{q ? `No one matches "${search.trim()}".` : rows.length === 0 ? "No one has registered yet." : "No one here."}</p>
          ) : (
            <div className="vol-table-wrap">
              <table className="vol-table">
                <thead>
                  <tr>
                    <th className="vol-th-toggle"><span className="reg-visually-hidden">Open</span></th>
                    <th>Name</th>
                    <th>Status</th>
                    {danaShown && <th>Dana</th>}
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const open = openId === p.id;
                    return (
                      <Fragment key={p.id}>
                        <tr
                          className={`vol-row vol-row--${p.status.toLowerCase()}${open ? " vol-row--expanded" : ""}`}
                          onClick={() => { setOpenId(open ? null : p.id); setConfirm(null); setEditing(null); }}
                        >
                          <td className="vol-row__toggle"><span className={`vol-chevron${open ? " vol-chevron--open" : ""}`} /></td>
                          <td className="vol-row__person">
                            <button
                              type="button"
                              className="reg-row-btn"
                              aria-expanded={open}
                              onClick={(e) => { e.stopPropagation(); setOpenId(open ? null : p.id); setConfirm(null); setEditing(null); }}
                            >
                              <span className="vol-row__name">{p.name}</span>
                            </button>
                            <span className="vol-row__email">{p.email}</span>
                          </td>
                          <td className="vol-row__status-cell">
                            <span className={`vol-row__status-text vol-row__status-text--${p.status.toLowerCase()}`}>
                              {STATUS_LABELS[p.status] ?? p.status}
                              {p.status === "WAITLISTED" && p.waitlistPosition ? ` #${p.waitlistPosition}` : ""}
                            </span>
                          </td>
                          {danaShown && (
                            <td className="vol-row__dana">
                              {p.donationStatus === "NOT_REQUIRED" ? "" : DANA_LABELS[p.donationStatus] ?? p.donationStatus}
                            </td>
                          )}
                          <td className="vol-row__date">{p.registeredOn}</td>
                        </tr>
                        {open && (
                          <tr className="vol-row-detail">
                            <td colSpan={danaShown ? 5 : 4} onClick={(e) => e.stopPropagation()}>
                              {personCard(p)}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div role="tabpanel" aria-label="History">
          <p className="reg-meta">
            Everything done here, newest first, with each sign-up. Kept since {HISTORY_SINCE}; what was done before then isn&rsquo;t listed.
          </p>
          {history.length === 0 ? (
            <p className="reg-quiet">Nothing yet.</p>
          ) : (
            <ul className="reg-history">
              {history.map((h) => (
                <li key={h.id}>
                  <span className="reg-history__when">{h.when}</span>
                  <span>
                    {h.person && <strong>{h.person}</strong>}
                    {h.person && " · "}
                    {h.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ActionNotice notice={notice} onClose={() => say(null)} />
    </div>
  );
}
