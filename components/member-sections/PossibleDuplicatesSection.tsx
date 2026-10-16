"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DuplicateCandidate } from "@/lib/memberDuplicates";
import type { MergePreview, MergeSide } from "@/lib/memberMerge";
import { ROLE_LABELS, shownRoles } from "@/lib/roleLabels";

/**
 * A note at the top of a member's profile when another account may be the
 * same person (lib/memberDuplicates.ts): same name, or same phone outside one
 * household. One person with two accounts sees different teams depending on
 * the address they sign in with (Silvia, 2026-10-15), so the note sits where
 * an admin adds teams. An admin can merge the two (lib/memberMerge.ts): a
 * preview of what each holds, the address to keep, then one confirm.
 */
export default function PossibleDuplicatesSection({
  memberId,
  candidates,
  canMerge,
}: {
  memberId: string;
  candidates: DuplicateCandidate[];
  canMerge: boolean;
}) {
  const many = candidates.length > 1;
  return (
    <section className="adm-section adm-dup" aria-labelledby="adm-dup-title">
      <h2 className="adm-section__title" id="adm-dup-title">
        {many ? "Possible second accounts" : "Possible second account"}
      </h2>
      <p className="adm2-section__hint">
        This person may also have {many ? "the accounts" : "the account"} below. Someone
        with two accounts sees different teams depending on which address they sign in
        with. If it&rsquo;s the same person, merge them into one account.
      </p>
      <ul className="adm-dup__list">
        {candidates.map((c) => (
          <Candidate key={c.id} memberId={memberId} candidate={c} canMerge={canMerge} />
        ))}
      </ul>
    </section>
  );
}

function Candidate({ memberId, candidate: c, canMerge }: { memberId: string; candidate: DuplicateCandidate; canMerge: boolean }) {
  const [open, setOpen] = useState(false);
  // Focus follows the panel: into it on open, back to the button on close.
  const mergeButton = useRef<HTMLButtonElement>(null);
  const [returnFocus, setReturnFocus] = useState(false);
  useEffect(() => {
    if (!open && returnFocus) mergeButton.current?.focus();
  }, [open, returnFocus]);
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
  const facts = [
    c.matchedOn.length === 2 ? "Same name and phone" : c.matchedOn[0] === "name" ? "Same name" : "Same phone",
    c.isLegacyUnclaimed ? "Unclaimed, from the old site" : c.hasSignedIn ? "Has signed in" : "Never signed in",
    c.archived ? "Archived" : null,
    ...shownRoles(c.roles).map((r) => ROLE_LABELS[r]),
    c.teamCount > 0 ? `On ${c.teamCount} ${c.teamCount === 1 ? "team" : "teams"}` : "On no team",
    c.registrationCount > 0
      ? `${c.registrationCount} ${c.registrationCount === 1 ? "registration" : "registrations"}`
      : null,
  ].filter(Boolean);
  return (
    <li className="adm-dup__item">
      <p className="adm-dup__who">
        <strong>{name}</strong> <span className="adm-dup__email">{c.email}</span>
      </p>
      <p className="adm-dup__facts">{facts.join(" · ")}</p>
      <div className="adm-dup__actions">
        <Link href={`/admin/members/${c.id}`} className="adm-dup__link">
          Open this account<span className="rim-sr-only">: {c.email}</span>{" "}
          <span aria-hidden="true">&rarr;</span>
        </Link>
        {canMerge && !open && (
          <button type="button" className="adm2-btn--neutral" ref={mergeButton} onClick={() => setOpen(true)}>
            Merge into one account<span className="rim-sr-only">: {c.email}</span>
          </button>
        )}
      </div>
      {canMerge && open && (
        <MergePanel
          memberId={memberId}
          otherId={c.id}
          onCancel={() => {
            setReturnFocus(true);
            setOpen(false);
          }}
        />
      )}
    </li>
  );
}

function holds(s: MergeSide): string {
  const parts = [
    ...shownRoles(s.roles).map((r) => ROLE_LABELS[r]),
    s.teams ? `${s.teams} ${s.teams === 1 ? "team" : "teams"}` : null,
    s.registrations ? `${s.registrations} ${s.registrations === 1 ? "registration" : "registrations"}` : null,
    s.scheduledDates ? `${s.scheduledDates} scheduled ${s.scheduledDates === 1 ? "session" : "sessions"}` : null,
    s.rotations ? `${s.rotations} ${s.rotations === 1 ? "rotation" : "rotations"}` : null,
    s.teaching ? `teaches ${s.teaching}` : null,
    s.conversations ? `${s.conversations} ${s.conversations === 1 ? "post" : "posts"}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing attached yet";
}

function MergePanel({ memberId, otherId, onCancel }: { memberId: string; otherId: string; onCancel: () => void }) {
  const router = useRouter();
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "merging" | "error">("loading");
  const [problem, setProblem] = useState("");
  const title = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (status === "ready") title.current?.focus();
  }, [status]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/members/${memberId}/merge?other=${encodeURIComponent(otherId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Couldn't load the two accounts.");
        if (!alive) return;
        setPreview(data as MergePreview);
        setEmail((data as MergePreview).suggestedEmail);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setProblem(err instanceof Error ? err.message : "Couldn't load the two accounts.");
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [memberId, otherId]);

  const merge = async () => {
    if (status === "merging" || !email) return;
    setStatus("merging");
    setProblem("");
    try {
      const res = await fetch(`/api/admin/members/${memberId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherId, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "The merge didn't go through, and nothing was changed.");
      router.push(`/admin/members/${data.keptId}?merged=${data.notified ? "1" : "quiet"}`);
      router.refresh();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "The merge didn't go through, and nothing was changed.");
      setStatus("ready");
    }
  };

  if (status === "loading") {
    return (
      <p className="adm-dup__panel adm2-section__hint" role="status">
        Looking at both accounts…
      </p>
    );
  }
  if (!preview) {
    return (
      <div className="adm-dup__panel">
        <p className="adm2-save__error" role="alert">{problem}</p>
        <button type="button" className="adm2-btn--neutral" onClick={onCancel}>Close</button>
      </div>
    );
  }

  const kept = preview.sides.find((s) => s.id === preview.keepId)!;
  return (
    <div className="adm-dup__panel" role="group" aria-labelledby={`merge-${otherId}`}>
      <p className="adm-dup__panel-title" id={`merge-${otherId}`} ref={title} tabIndex={-1}>
        Merge these two accounts into one
      </p>
      <ul className="adm-dup__sides">
        {preview.sides.map((s) => (
          <li key={s.id}>
            <strong className="adm-dup__side-email">{s.email}</strong>
            <span className="adm-dup__facts">
              {s.isLegacyUnclaimed ? "Unclaimed, from the old site" : s.hasSignedIn ? "Has signed in" : "Never signed in"}
              {" · "}
              {holds(s)}
            </span>
          </li>
        ))}
      </ul>
      <p className="adm2-section__hint">
        Everything from both moves onto one account: roles, teams, registrations, scheduled
        sessions, rotations, teaching, conversations and files. Where both have the same thing,
        nothing is doubled. The record kept is the one now at {kept.email}, because it holds
        more of the history; you choose the address it signs in with.
      </p>
      <fieldset className="adm-dup__choice">
        <legend className="adm-dup__legend">Which address should they sign in with?</legend>
        {preview.sides.map((s) => (
          <label key={s.id} className="adm-dup__option">
            <input
              type="radio"
              name={`merge-email-${otherId}`}
              value={s.email}
              checked={email === s.email}
              onChange={() => setEmail(s.email)}
            />
            <span>{s.email}</span>
          </label>
        ))}
      </fieldset>
      <p className="adm2-section__hint">
        The other address still works as a way in: signing in with it shows the new one and
        sends the code there. We&rsquo;ll email {email || "the address you choose"} to say the
        accounts are now one (unless the account is archived or still unclaimed). This
        can&rsquo;t be undone.
      </p>
      {preview.blocker && <p className="adm2-save__error" role="alert">{preview.blocker}</p>}
      {problem && <p className="adm2-save__error" role="alert">{problem}</p>}
      <div className="adm-dup__actions">
        <button type="button" className="adm2-save__btn" onClick={merge} disabled={status === "merging" || !email || !!preview.blocker}>
          {status === "merging" ? "Merging…" : "Merge accounts"}
        </button>
        <button type="button" className="adm2-btn--neutral" onClick={onCancel} disabled={status === "merging"}>
          Cancel
        </button>
      </div>
    </div>
  );
}
