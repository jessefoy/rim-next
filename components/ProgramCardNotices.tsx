type ProgramCardNoticesProps = { announcement: string | null };
/** A change to the program (a cancellation, a different time or room), as one
    line with a blue edge; the text says what it is, so there is no label. */
export default function ProgramCardNotices({ announcement }: ProgramCardNoticesProps) {
  if (!announcement) return null;
  return <div className="pl-card__notices"><p className="pl-card__notice pl-card__notice--announcement">{announcement}</p></div>;
}
