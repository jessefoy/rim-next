type ProgramCardNoticesProps = { announcement: string | null };
export default function ProgramCardNotices({ announcement }: ProgramCardNoticesProps) {
  if (!announcement) return null;
  return <div className="pl-card__notices"><p className="pl-card__notice pl-card__notice--announcement">
    <span className="pl-card__notice-label">Update</span>{" "}{announcement}
  </p></div>;
}
