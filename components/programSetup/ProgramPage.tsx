"use client";

/**
 * A published program's page (2026-10-28, Phase 3): its setup said as plain
 * sentences, one card per section, each with Change. Change walks just that
 * section's questions (ProgramSetup in edit mode), says what the change would
 * do, and saves it with the editor's safe save. Post a notice, the guest
 * link, the notes a save leaves and Tell the people registered live here, as
 * they did on the one-page editor this replaces.
 *
 * CSS prefix: psu- (ps- is the Scheduler's staffing page)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProgramSetup, { SectionSays, type ListedProgram, type SaveAnswer, type SetupTeam } from "./ProgramSetup";
import NoticePanel from "@/components/registrar/program-editor/NoticePanel";
import UpdatePanel, { type UpdateOffer } from "@/components/registrar/program-editor/UpdatePanel";
import { listingReasonOf } from "@/components/registrar/program-editor/shared";
import { SETUP_SECTIONS, choicesFrom, liveSteps, missingForPublish, type SetupData, type SetupSection } from "@/lib/programSetup";
import type { ProgramData } from "@/lib/programTypes";
import { UPDATE_KINDS, type UpdateKind } from "@/lib/programUpdate";
import { isPubliclyListedCategory } from "@/lib/programOffering";
import { activeAnnouncement } from "@/lib/scheduleUtils";

interface Props {
  data: SetupData;
  teams: { hosting: SetupTeam[]; supporting: SetupTeam[]; prepare: { id: string; slug: string; name: string }[] };
  canDecideAskers: boolean;
  /** Archive, restore, the guest-link reset: the three roles. */
  canManage: boolean;
  /** The people registered, for those who can open Registration; else null. */
  registeredCount: number | null;
  archived: boolean;
  /** The old category hides it from the public page. */
  categoryHidden: boolean;
  listed: ListedProgram[];
  today: string;
}

type SeatConflict = { message: string; capacity: number };

export default function ProgramPage({ data: given, teams, canDecideAskers, canManage, registeredCount, archived, categoryHidden, listed, today }: Props) {
  const router = useRouter();
  // The program as last saved: the save answers with it (editorData), so a
  // second Change starts from it without waiting for the page to refresh.
  const [data, setData] = useState<SetupData>(given);
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOrigin(window.location.origin), []);
  const [editing, setEditing] = useState<SetupSection | null>(null);
  const [said, setSaid] = useState("");
  const [seatConflicts, setSeatConflicts] = useState<SeatConflict[]>([]);
  const [cleared, setCleared] = useState<{ sessions: number; rotations: number } | null>(null);
  const [notRenamed, setNotRenamed] = useState(0);
  const [offer, setOffer] = useState<(UpdateOffer & { slug: string }) | null>(null);
  const [offerAnswer, setOfferAnswer] = useState("");
  const [guestKey, setGuestKey] = useState(data.guestAccessKey);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState<"ask" | "busy" | null>(null);
  const [guestNote, setGuestNote] = useState("");

  // Just published (or created): said as it opens, once.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`pe-created:${data.slug}`)) {
        sessionStorage.removeItem(`pe-created:${data.slug}`);
        // Read once as the page opens (browser storage, an outside system).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSaid("Published. It's saved, and everything below is as it is now.");
      }
      const raw = sessionStorage.getItem(`pe-seat-conflicts:${data.slug}`);
      if (raw) {
        sessionStorage.removeItem(`pe-seat-conflicts:${data.slug}`);
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSeatConflicts(parsed);
      }
    } catch { /* storage unavailable: the page says enough */ }
  }, [data.slug]);

  function closed(answer?: SaveAnswer) {
    setEditing(null);
    window.scrollTo({ top: 0 });
    if (!answer) return;
    setSaid(`Saved at ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`);
    setSeatConflicts((answer.seatConflicts as SeatConflict[]) ?? []);
    setCleared((answer.scheduleCleared as { sessions: number; rotations: number }) ?? null);
    setNotRenamed(typeof answer.meetingsNotRenamed === "number" ? answer.meetingsNotRenamed : 0);
    if (typeof answer.guestAccessKey === "string") setGuestKey(answer.guestAccessKey);
    const saved = answer.editorData as ProgramData | undefined;
    if (saved) {
      setData({
        ...saved,
        recurrenceUntil: saved.recurrenceUntil ?? "",
        listFirst: saved.listFirst ?? false,
        setup: { ...choicesFrom(saved), noTeacher: saved.programTeachers.length === 0 },
      });
    }
    const o = answer.updateOffer as { kinds: UpdateKind[]; count: number | null; lines?: Partial<Record<UpdateKind, string>> } | undefined;
    if (o) {
      setOfferAnswer("");
      setOffer((prev) => ({
        kinds: UPDATE_KINDS.filter((k) => prev?.kinds.includes(k) || o.kinds.includes(k)),
        count: o.count,
        lines: Object.fromEntries(UPDATE_KINDS.map((k) => [k, o.kinds.includes(k) ? o.lines?.[k] : prev?.lines[k]]).filter(([, v]) => v)),
        programName: String(answer.name ?? data.name),
        slug: String(answer.slug ?? data.slug),
        seq: (prev?.seq ?? 0) + 1,
      }));
    }
    // The page's own data, as saved.
    router.refresh();
  }

  if (editing) {
    return (
      <ProgramSetup
        key={editing}
        edit={{ slug: data.slug, section: editing, onClose: closed }}
        initial={data}
        teams={teams}
        canDecideAskers={canDecideAskers}
        listed={listed}
        today={today}
      />
    );
  }

  // Where a notice shows: only the lists the program is on.
  const onCatalog = listingReasonOf({
    isArchived: archived,
    hideFromProgramPageList: data.hideFromProgramPageList, offeringCategory: data.offeringCategory,
    categoryHidden, hideWhenPast: data.hideWhenPast, recurrenceFreq: data.recurrenceFreq,
    startDatetime: data.startDatetime, endDatetime: data.endDatetime,
  }) === null;
  const onWeek = !archived && !data.hideFromProgramPageList && !data.hideFromWeeklySchedule && isPubliclyListedCategory(data.offeringCategory);
  const where = ["the program’s page", ...(onCatalog ? ["Programs & Events"] : []), ...(onWeek ? ["This Week"] : []), "My Home"];
  const places = `${where.slice(0, -1).join(", ")} and ${where[where.length - 1]}`;
  const missing = missingForPublish(data);
  const guestUrl = guestKey && origin ? `${origin}/session/${data.slug}?key=${guestKey}` : "";

  async function resetGuest() {
    setResetting("busy");
    setGuestNote("");
    try {
      const res = await fetch(`/api/programs-pg/${data.slug}/guest-key`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.guestAccessKey) { setGuestNote("The link wasn't reset, so the old one still works. Please try again."); setResetting(null); return; }
      setGuestKey(body.guestAccessKey);
      setGuestNote("The old link no longer works. Share the new one.");
    } catch {
      setGuestNote("The link wasn't reset, so the old one still works. Please check your connection and try again.");
    }
    setResetting(null);
  }

  return (
    <div className="psu-page">
      <div className="psu-head">
        <Link href="/tools/programs" className="app-back">&larr; Programs</Link>
        <h1>{data.name}</h1>
        <p className="psu-state">
          <strong>{archived ? "Archived" : "Published"}</strong>
          {" · "}{onCatalog ? "on Programs & Events" : "not on Programs & Events"}{onWeek ? " and This Week" : ""}
          {registeredCount != null ? ` · ${registeredCount === 1 ? "1 person" : `${registeredCount} people`} registered` : ""}
        </p>
      </div>

      {said && <div className="psu-done" role="status"><p><strong>{said}</strong></p><p>Each part below has its own Change. Nothing changes until you&rsquo;ve seen what it does.</p></div>}
      {cleared && (cleared.sessions > 0 || cleared.rotations > 0) && (
        <div className="psu-note psu-note--look" role="status">
          <p>
            It now meets on a different schedule.{" "}
            {cleared.sessions > 0 && <>{cleared.sessions} upcoming {cleared.sessions === 1 ? "session" : "sessions"} on days it no longer meets {cleared.sessions === 1 ? "was" : "were"} cleared, and the people on them are emailed. </>}
            {cleared.rotations > 0 && <>{cleared.rotations} {cleared.rotations === 1 ? "rotation" : "rotations"} that no longer {cleared.rotations === 1 ? "fits" : "fit"} {cleared.rotations === 1 ? "was" : "were"} ended; the team&rsquo;s leads set up the new days in the Scheduler.</>}
          </p>
        </div>
      )}
      {notRenamed > 0 && (
        <div className="psu-note psu-note--look" role="status">
          <p>The new name is saved. Zoom didn&rsquo;t take it yet for {notRenamed === 1 ? "the session already set up" : `the ${notRenamed} sessions already set up`}, so {notRenamed === 1 ? "it is" : "they are"} given the new name when the session opens.</p>
        </div>
      )}
      {seatConflicts.length > 0 && (
        <div className="psu-note psu-note--look" role="status">
          <p><strong>This overlaps other online sessions on Zoom.</strong></p>
          {seatConflicts.map((c, i) => <p key={i}>{c.message}</p>)}
          <p>It&rsquo;s saved. If these need to run at the same time, move one of them, or ask an administrator about adding a Zoom room. Otherwise, people joining the later one will find no room free.</p>
          <p><button type="button" className="app-act" onClick={() => setSeatConflicts([])}>Dismiss</button></p>
        </div>
      )}
      {offer && <UpdatePanel slug={offer.slug} offer={offer} onDone={(a) => { setOffer(null); setOfferAnswer(a ?? ""); }} />}
      {offerAnswer && <p className="psu-done" role="status">{offerAnswer}</p>}

      <div className="psu-row psu-page-acts">
        <a className="app-act" href={`/programs/${data.slug}`} target="_blank" rel="noreferrer">View its page &#8599;</a>
        {registeredCount != null && <Link className="app-act" href={`/tools/registration/${data.slug}`}>People</Link>}
      </div>

      {!archived && (
        <NoticePanel
          slug={data.slug}
          initialNotice={activeAnnouncement({ specialAnnouncement: data.specialAnnouncement, announcementUntil: data.announcementUntil ? `${data.announcementUntil}T12:00:00Z` : null }) ?? ""}
          initialUntil={data.announcementUntil ?? ""}
          canEmail={registeredCount != null}
          registeredCount={registeredCount}
          places={places}
        />
      )}

      {missing.length > 0 && (
        <div className="psu-note psu-note--look" role="status">
          <p><strong>Worth a look:</strong></p>
          {missing.map((m) => (
            <p key={m.step.id}>
              <button type="button" className="psu-inline" onClick={() => setEditing(m.step.sec)}>{m.need}</button>
            </p>
          ))}
        </div>
      )}

      <div className="psu-review">
        {SETUP_SECTIONS.map((sec) => {
          if (!liveSteps(data, sec.id).length) return null;
          return (
            <section key={sec.id} className="psu-card" aria-labelledby={`pp-${sec.id}`}>
              <div className="psu-card__head">
                <h2 id={`pp-${sec.id}`}>{sec.name}</h2>
                <button type="button" className="psu-card__change" onClick={() => { setEditing(sec.id); window.scrollTo({ top: 0 }); }} aria-label={`Change ${sec.name}`}>Change</button>
              </div>
              <div className="psu-card__body">
                <SectionSays d={data} section={sec.id} />
                {sec.id === "join" && data.isOpenAccess && (
                  <div className="psu-guest">
                    <p className="psu-label">The guest link</p>
                    {guestUrl ? (
                      <>
                        <p className="psu-guest__url">{guestUrl}</p>
                        <div className="psu-row">
                          <button type="button" className="app-act" onClick={() => { navigator.clipboard?.writeText(guestUrl).then(() => setCopied(true)); }}>{copied ? "Copied" : "Copy the link"}</button>
                          {canManage && resetting !== "ask" && <button type="button" className="app-act" onClick={() => setResetting("ask")}>Reset the link</button>}
                        </div>
                        {resetting === "ask" && (
                          <div className="psu-confirm" role="group" aria-label="Reset the guest link?">
                            Reset it? The old link stops working right away, so anyone you shared it with will need the new one.
                            <button type="button" className="pe-btn pe-btn--primary" onClick={resetGuest}>Yes, reset the link</button>
                            <button type="button" className="app-act" onClick={() => setResetting(null)}>Cancel</button>
                          </div>
                        )}
                      </>
                    ) : <p className="psu-hint">The link is made when the program is saved with guests on.</p>}
                    {guestNote && <p className="psu-hint" role="status">{guestNote}</p>}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
