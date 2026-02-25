import ListRow from "@/components/ListRow";

/**
 * SeriesListItem — lesson rows inside .series-list-wrapper on course pages.
 *
 * Regular items delegate to <ListRow> for consistent card styling.
 * Section-title items use the Webflow series-list-grid section-title-bg style
 * (transparent, no button) which is unique to the course page outline layout.
 */
export default function SeriesListItem({
  title,
  href,
  isSectionTitle = false,
  includesAudio = false,
}: {
  title: string;
  href?: string;
  isSectionTitle?: boolean;
  includesAudio?: boolean;
}) {
  if (isSectionTitle) {
    return (
      <div className="w-layout-grid series-list-grid section-title-bg">
        <div className="dashboard-list-name-and-date-container">
          <div className="dashboard-title-container">
            <div className="lesson-section-break">{title}</div>
          </div>
        </div>
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
