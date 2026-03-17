import ListRow from "@/components/ListRow";

/**
 * SeriesListItem — lesson rows inside .series-list-wrapper on course pages.
 *
 * Regular items delegate to <ListRow> for consistent card styling.
 * Header items (isHeader) use a lightweight label style for section dividers.
 */
export default function SeriesListItem({
  title,
  href,
  isHeader = false,
  includesAudio = false,
}: {
  title: string;
  href?: string;
  isHeader?: boolean;
  includesAudio?: boolean;
}) {
  if (isHeader) {
    return (
      <div className="lesson-section-header">
        <div className="lesson-section-break">{title}</div>
      </div>
    );
  }

  return (
    <ListRow
      title={title}
      badge={includesAudio ? " 🎧" : undefined}
      href={href}
      buttonLabel="Go →"
    />
  );
}
