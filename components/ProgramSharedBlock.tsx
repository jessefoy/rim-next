import Link from "next/link";

/**
 * The shared block on a program's page (2026-10-01, the integration brief,
 * A17; words from the brief's Part B4). It sits after "Gathering details" and
 * before "Facilitators" on every program in Foundations, Learning & Practice,
 * and Immersion, and not on Community Groups or Events (see
 * lib/programChapters.ts). It says the two things true of every such program,
 * once, so each program's own text does not have to: Taking CARE runs through
 * it, and its dana is a suggested contribution that does not turn anyone away.
 *
 * A recede panel (the same surface as a program's Notes), not a lifted card:
 * it is supplementary, and the details card above already carries the lift.
 * Provisional until Jesse's read-aloud.
 */
export default function ProgramSharedBlock() {
  return (
    <section className="pg-notes pg-shared">
      <p className="pg-shared__text">
        Taking CARE, our root practice, is present in every RIM gathering.
      </p>
      <Link href="/care" className="pg-shared__link">
        How we practice
      </Link>
      <p className="pg-shared__text">
        Programs list a suggested contribution so everyone can see what an offering takes to
        sustain. For most programs, no one is turned away for being unable to pay.
      </p>
      <Link href="/donate#dana-at-rim" className="pg-shared__link">
        How dana works
      </Link>
    </section>
  );
}
