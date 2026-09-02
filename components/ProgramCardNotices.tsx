type ProgramCardNoticesProps = {
  announcement: string | null;
  note: string | null;
};

export default function ProgramCardNotices({
  announcement,
  note,
}: ProgramCardNoticesProps) {
  if (!announcement && !note) return null;

  return (
    <div className="pl-card__notices">
      {announcement && (
        <p className="pl-card__notice pl-card__notice--announcement">
          <span className="pl-card__notice-label">Update</span>{" "}
          {announcement}
        </p>
      )}
      {note && (
        <p className="pl-card__notice pl-card__notice--note">
          <span className="pl-card__notice-label">Good to know</span>{" "}
          {note}
        </p>
      )}
    </div>
  );
}
