import Link from "next/link";
import type { DuplicateCandidate } from "@/lib/memberDuplicates";
import { ROLE_LABELS, shownRoles } from "@/lib/roleLabels";

/**
 * A note at the top of a member's profile when another account may be the
 * same person (lib/memberDuplicates.ts): same name, or same phone outside one
 * household. One person with two accounts sees different teams depending on
 * the address they sign in with (Silvia, 2026-10-15), so the note sits where
 * an admin adds teams.
 */
export default function PossibleDuplicatesSection({ candidates }: { candidates: DuplicateCandidate[] }) {
  const many = candidates.length > 1;
  return (
    <section className="adm-section adm-dup" aria-labelledby="adm-dup-title">
      <h2 className="adm-section__title" id="adm-dup-title">
        {many ? "Possible second accounts" : "Possible second account"}
      </h2>
      <p className="adm2-section__hint">
        This person may also have {many ? "the accounts" : "the account"} below. Someone
        with two accounts sees different teams depending on which address they sign in
        with. If it&rsquo;s the same person, the accounts should become one.
      </p>
      <ul className="adm-dup__list">
        {candidates.map((c) => {
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
            <li key={c.id} className="adm-dup__item">
              <p className="adm-dup__who">
                <strong>{name}</strong> <span className="adm-dup__email">{c.email}</span>
              </p>
              <p className="adm-dup__facts">{facts.join(" · ")}</p>
              <Link href={`/admin/members/${c.id}`} className="adm-dup__link">
                Open this account<span className="rim-sr-only">: {c.email}</span>{" "}
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
